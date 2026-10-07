// server/src/controllers/attendanceController.test.js
//
// The check-in path, end to end through markAttendance, with the database,
// fraud log, notifications, email and sockets swapped for stand-ins. The QR
// and location checks are the real ones.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { fake, response } = require('../test/fakes');

const SESSION = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const HALL = { lat: 5.6037, lng: -0.187 };
const metresNorth = (m) => HALL.lat + m / 111_195;

let db;
const attempts = [];
const flags = [];
const emitted = [];

fake('models/index.js', {
  QRToken: {
    findOne: async ({ where }) => (db.token && where.token === db.token.token ? db.token : null),
  },
  Session: {
    findByPk: async (id) => (db.session && id === db.session.id ? db.session : null),
  },
  Enrollment: {
    findOne: async () => (db.enrolled ? { id: 'enrolment' } : null),
  },
  Attendance: {
    findOne: async () => (db.alreadyMarked ? { id: 'earlier' } : null),
    create: async (values) => {
      const saved = { id: `a${db.saved.length + 1}`, marked_at: new Date(), ...values };
      db.saved.push(saved);
      return saved;
    },
    findAll: async ({ where }) => [...db.earlierOnDevice, ...db.saved]
      .filter(r => r.session_id === where.session_id && r.device_id === where.device_id),
  },
  User: {
    findByPk: async (id) => ({
      id, name: `Student ${id}`, email: `${id}@example.test`, student_id: '0123456789',
      bound_mobile_device_id: db.boundPhone,
    }),
    findAll: async ({ where }) => where.id[Object.getOwnPropertySymbols(where.id)[0]]
      .map(id => ({ id, name: `Student ${id}`, student_id: '0123456789' })),
  },
});
fake('services/fraudService.js', {
  recordAttempt: (attempt) => { attempts.push(attempt); return Promise.resolve(); },
  flagProxyDevice: (flag) => { flags.push(flag); return Promise.resolve(); },
});
fake('services/opsFeed.js', { opsEmit: () => {} });
fake('services/notificationService.js', { createNotification: async () => {} });
fake('services/emailService.js', { sendAttendanceConfirmedEmail: async () => {} });

const { markAttendance } = require('./attendanceController');

const io = { to: () => ({ emit: (event, data) => emitted.push({ event, data }) }) };

beforeEach(() => {
  db = {
    token: { token: 'tok', session_id: SESSION, expires_at: new Date(Date.now() + 5000) },
    session: {
      id: SESSION, class_id: CLASS_ID, status: 'open',
      geo_lat: HALL.lat, geo_lng: HALL.lng, geo_radius: 100,
      open_at: new Date(Date.now() - 2 * 60_000), late_threshold: 15,
      class_name_snapshot: 'CSC 301', class: { name: 'CSC 301' },
    },
    enrolled: true,
    alreadyMarked: false,
    boundPhone: 'phone-1',
    saved: [],
    earlierOnDevice: [],
  };
  attempts.length = 0;
  flags.length = 0;
  emitted.length = 0;
});

async function scan(body = {}, student = 'stu-1') {
  const res = response();
  await markAttendance({
    app: { get: () => io },
    user: { id: student, role: 'student' },
    ip: '10.0.0.7',
    body: { qrToken: 'tok', latitude: metresNorth(20), longitude: HALL.lng, deviceId: 'phone-1', isMockGps: false, ...body },
  }, res);
  return res;
}

test('a fresh code from inside the room marks the student present', async () => {
  const res = await scan();
  assert.equal(res.statusCode, 201);
  assert.equal(db.saved.length, 1);
  assert.equal(db.saved[0].status, 'present');
  assert.equal(db.saved[0].session_id, SESSION);
  assert.equal(attempts.length, 0);
  assert.ok(emitted.some(e => e.event === 'attendance:marked'));
});

test('the code decides the session, not the id the app sends', async () => {
  const res = await scan({ sessionId: '99999999-9999-4999-8999-999999999999' });
  assert.equal(res.statusCode, 201);
  assert.equal(db.saved[0].session_id, SESSION);
});

test('a scan from a browser, with no phone id, is refused', async () => {
  const res = await scan({ deviceId: undefined });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /AttendX app/);
  assert.equal(attempts[0].reason, 'wrong_phone');
  assert.equal(db.saved.length, 0);
});

test("a scan from a phone that isn't the account's is refused", async () => {
  const res = await scan({ deviceId: 'phone-2' });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /phone registered to your account/);
  assert.equal(attempts[0].reason, 'wrong_phone');
  assert.equal(db.saved.length, 0);
});

