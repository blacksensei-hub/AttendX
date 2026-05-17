const { Session, Attendance, Enrollment } = require('../models');
const { validateToken }                   = require('../services/qrService');
const { isWithinGeofence, isSuspiciousCoordinate } = require('../services/geoService');
const { success, error }                  = require('../utils/apiResponse');

exports.markAttendance = async (req, res) => {
  const io = req.app.get('io');
  try {
    const { sessionId, qrToken, latitude, longitude, deviceId, isMockGps } = req.body;
    const studentId = req.user.id;

    // 1. Confirm the session exists and is still accepting attendance.
    //    We include the 'class' association so we can access geofence
    //    coordinates and the class name snapshot later in this function.
    const session = await Session.findByPk(sessionId, {
      include: [{ association: 'class' }],
    });
    if (!session)
      return res.status(404).json(error('Session not found'));
    if (session.status !== 'open')
      return res.status(400).json(error('This session is no longer active'));

    // 2. Verify the student is actually enrolled in this class.
    //    Without this check, any authenticated user could mark attendance
    //    for any open session, which would be a serious security flaw.
    const enrolled = await Enrollment.findOne({
      where: { student_id: studentId, class_id: session.class_id },
    });
    if (!enrolled)
      return res.status(403).json(error('You are not enrolled in this class'));

    // 3. Prevent duplicate attendance records.
    //    The database has a unique constraint on (session_id, student_id),
    //    but catching it here gives us a cleaner, more descriptive error
    //    message rather than a raw database constraint violation.
    const alreadyMarked = await Attendance.findOne({
      where: { session_id: sessionId, student_id: studentId },
    });
    if (alreadyMarked)
      return res.status(409).json(error('Attendance already marked for this session'));

    // 4. Validate the QR token.
    //    The qrService checks that the token exists in the database,
    //    belongs to this specific session, and has not yet expired.
    //    This is the core anti-proxy mechanism — a screenshot of an
    //    old token will fail here because tokens expire every few seconds.
    const qrResult = await validateToken(qrToken, sessionId);
    if (!qrResult.valid)
      return res.status(400).json(error(qrResult.reason));

    // 5. Reject mock GPS.
    //    On Android, expo-location sets loc.mocked = true when a GPS
    //    spoofing app is active. We trust this flag and block the attempt
    //    outright with a clear explanation to the student.
    if (isMockGps)
      return res.status(400).json(error(
        'Mock location detected. Please disable GPS spoofing apps.'
      ));

    // 6. Sanity-check the coordinates before using them for anything.
    //    Web submissions intentionally send latitude=0 and longitude=0
    //    as a fallback, so we only run this check when real non-zero
    //    coordinates were provided. The check rejects nonsensical values
    //    like lat=999 or the famous "null island" at exactly 0,0.
    if (latitude && longitude) {
      if (isSuspiciousCoordinate(latitude, longitude))
        return res.status(400).json(error('Invalid GPS coordinates received.'));
    }

    // 7. Geofence validation.
    //    We only run this if the student sent real coordinates AND the
    //    class has a geofence configured. If either is absent we skip
    //    silently rather than blocking the student. The Haversine formula
    //    inside isWithinGeofence gives us the great-circle distance in
    //    metres between the student's position and the classroom centre.
    if (latitude && longitude && session.geo_lat && session.geo_lng) {
      const geoCheck = isWithinGeofence({
        studentLat:   latitude,
        studentLng:   longitude,
        centerLat:    session.geo_lat,
        centerLng:    session.geo_lng,
        radiusMeters: session.geo_radius ?? 100,
      });
      if (!geoCheck.within) {
        return res.status(400).json(error(
          `You are outside the allowed area (${Math.round(geoCheck.distance)}m away).`
        ));
      }
    }

    // 8. Determine whether the student is present or late.
    //    We compare elapsed minutes since the session opened against the
    //    late_threshold the lecturer configured when opening the session.
    //    The default threshold is 15 minutes if none was specified.
    const minutesSinceOpen =
      (Date.now() - new Date(session.open_at).getTime()) / 60000;
    const status = minutesSinceOpen > session.late_threshold ? 'late' : 'present';

    // 9. Write the attendance record to the database.
    //    This is the single most important write in the entire function.
    //    Everything before this point was validation — every step either
    //    passed silently or returned an error response. Everything after
    //    this point is side effects that enrich the experience but do not
    //    affect the correctness of the attendance record itself.
    const attendance = await Attendance.create({
      session_id:    sessionId,
      student_id:    studentId,
      status,
      geo_lat:       latitude  || null,
      geo_lng:       longitude || null,
      device_id:     deviceId,
      ip_address:    req.ip,
      is_mock_gps:   false,
      qr_token_used: qrToken,
    });

    // 10. Fetch the full user record so we have name, email, and student ID.
    //     The JWT middleware only decodes { id, role } into req.user —
    //     it deliberately omits other fields to keep token size small.
    //     We fetch once here and share the result across steps 11, 12, and 13,
    //     so we only hit the database a single time for this purpose.
    //     Crucially, we now include 'student_id' so the lecturer's dashboard
    //     can display the official institutional ID alongside the name.
    const { User } = require('../models');
    const fullUser = await User.findByPk(studentId, {
      attributes: ['id', 'name', 'email', 'student_id'],
    });

    // 11. Emit a real-time WebSocket event to the lecturer's live dashboard.
    //     We use fullUser here instead of req.user because req.user only
    //     carries { id, role } — name, email, and student_id would all be
    //     undefined if we used it directly, causing the dashboard to show
    //     blank rows. The ?? fallbacks ensure the event always carries
    //     sensible string values even if a field is unexpectedly null.
    //
    //     We include `id: attendance.id` so connected clients can dedupe
    //     against records that may also arrive via their reconciliation
    //     poll. Without this, a socket-pushed scan and a polled scan
    //     could both render as separate rows, double-counting the student.
    io?.to(`session:${sessionId}`).emit('attendance:marked', {
      id:                attendance.id,
      sessionId,
      studentId,
      studentName:       fullUser?.name       ?? 'Unknown student',
      studentEmail:      fullUser?.email      ?? '',
      studentId_display: fullUser?.student_id ?? '',
      status,
      marked_at:         attendance.marked_at,
    });

    // 12. Create an in-app bell notification for the student.
    //     We wrap this in try-catch because a notification failure must
    //     never propagate upward and convert a successfully saved attendance
    //     record into a 500 error from the student's perspective.
    try {
      const { createNotification } = require('../services/notificationService');
      await createNotification(io, {
        userId:  studentId,
        type:    'attendance_confirmed',
        title:   '✅ Attendance confirmed',
        message: `Your attendance for ${session.class_name_snapshot || 'the class'} has been marked as ${status}.`,
        data:    { sessionId, status },
      });
    } catch (notifyErr) {
      console.warn('Notification failed (non-critical):', notifyErr.message);
    }

    // 13. Send a confirmation email — fire-and-forget pattern.
    //     We intentionally do NOT await this call. Sending an email can
    //     take 200-500ms depending on the SMTP server, and the student
    //     should not have to wait for network round-trips to Gmail.
    //     The .catch() at the end ensures any SMTP failure is logged
    //     but silently swallowed rather than crashing the request.
    //     The outer try-catch handles the unlikely case that even
    //     requiring the module or calling the function throws synchronously.
    if (fullUser) {
      try {
        const { sendAttendanceConfirmedEmail } = require('../services/emailService');
        sendAttendanceConfirmedEmail({
          to:          fullUser.email,
          studentName: fullUser.name,
          className:   session.class_name_snapshot || 'your class',
          status,
          markedAt:    attendance.marked_at,
        }).catch(emailErr =>
          console.error('Confirmation email error:', emailErr.message)
        );
      } catch (emailErr) {
        console.warn('Email setup failed (non-critical):', emailErr.message);
      }
    }

    // 14. Return the success response to the student.
    //     This is the single success return in the happy path.
    //     All the early returns above this point send error responses
    //     and exit the function immediately. Everything between step 9
    //     and here is non-blocking side-effect work — the attendance
    //     record is saved regardless of what happens in steps 10-13.
    return res.status(201).json(success(
      { attendance: { status, marked_at: attendance.marked_at } },
      `Attendance marked as ${status}!`
    ));

  } catch (err) {
    // This outer catch handles truly unexpected errors — things like the
    // database connection dropping mid-request or a bug in one of the
    // validation helpers. We log the full message for server-side debugging
    // but only send a generic message to the client to avoid leaking
    // implementation details or stack traces to end users.
    console.error('MARK ATTENDANCE ERROR:', err.message);
    return res.status(500).json(error('Server error while marking attendance'));
  }
};