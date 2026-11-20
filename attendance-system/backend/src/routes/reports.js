const router = require('express').Router();
const { query } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { calcPercentage } = require('../utils/attendance');

router.use(authenticate, authorize('admin', 'faculty'));

const rules = [
  query('view').optional().isIn(['subject', 'daily', 'weekly', 'monthly']),
  query('classId').optional({ checkFalsy: true }).isInt(),
  query('subjectId').optional({ checkFalsy: true }).isInt(),
  query('from').optional({ checkFalsy: true }).isISO8601({ strict: true }),
  query('to').optional({ checkFalsy: true }).isISO8601({ strict: true }),
  validate,
];

// Builds the shared WHERE clause. Only HELD sessions are eligible (cancelled excluded).
async function buildFilter(req) {
  const conds = ["s.status = 'held'"], params = [];
  if (req.user.role === 'faculty') {
    const [f] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    if (!f.length) throw new HttpError(403, 'Faculty profile not found');
    conds.push('EXISTS (SELECT 1 FROM faculty_assignments fa WHERE fa.faculty_id = ? AND fa.class_id = s.class_id AND fa.subject_id = s.subject_id)');
    params.push(f[0].id);
  }
  const q = req.query;
  if (q.classId) { conds.push('s.class_id = ?'); params.push(q.classId); }
  if (q.subjectId) { conds.push('s.subject_id = ?'); params.push(q.subjectId); }
  if (q.from) { conds.push('s.session_date >= ?'); params.push(q.from); }
  if (q.to) { conds.push('s.session_date <= ?'); params.push(q.to); }
  return { where: conds.join(' AND '), params };
}

async function runReport(req) {
  const view = req.query.view || 'subject';
  const { where, params } = await buildFilter(req);
  const sums = `SUM(ar.status='present') AS present, SUM(ar.status='absent') AS absent, SUM(ar.status='leave') AS \`leave\``;
  const base = `FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id JOIN students st ON st.id = ar.student_id
                JOIN subjects sub ON sub.id = s.subject_id JOIN classes c ON c.id = s.class_id WHERE ${where}`;
  let rows;
  if (view === 'subject') {
    [rows] = await db.query(`SELECT st.roll_no AS rollNo, st.full_name AS studentName, c.name AS className, sub.code AS subjectCode, sub.name AS subjectName, ${sums}
      ${base} GROUP BY st.id, st.roll_no, st.full_name, c.name, sub.id, sub.code, sub.name ORDER BY c.name, sub.name, st.roll_no`, params);
  } else {
    const label = { daily: 's.session_date', weekly: "DATE_FORMAT(DATE_SUB(s.session_date, INTERVAL WEEKDAY(s.session_date) DAY), '%Y-%m-%d')", monthly: "DATE_FORMAT(s.session_date, '%Y-%m')" }[view];
    [rows] = await db.query(`SELECT ${label} AS period, ${sums} ${base} GROUP BY period ORDER BY period`, params);
  }
  return rows.map((r) => {
    const present = Number(r.present), absent = Number(r.absent), leave = Number(r.leave);
    return { ...r, present, absent, leave, eligible: present + absent + leave, percentage: calcPercentage(present, absent, leave) };
  });
}

router.get('/attendance', ...rules, asyncHandler(async (req, res) => res.json(await runReport(req))));

// CSV export. Cells starting with = + - @ are prefixed to block spreadsheet formula injection.
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/export', ...rules, asyncHandler(async (req, res) => {
  const view = req.query.view || 'subject';
  const rows = await runReport(req);
  const cols = view === 'subject'
    ? ['rollNo', 'studentName', 'className', 'subjectCode', 'subjectName', 'present', 'absent', 'leave', 'eligible', 'percentage']
    : ['period', 'present', 'absent', 'leave', 'eligible', 'percentage'];
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${view}-report.csv"`);
  res.send(csv);
}));

module.exports = router;
