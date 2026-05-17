// server/src/controllers/adminHeatmapController.js

const { Op }             = require('sequelize');
const { Class, Session, Attendance, User } = require('../models');
const { success, error } = require('../utils/apiResponse');

// ─── Campus anchor points ────────────────────────────────────
const CAMPUS_CENTRES = {
  tesano: { lat: 5.5961, lng: -0.2235, label: 'Tesano (Main Campus)' },
  abeka:  { lat: 5.5995, lng: -0.2362, label: 'Abeka Campus'         },
};

const GRID_STEP_LAT = 0.00032;
const GRID_STEP_LNG = 0.00040;

const GRID_OFFSETS = [
  [ 0,  0],
  [-1,  0],
  [ 1,  0],
  [ 0, -1],
  [ 0,  1],
  [-1, -1],
  [ 1, -1],
  [-1,  1],
  [ 1,  1],
];

function classroomCoords(campus, indexWithinCampus) {
  const centre   = CAMPUS_CENTRES[campus] || CAMPUS_CENTRES.tesano;
  const [col, row] = GRID_OFFSETS[indexWithinCampus % GRID_OFFSETS.length];
  return {
    lat: centre.lat + row * GRID_STEP_LAT,
    lng: centre.lng + col * GRID_STEP_LNG,
  };
}

// ─── GET /api/admin/heatmap ──────────────────────────────────
exports.getHeatmapData = async (req, res) => {
  try {
    const [classes, activeSessions] = await Promise.all([
      Class.findAll({
        include: [{
          model:      User,
          as:         'lecturer',
          attributes: ['id', 'name', 'email'],   // ← 'name' not 'full_name'
        }],
        order: [['id', 'ASC']],
      }),
      Session.findAll({
        where:      { status: 'open' },
        attributes: ['id', 'class_id', 'title', 'created_at', 'close_at'],
      }),
    ]);

    // Attendance counts for every open session
    const activeSessionIds = activeSessions.map(s => s.id);
    const attendanceCounts = {};

    if (activeSessionIds.length > 0) {
      const records = await Attendance.findAll({
        where: {
          session_id: { [Op.in]: activeSessionIds },
          status:     { [Op.in]: ['present', 'late'] },
        },
        attributes: ['session_id'],
      });
      for (const r of records) {
        attendanceCounts[r.session_id] = (attendanceCounts[r.session_id] || 0) + 1;
      }
    }

    const sessionByClass = {};
    for (const s of activeSessions) {
      sessionByClass[s.class_id] = s;
    }

    const campusIndex = { tesano: 0, abeka: 0 };

    const classrooms = classes.map((cls, globalIndex) => {
      const campus = (cls.campus || (globalIndex % 2 === 0 ? 'tesano' : 'abeka'))
        .toLowerCase().trim();

      const validCampus = CAMPUS_CENTRES[campus] ? campus : 'tesano';
      const slotIndex   = campusIndex[validCampus] ?? 0;
      campusIndex[validCampus] = slotIndex + 1;

      const coords        = classroomCoords(validCampus, slotIndex);
      const activeSession = sessionByClass[cls.id] || null;
      const attendees     = activeSession
        ? (attendanceCounts[activeSession.id] || 0)
        : 0;

      return {
        id:          cls.id,
        name:        cls.name || cls.title,
        code:        cls.code,
        campus:      validCampus,
        campusLabel: CAMPUS_CENTRES[validCampus].label,
        lat:         coords.lat,
        lng:         coords.lng,
        lecturer:    cls.lecturer
          ? { id: cls.lecturer.id, name: cls.lecturer.name }  // ← .name not .full_name
          : null,
        activeSession: activeSession
          ? {
              id:       activeSession.id,
              title:    activeSession.title,
              openedAt: activeSession.created_at,
              closesAt: activeSession.close_at,
              attendees,
            }
          : null,
      };
    });

    const campusSummary = Object.keys(CAMPUS_CENTRES).map(key => ({
      key,
      label:          CAMPUS_CENTRES[key].label,
      lat:            CAMPUS_CENTRES[key].lat,
      lng:            CAMPUS_CENTRES[key].lng,
      totalClasses:   classrooms.filter(c => c.campus === key).length,
      activeSessions: classrooms.filter(c => c.campus === key && c.activeSession).length,
    }));

    // Use res.json(success(...)) — same convention as every other controller
    return res.json(success({
      classrooms,
      campusSummary,
      totals: {
        classes:        classrooms.length,
        activeSessions: activeSessions.length,
        liveAttendees:  Object.values(attendanceCounts).reduce((s, n) => s + n, 0),
      },
    }));

  } catch (err) {
    console.error('[Heatmap] getHeatmapData failed:', err);
    return res.status(500).json(error('Failed to load heatmap data'));
  }
};