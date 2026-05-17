/**
 * ═══════════════════════════════════════════════════════════════════════
 * AttendX cleanup script — removes seeded data only
 *
 * Run with:  node server/scripts/cleanup.js
 *
 * What gets deleted:
 *   • Users with @gctu.edu.gh emails
 *   • lecturer@demo.com and student@demo.com
 *   • All their classes, enrollments, sessions, attendance records
 *
 * What is PRESERVED:
 *   • Any user account you've manually created with a different email
 *   • Real classes / sessions / enrollments tied to those accounts
 *   • Notifications, appeals, schedules — those models live on
 *
 * Use this if you want a clean DB without re-seeding immediately.
 * The seed script also calls this same logic before seeding, so you
 * don't need to run cleanup separately just to re-seed.
 * ═══════════════════════════════════════════════════════════════════════
 */

const { Op } = require('sequelize');

const {
  sequelize,
  User,
  Class,
  Enrollment,
  Session,
  Attendance,
} = require('../src/models');

async function cleanup() {
  const startedAt = Date.now();
  console.log('🧹 AttendX cleanup script starting…\n');

  await sequelize.authenticate();
  console.log('✅ Database connection OK\n');

  // Find seeded users by email pattern
  const seededUsers = await User.findAll({
    where: {
      [Op.or]: [
        { email: { [Op.like]: '%@gctu.edu.gh' } },
        { email: 'lecturer@demo.com' },
        { email: 'student@demo.com'  },
      ],
    },
    attributes: ['id', 'email'],
  });

  if (seededUsers.length === 0) {
    console.log('ℹ️  No seeded users found — database is already clean.\n');
    await sequelize.close();
    return;
  }

  const userIds = seededUsers.map(u => u.id);
  console.log(`📋 Found ${seededUsers.length} seeded users to remove\n`);

  // Find all classes owned by seeded lecturers
  const seededClasses = await Class.findAll({
    where: { lecturer_id: userIds },
    attributes: ['id', 'name'],
  });
  const classIds = seededClasses.map(c => c.id);

  console.log(`📚 Found ${classIds.length} classes belonging to seeded lecturers`);

  // Delete attendance + sessions + enrollments + classes (in order)
  let deletedAttendance = 0;
  let deletedSessions   = 0;
  let deletedEnrollments = 0;
  let deletedClasses    = 0;

  if (classIds.length > 0) {
    const seededSessions = await Session.findAll({
      where: { class_id: classIds },
      attributes: ['id'],
    });
    const sessionIds = seededSessions.map(s => s.id);

    if (sessionIds.length > 0) {
      deletedAttendance = await Attendance.destroy({ where: { session_id: sessionIds } });
      console.log(`   ✓ deleted ${deletedAttendance} attendance records`);
    }

    deletedSessions = await Session.destroy({ where: { class_id: classIds } });
    console.log(`   ✓ deleted ${deletedSessions} sessions`);

    deletedEnrollments = await Enrollment.destroy({ where: { class_id: classIds } });
    console.log(`   ✓ deleted ${deletedEnrollments} enrollments`);

    deletedClasses = await Class.destroy({ where: { id: classIds } });
    console.log(`   ✓ deleted ${deletedClasses} classes`);
  }

  // Catch any stragglers — attendance/enrollments that reference seeded
  // students but exist outside the seeded class set (shouldn't happen
  // normally, but defensive cleanup avoids orphaned rows)
  const orphanAttendance  = await Attendance.destroy({ where: { student_id: userIds } });
  const orphanEnrollments = await Enrollment.destroy({ where: { student_id: userIds } });

  if (orphanAttendance > 0)
    console.log(`   ✓ deleted ${orphanAttendance} orphan attendance records`);
  if (orphanEnrollments > 0)
    console.log(`   ✓ deleted ${orphanEnrollments} orphan enrollments`);

  // Finally remove the user accounts themselves
  const deletedUsers = await User.destroy({ where: { id: userIds } });
  console.log(`   ✓ deleted ${deletedUsers} users`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Cleanup complete!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Users:           ${deletedUsers}`);
  console.log(`   Classes:         ${deletedClasses}`);
  console.log(`   Sessions:        ${deletedSessions}`);
  console.log(`   Enrollments:     ${deletedEnrollments + orphanEnrollments}`);
  console.log(`   Attendance:      ${deletedAttendance + orphanAttendance}`);
  console.log(`   Time elapsed:    ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await sequelize.close();
}

cleanup().catch((err) => {
  console.error('\n❌ Cleanup failed:', err);
  process.exit(1);
});