test('an account with no phone yet is told to sign in to the app first', async () => {
  db.boundPhone = null;
  const res = await scan();
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /Sign in to the AttendX app/);
  assert.equal(db.saved.length, 0);
});

test('a class with a zone refuses a scan with location turned off', async () => {
  const res = await scan({ latitude: 0, longitude: 0 });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Turn on location/);
  assert.equal(attempts[0].reason, 'no_location');
  assert.equal(db.saved.length, 0);
});

test('a class with no zone takes a scan without a location', async () => {
  db.session.geo_lat = null;
  db.session.geo_lng = null;
  const res = await scan({ latitude: 0, longitude: 0 });
  assert.equal(res.statusCode, 201);
});

test('a closed session takes no more scans', async () => {
  db.session.status = 'closed';
  const res = await scan();
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /no longer active/);
  assert.equal(db.saved.length, 0);
});

test("a student who isn't on the class list is refused", async () => {
  db.enrolled = false;
  const res = await scan();
  assert.equal(res.statusCode, 403);
  assert.equal(db.saved.length, 0);
});

test('nobody is marked twice in one session', async () => {
  db.alreadyMarked = true;
  const res = await scan();
  assert.equal(res.statusCode, 409);
  assert.equal(db.saved.length, 0);
});

test('an expired code is refused and logged as expired', async () => {
  db.token.expires_at = new Date(Date.now() - 1000);
  const res = await scan();
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /expired/);
  assert.equal(attempts[0].reason, 'expired_token');
  assert.equal(db.saved.length, 0);
});

test('an unknown code is refused and logged as invalid', async () => {
  const res = await scan({ qrToken: 'not-a-real-code', sessionId: SESSION });
  assert.equal(res.statusCode, 400);
  assert.equal(attempts[0].reason, 'invalid_token');
  assert.equal(db.saved.length, 0);
});

test('a mocked location is refused', async () => {
  const res = await scan({ isMockGps: true });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Mock location/);
  assert.equal(attempts[0].reason, 'mock_gps');
  assert.equal(db.saved.length, 0);
});

test('impossible coordinates are refused', async () => {
  const res = await scan({ latitude: 999, longitude: 5 });
  assert.equal(res.statusCode, 400);
  assert.equal(attempts[0].reason, 'bad_coordinates');
  assert.equal(db.saved.length, 0);
});

test('a scan from outside the zone is refused, and says how far away it was', async () => {
  const res = await scan({ latitude: metresNorth(1000) });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /outside the allowed area \(\d+m away\)/);
  assert.equal(attempts[0].reason, 'out_of_geofence');
  assert.ok(attempts[0].distance > 900, `distance ${attempts[0].distance}`);
  assert.equal(db.saved.length, 0);
});

test("the class's own radius is the one used", async () => {
  db.session.geo_radius = 300;
  const res = await scan({ latitude: metresNorth(200) });
  assert.equal(res.statusCode, 201);
});

test('after the late threshold the student is marked late', async () => {
  db.session.open_at = new Date(Date.now() - 20 * 60_000);
  const res = await scan();
  assert.equal(res.statusCode, 201);
  assert.equal(db.saved[0].status, 'late');
});

test('a second student on one phone is allowed without a flag', async () => {
  db.earlierOnDevice = [{ session_id: SESSION, device_id: 'phone-1', student_id: 'stu-2' }];
  const res = await scan();
  assert.equal(res.statusCode, 201);
  assert.equal(flags.length, 0);
});

test('a third student on one phone is marked, but the phone is flagged for review', async () => {
  db.earlierOnDevice = [
    { session_id: SESSION, device_id: 'phone-1', student_id: 'stu-2' },
    { session_id: SESSION, device_id: 'phone-1', student_id: 'stu-3' },
  ];
  const res = await scan();
  assert.equal(res.statusCode, 201);                       // a flag never blocks
  assert.equal(flags.length, 1);
  assert.equal(flags[0].students.length, 3);
  assert.ok(emitted.some(e => e.event === 'attendance:proxy_flag' && e.data.count === 3));
});

test('a double tap that slips past the duplicate check is still a duplicate, not a crash', async () => {
  const { Attendance } = require('../models');
  const original = Attendance.create;
  Attendance.create = async () => { const e = new Error('duplicate'); e.name = 'SequelizeUniqueConstraintError'; throw e; };
  try {
    const res = await scan();
    assert.equal(res.statusCode, 409);
  } finally {
    Attendance.create = original;
  }
});
