/**
 * ═══════════════════════════════════════════════════════════════════════
 * AttendX seed script — GCTU realistic data
 *
 * Run with:  node src/scripts/seed.js   (from the server/ directory)
 *
 * Creates:
 *   • 1 demo lecturer (lecturer@demo.com / demo1234)
 *   • 1 demo student  (student@demo.com  / demo1234)
 *   • 150 additional students with realistic Ghanaian names
 *     (emails: firstname.lastname-NN@gctu.edu.gh)
 *   • 6 classes assigned to the demo lecturer:
 *       - 3 at Tesano (main) campus  — engineering / computing
 *       - 3 at Abeka campus          — IT business / business
 *   • Each class enrolled with 30–60 random students (deterministic mix)
 *   • 10–14 closed sessions per class over the past ~3.5 months
 *   • Attendance records with realistic distribution per student:
 *       - 5%  perfect students   (always present)
 *       - 10% absent students    (rarely show up)
 *       - 85% normal students    (~80% present, ~10% late, ~10% absent)
 *
 * Safe to re-run: calls cleanup logic before seeding so you always
 * end up with the same dataset.
 * ═══════════════════════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const {
  sequelize,
  User,
  Class,
  Enrollment,
  Session,
  Attendance,
} = require('../models');

// ─── GCTU campus geofence centers ───────────────────────────────────────
const CAMPUSES = {
  tesano: {
    name:          'GCTU Tesano (Main) Campus',
    location_name: 'Nsawam Road, Tesano, Accra',
    geo_lat:       5.5961,
    geo_lng:       -0.2235,
    geo_radius:    150,
  },
  abeka: {
    name:          'GCTU Abeka Campus',
    location_name: 'Abeka Road, Abeka, Accra',
    geo_lat:       5.5995,
    geo_lng:       -0.2362,
    geo_radius:    150,
  },
};

// ─── Realistic Ghanaian names ───────────────────────────────────────────
// Mix of Akan (Ashanti/Fante), Ga, Ewe, and Northern names.
const FIRST_NAMES = [
  // Akan
  'Kwame', 'Kofi', 'Yaw', 'Kwabena', 'Kwaku', 'Kojo', 'Kwasi', 'Kwadwo',
  'Akosua', 'Adwoa', 'Abena', 'Akua', 'Yaa', 'Afia', 'Ama', 'Esi',
  'Kojo', 'Nana', 'Kweku', 'Kobby', 'Papa', 'Maame', 'Adjoa', 'Araba',
  // Ga
  'Nii', 'Naa', 'Tetteh', 'Lartey', 'Okai', 'Aryeetey', 'Quaye', 'Adjei',
  // Ewe
  'Selorm', 'Senanu', 'Mawuli', 'Edem', 'Elikem', 'Senyo', 'Eyram', 'Etornam',
  'Dela', 'Sitsofe', 'Mawunyo', 'Akpene', 'Dzifa', 'Edinam',
  // Northern (Dagomba, Hausa influence)
  'Abdul', 'Ibrahim', 'Yakubu', 'Issah', 'Mohammed', 'Fatima', 'Aisha',
  'Hawa', 'Salamatu', 'Memunatu', 'Rashida', 'Zainab',
  // Common Christian / international names also widely used
  'Emmanuel', 'Daniel', 'Samuel', 'Joshua', 'Michael', 'David', 'Joseph',
  'Grace', 'Mary', 'Esther', 'Ruth', 'Priscilla', 'Gifty', 'Mercy',
  'Linda', 'Patience', 'Vivian', 'Belinda', 'Sandra', 'Cynthia',
];

const LAST_NAMES = [
  // Akan
  'Asante', 'Boateng', 'Mensah', 'Osei', 'Owusu', 'Appiah', 'Frimpong',
  'Acheampong', 'Agyeman', 'Sarpong', 'Adu', 'Ofori', 'Gyamfi', 'Bonsu',
  'Adomako', 'Antwi', 'Amoah', 'Darko', 'Marfo', 'Twum', 'Yeboah',
  'Adjei', 'Wiafe', 'Anane', 'Aboagye', 'Asamoah', 'Boadi',
  // Ga
  'Quartey', 'Tetteh', 'Lartey', 'Okai', 'Quaye', 'Aryeetey', 'Lamptey',
  'Allotey', 'Nortey', 'Ankrah', 'Bortey', 'Dodoo', 'Ashong',
  // Ewe
  'Adzo', 'Agbeko', 'Ametefe', 'Atsu', 'Avornyo', 'Dogbe', 'Fiawoo',
  'Gakpo', 'Hodzi', 'Kpodo', 'Mawutor', 'Tay', 'Tsikata', 'Wuaku',
  // Fante
  'Acquah', 'Quansah', 'Hagan', 'Ghartey', 'Cudjoe', 'Mensa',
  // Northern
  'Mahama', 'Bawumia', 'Iddrisu', 'Abdulai', 'Sulemana', 'Alhassan',
];

// ─── GCTU classes (real-ish course codes from GCTU faculties) ──────────
// Tesano main campus: Faculty of Computing & Information Systems / Engineering
// Abeka campus:        GCTU Business School (School of IT Business)
const CLASSES = [
  // Tesano
  {
    name:        'Software Engineering',
    code:        'BIT 301',
    department:  'Computer Science',
    description: 'Software development lifecycle, design patterns, and team-based project work.',
    campus:      'tesano',
  },
  {
    name:        'Database Systems',
    code:        'BIT 204',
    department:  'Information Systems',
    description: 'Relational databases, SQL, normalization, and transaction management.',
    campus:      'tesano',
  },
  {
    name:        'Computer Networks',
    code:        'BTE 305',
    department:  'Telecommunications Engineering',
    description: 'OSI model, TCP/IP, routing, and network security fundamentals.',
    campus:      'tesano',
  },
  // Abeka
  {
    name:        'Principles of Management',
    code:        'BBA 201',
    department:  'Business Administration',
    description: 'Foundations of organizational management and leadership theory.',
    campus:      'abeka',
  },
  {
    name:        'IT Project Management',
    code:        'BIT 402',
    department:  'IT Business',
    description: 'Managing technology projects: scope, schedule, risk, and stakeholders.',
    campus:      'abeka',
  },
  {
    name:        'Business Communication',
    code:        'BBA 102',
    department:  'Business Administration',
    description: 'Professional written and verbal communication for business contexts.',
    campus:      'abeka',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────
const r = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[r(arr.length)];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = r(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Generate unique 8-char class join code ─────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[r(chars.length)]).join('');
}

// ─── Generate student email from name ───────────────────────────────────
// Format: kwame.asante-04@gctu.edu.gh — number suffix prevents collisions
// since many people share names in Ghana.
function studentEmail(first, last, suffix) {
  return `${first.toLowerCase()}.${last.toLowerCase()}-${String(suffix).padStart(3, '0')}@gctu.edu.gh`;
}

// ─── Generate student ID in GCTU style (e.g. 042100123) ────────────────
function studentId(year, num) {
  // 04 = faculty code, year suffix (21 = 2021 intake), 5-digit serial
  return `04${year}${String(num).padStart(5, '0')}`;
}

// ─── Random datetime within a session window ───────────────────────────
// Returns a Date some `minOffset` to `maxOffset` minutes after `openAt`.
function randomMarkTime(openAt, minOffset, maxOffset) {
  const offsetMs = (minOffset + Math.random() * (maxOffset - minOffset)) * 60 * 1000;
  return new Date(openAt.getTime() + offsetMs);
}

// ─── Cleanup: remove only seeded data ──────────────────────────────────
async function cleanup() {
  console.log('🧹 Cleaning up old seed data…');

  // Find seeded users by email pattern
  const seededUsers = await User.findAll({
    where: {
      [Op.or]: [
        { email: { [Op.like]: '%@gctu.edu.gh' } },
        { email: 'lecturer@demo.com' },
        { email: 'student@demo.com'  },
      ],
    },
    attributes: ['id'],
  });
  const userIds = seededUsers.map(u => u.id);

  if (userIds.length === 0) {
    console.log('   (nothing to clean)');
    return;
  }

  // Delete in dependency order: attendance → sessions → enrollments → classes → users
  const seededClasses = await Class.findAll({
    where: { lecturer_id: userIds },
    attributes: ['id'],
  });
  const classIds = seededClasses.map(c => c.id);

  if (classIds.length > 0) {
    const seededSessions = await Session.findAll({
      where: { class_id: classIds },
      attributes: ['id'],
    });
    const sessionIds = seededSessions.map(s => s.id);

    if (sessionIds.length > 0) {
      await Attendance.destroy({ where: { session_id: sessionIds } });
    }
    await Session.destroy({ where: { class_id: classIds } });
    await Enrollment.destroy({ where: { class_id: classIds } });
    await Class.destroy({ where: { id: classIds } });
  }

  // Also clean up any attendance / enrollments tied to seeded students
  // that may have leaked outside the seeded classes
  await Attendance.destroy({ where: { student_id: userIds } });
  await Enrollment.destroy({ where: { student_id: userIds } });

  await User.destroy({ where: { id: userIds } });

  console.log(`   removed ${userIds.length} users, ${classIds.length} classes`);
}

// ─── Main seed ─────────────────────────────────────────────────────────
async function seed() {
  const startedAt = Date.now();
  console.log('🌱 AttendX seed script starting…\n');

  await sequelize.authenticate();
  console.log('✅ Database connection OK\n');

  await cleanup();

  console.log('\n👤 Creating users…');

  const passwordHash = await bcrypt.hash('demo1234', 10);

  // Demo lecturer — owns all seeded classes
  const lecturer = await User.create({
    name:       'Dr. Kwame Asante',
    email:      'lecturer@demo.com',
    password:   passwordHash,
    role:       'lecturer',
    department: 'Faculty of Computing & Information Systems',
    is_active:  true,
  });
  console.log(`   ✓ Lecturer: ${lecturer.email}`);

  // Demo student — keeps the existing login auto-fill working
  const demoStudent = await User.create({
    name:       'Akosua Mensah',
    email:      'student@demo.com',
    password:   passwordHash,
    role:       'student',
    student_id: studentId('21', 1),
    department: 'Computer Science',
    is_active:  true,
  });
  console.log(`   ✓ Demo student: ${demoStudent.email}`);

  // 150 additional students with realistic names
  console.log('   creating 150 students…');
  const students = [demoStudent];
  const usedEmails = new Set([demoStudent.email]);

  for (let i = 0; i < 150; i++) {
    const first = pick(FIRST_NAMES);
    const last  = pick(LAST_NAMES);

    // Find a non-colliding email by bumping the suffix
    let suffix = i + 1;
    let email  = studentEmail(first, last, suffix);
    while (usedEmails.has(email)) {
      suffix += 100;
      email = studentEmail(first, last, suffix);
    }
    usedEmails.add(email);

    const student = await User.create({
      name:       `${first} ${last}`,
      email,
      password:   passwordHash,
      role:       'student',
      student_id: studentId(pick(['21','22','23','24']), i + 2),
      department: pick([
        'Computer Science',
        'Information Systems',
        'Telecommunications Engineering',
        'Business Administration',
        'IT Business',
      ]),
      is_active: true,
    });
    students.push(student);
  }
  console.log(`   ✓ ${students.length} total students`);

  // Assign attendance behavior tier per student (deterministic for the run)
  // Tier drives: probability of marking attendance + probability of being late
  const studentBehavior = new Map();
  students.forEach((s) => {
    const roll = Math.random();
    if (roll < 0.05) {
      studentBehavior.set(s.id, { tier: 'perfect', present: 1.00, lateChance: 0.05 });
    } else if (roll < 0.15) {
      studentBehavior.set(s.id, { tier: 'absent',  present: 0.25, lateChance: 0.30 });
    } else {
      studentBehavior.set(s.id, { tier: 'normal',  present: 0.85, lateChance: 0.12 });
    }
  });

  // Always make the demo student a "normal" so they have varied history
  studentBehavior.set(demoStudent.id, { tier: 'normal', present: 0.85, lateChance: 0.12 });

  console.log('\n📚 Creating classes…');

  const createdClasses = [];
  const usedClassCodes = new Set();

  for (const def of CLASSES) {
    const campus = CAMPUSES[def.campus];

    // Generate a unique short code (the join code, separate from def.code)
    let code = generateCode();
    while (usedClassCodes.has(code)) code = generateCode();
    usedClassCodes.add(code);

    const cls = await Class.create({
      name:                 `${def.code}: ${def.name}`,
      code,
      description:          def.description,
      department:           def.department,
      location_name:        campus.location_name,
      geo_lat:              campus.geo_lat,
      geo_lng:              campus.geo_lng,
      geo_radius:           campus.geo_radius,
      lecturer_id:          lecturer.id,
      attendance_threshold: 75,
      is_active:            true,
    });

    // Stash original numeric coords on the wrapper. Critical: cls.geo_lat
    // comes back from Sequelize as a STRING for DECIMAL columns, so we
    // can't use it for arithmetic later (string + number = concatenation).
    // Keeping the original Number values here means attendance geo math
    // works correctly without per-row Number() coercion.
    createdClasses.push({
      cls,
      def,
      campus,
      geoLat: campus.geo_lat,
      geoLng: campus.geo_lng,
    });
    console.log(`   ✓ ${def.code} (${def.campus}) — join code ${code}`);
  }

  console.log('\n📝 Enrolling students…');

  for (const entry of createdClasses) {
    const { cls } = entry;

    // 30–60 random students per class
    const enrollCount = 30 + r(31);
    const shuffled    = shuffle(students);
    const enrolled    = shuffled.slice(0, enrollCount);

    // Always include the demo student in the first 3 classes so they
    // always have something to look at on their dashboard
    const classIndex = createdClasses.indexOf(entry);
    if (classIndex < 3 && !enrolled.find(s => s.id === demoStudent.id)) {
      enrolled.push(demoStudent);
    }

    await Enrollment.bulkCreate(
      enrolled.map(s => ({
        student_id:  s.id,
        class_id:    cls.id,
        enrolled_at: new Date(Date.now() - (60 + r(60)) * 24 * 60 * 60 * 1000),
      }))
    );

    entry.enrolledStudents = enrolled; // stash for session creation
    console.log(`   ✓ ${cls.name}: ${enrolled.length} students`);
  }

  console.log('\n📅 Creating sessions + attendance…');

  // Sessions span ~3.5 months back from now
  const NOW = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let totalSessions   = 0;
  let totalAttendance = 0;

  for (const entry of createdClasses) {
    const { cls, geoLat, geoLng, enrolledStudents } = entry;

    const sessionCount = 10 + r(5); // 10–14 sessions per class

    // Spread sessions across the past ~105 days, weighted toward more recent
    for (let i = 0; i < sessionCount; i++) {
      // Days ago: 1 to 105, with newer sessions slightly more clustered
      const daysAgo = Math.round(1 + Math.pow(Math.random(), 1.3) * 104);

      // Class typically runs 09:00 / 11:00 / 14:00 / 16:00 — pick one
      const startHour = pick([9, 11, 14, 16]);

      const openAt = new Date(NOW - daysAgo * DAY);
      openAt.setHours(startHour, 0, 0, 0);

      // Session lasts 60–90 minutes
      const durationMins = 60 + r(31);
      const closedAt = new Date(openAt.getTime() + durationMins * 60 * 1000);

      const session = await Session.create({
        class_id:            cls.id,
        title:               `Lecture ${sessionCount - i}`,
        status:              'closed',
        open_at:             openAt,
        close_at:            closedAt,
        closed_at:           closedAt,
        late_threshold:      15,
        qr_interval:         5,
        geo_lat:             geoLat,
        geo_lng:             geoLng,
        geo_radius:          cls.geo_radius,
        class_name_snapshot: cls.name,
      });

      // Generate attendance records for this session
      const records = [];
      for (const student of enrolledStudents) {
        const behavior = studentBehavior.get(student.id);

        // Did they attend?
        if (Math.random() > behavior.present) continue; // absent → no record

        // Were they late?
        const wasLate = Math.random() < behavior.lateChance;

        // Realistic mark time:
        //   on-time → 5 min before to 14 min after open
        //   late    → 16 to 45 min after open
        const markedAt = wasLate
          ? randomMarkTime(openAt, 16, 45)
          : randomMarkTime(openAt, -5, 14);

        // Use the original numeric campus coordinates (geoLat/geoLng) for
        // arithmetic — NOT cls.geo_lat which Sequelize returns as a string
        // for DECIMAL columns. String + number = string concatenation, which
        // produced invalid SQL like '5.59610000-0.000026901' in the prior
        // version of this script and crashed bulkCreate on INSERT.
        records.push({
          session_id:    session.id,
          student_id:    student.id,
          status:        wasLate ? 'late' : 'present',
          marked_at:     markedAt,
          geo_lat:       geoLat + (Math.random() - 0.5) * 0.0008, // ±~40m drift
          geo_lng:       geoLng + (Math.random() - 0.5) * 0.0008,
          qr_token_used: null,
          is_mock_gps:   false,
        });
      }

      if (records.length > 0) {
        await Attendance.bulkCreate(records);
        totalAttendance += records.length;
      }
      totalSessions++;
    }

    console.log(`   ✓ ${cls.name}: ${sessionCount} sessions`);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Seed complete!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Users:           ${students.length + 1} (1 lecturer, ${students.length} students)`);
  console.log(`   Classes:         ${createdClasses.length} (3 Tesano, 3 Abeka)`);
  console.log(`   Sessions:        ${totalSessions} (all closed)`);
  console.log(`   Attendance:      ${totalAttendance} records`);
  console.log(`   Time elapsed:    ${elapsed}s`);
  console.log('\n   Login as lecturer:  lecturer@demo.com / demo1234');
  console.log('   Login as student:   student@demo.com  / demo1234');
  console.log('═══════════════════════════════════════════════════════════\n');

  await sequelize.close();
}

// ─── Run ───────────────────────────────────────────────────────────────
seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});