const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { studentSummary, calcPercentage, getThreshold } = require('../utils/attendance');

router.use(authenticate);

const num = (v) => Number(v || 0);

router.get('/', asyncHandler(async (req, res) => {
  const role = req.user.role;

  if (role === 'student') {
    const [s] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    const summary = await studentSummary(db, s[0].id);
    const [trend] = await db.query(
      `SELECT DATE_FORMAT(s.session_date,'%Y-%m') AS month, SUM(ar.status='present') AS present, COUNT(*) AS eligible
         FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id AND s.status='held'
        WHERE ar.student_id = ? GROUP BY month ORDER BY month`, [s[0].id]);
    return res.json({ role, ...summary, trend: trend.map((t) => ({ month: t.month, percentage: calcPercentage(num(t.present), num(t.eligible) - num(t.present), 0) })) });
  }

  if (role === 'faculty') {
    const [f] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    const fid = f[0].id;
    const [assignments] = await db.query(
      `SELECT fa.class_id AS classId, c.name AS className, fa.subject_id AS subjectId, sub.name AS subjectName,
              (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = fa.class_id) AS students,
              (SELECT COUNT(*) FROM attendance_sessions s WHERE s.class_id = fa.class_id AND s.subject_id = fa.subject_id AND s.status='held') AS sessions,
              (SELECT COALESCE(SUM(ar.status='present'),0) FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id
                WHERE s.class_id = fa.class_id AND s.subject_id = fa.subject_id AND s.status='held') AS present,
              (SELECT COUNT(*) FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id
                WHERE s.class_id = fa.class_id AND s.subject_id = fa.subject_id AND s.status='held') AS eligible
         FROM faculty_assignments fa JOIN classes c ON c.id = fa.class_id JOIN subjects sub ON sub.id = fa.subject_id WHERE fa.faculty_id = ?`, [fid]);
    const [[today]] = await db.query("SELECT COUNT(*) AS c FROM attendance_sessions WHERE faculty_id = ? AND session_date = CURDATE()", [fid]);
    return res.json({
      role, sessionsToday: today.c, classes: new Set(assignments.map((a) => a.classId)).size, subjects: new Set(assignments.map((a) => a.subjectId)).size,
      assignments: assignments.map((a) => ({ ...a, students: num(a.students), sessions: num(a.sessions), percentage: calcPercentage(num(a.present), num(a.eligible) - num(a.present), 0) })),
    });
  }

  // admin
  const [[counts]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM students) AS students, (SELECT COUNT(*) FROM faculty) AS faculty,
            (SELECT COUNT(*) FROM classes) AS classes, (SELECT COUNT(*) FROM subjects) AS subjects,
            (SELECT COUNT(*) FROM departments) AS departments`);
  const [[tot]] = await db.query(
    `SELECT COALESCE(SUM(ar.status='present'),0) AS present, COALESCE(SUM(ar.status='absent'),0) AS absent, COALESCE(SUM(ar.status='leave'),0) AS \`leave\`
       FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id AND s.status='held'`);
  const [daily] = await db.query(
    `SELECT s.session_date AS date, SUM(ar.status='present') AS present, SUM(ar.status='absent') AS absent, SUM(ar.status='leave') AS \`leave\`
       FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id AND s.status='held'
      WHERE s.session_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) GROUP BY s.session_date ORDER BY s.session_date`);
  const [byClass] = await db.query(
    `SELECT c.name AS className, SUM(ar.status='present') AS present, COUNT(*) AS eligible
       FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id AND s.status='held' JOIN classes c ON c.id = s.class_id GROUP BY c.id, c.name`);
  const present = num(tot.present), absent = num(tot.absent), leave = num(tot.leave);
  res.json({
    role, counts, threshold: await getThreshold(db),
    totals: { present, absent, leave, percentage: calcPercentage(present, absent, leave) },
    daily: daily.map((d) => ({ date: d.date, present: num(d.present), absent: num(d.absent), leave: num(d.leave), percentage: calcPercentage(num(d.present), num(d.absent), num(d.leave)) })),
    byClass: byClass.map((c) => ({ className: c.className, percentage: calcPercentage(num(c.present), num(c.eligible) - num(c.present), 0) })),
  });
}));

module.exports = router;
