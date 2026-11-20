const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { logAudit } = require('../utils/audit');
const { studentSummary } = require('../utils/attendance');

router.use(authenticate);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function getFacultyId(userId, conn = db) {
  const [r] = await conn.query('SELECT id FROM faculty WHERE user_id = ?', [userId]);
  if (!r.length) throw new HttpError(403, 'Faculty profile not found');
  return r[0].id;
}

// Faculty may only act on class+subject pairs assigned to them
async function assertAssigned(conn, facultyId, classId, subjectId) {
  const [r] = await conn.query('SELECT id FROM faculty_assignments WHERE faculty_id=? AND class_id=? AND subject_id=?', [facultyId, classId, subjectId]);
  if (!r.length) throw new HttpError(403, 'You are not assigned to this class and subject');
}

// Admin: all assignments; Faculty: own assignments only
router.get('/my-assignments', authorize('admin', 'faculty'), asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'faculty') { where = 'WHERE fa.faculty_id = ?'; params.push(await getFacultyId(req.user.id)); }
  const [rows] = await db.query(
    `SELECT fa.id, fa.class_id AS classId, c.name AS className, fa.subject_id AS subjectId, sub.code AS subjectCode, sub.name AS subjectName
       FROM faculty_assignments fa JOIN classes c ON c.id = fa.class_id JOIN subjects sub ON sub.id = fa.subject_id ${where} ORDER BY c.name, sub.name`, params);
  res.json(rows);
}));

// Roster for a class/subject/date including any existing marks
router.get('/roster', authorize('admin', 'faculty'),
  query('classId').isInt({ min: 1 }), query('subjectId').isInt({ min: 1 }), query('date').isISO8601({ strict: true }).withMessage('Date must be YYYY-MM-DD'),
  validate,
  asyncHandler(async (req, res) => {
    const { classId, subjectId, date } = req.query;
    if (req.user.role === 'faculty') await assertAssigned(db, await getFacultyId(req.user.id), classId, subjectId);
    const [sess] = await db.query('SELECT id, status FROM attendance_sessions WHERE class_id=? AND subject_id=? AND session_date=?', [classId, subjectId, date]);
    const session = sess[0] || null;
    const [students] = await db.query(
      `SELECT s.id AS studentId, s.roll_no AS rollNo, s.full_name AS fullName, ar.status, ar.remarks
         FROM enrollments e JOIN students s ON s.id = e.student_id
         LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.session_id = ?
        WHERE e.class_id = ? ORDER BY s.roll_no`, [session ? session.id : 0, classId]);
    res.json({ session, students });
  }));

/**
 * Save (create or correct) attendance for one session inside a single transaction.
 * - UNIQUE(class_id, subject_id, session_date) and UNIQUE(session_id, student_id) prevent duplicates in the DB.
 * - Existing session => this is a correction; every changed record writes an audit_logs row (old/new).
 */
router.post('/save', authorize('faculty'),
  body('classId').isInt({ min: 1 }), body('subjectId').isInt({ min: 1 }),
  body('date').isISO8601({ strict: true }).withMessage('Date must be YYYY-MM-DD'),
  body('sessionStatus').optional().isIn(['held', 'cancelled']),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('records').isArray().withMessage('records must be an array'),
  body('records.*.studentId').isInt({ min: 1 }),
  body('records.*.status').isIn(['present', 'absent', 'leave']).withMessage('Status must be present, absent or leave'),
  body('records.*.remarks').optional({ nullable: true }).isString().isLength({ max: 255 }),
  validate,
  asyncHandler(async (req, res) => {
    const { classId, subjectId, date, reason } = req.body;
    const sessionStatus = req.body.sessionStatus || 'held';
    const records = req.body.records;
    if (date > todayStr()) throw new HttpError(400, 'Attendance cannot be marked for a future date');
    if (sessionStatus === 'held' && records.length === 0) throw new HttpError(400, 'Cannot save an empty attendance session');
    const ids = records.map((r) => Number(r.studentId));
    if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Duplicate student entries in request');

    const facultyId = await getFacultyId(req.user.id);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await assertAssigned(conn, facultyId, classId, subjectId);

      if (ids.length) {
        const [enrolled] = await conn.query('SELECT student_id FROM enrollments WHERE class_id = ? AND student_id IN (?)', [classId, ids]);
        if (enrolled.length !== ids.length) throw new HttpError(400, 'One or more students are not enrolled in this class');
      }

      // Lock/find existing session
      let [sess] = await conn.query('SELECT id, status FROM attendance_sessions WHERE class_id=? AND subject_id=? AND session_date=? FOR UPDATE', [classId, subjectId, date]);
      let sessionId, isCorrection = false;
      if (sess.length) {
        isCorrection = true;
        sessionId = sess[0].id;
        if (sess[0].status !== sessionStatus) {
          await conn.query('UPDATE attendance_sessions SET status = ? WHERE id = ?', [sessionStatus, sessionId]);
          await logAudit(conn, { userId: req.user.id, action: 'SESSION_STATUS_CHANGED', entity: 'attendance_session', entityId: sessionId, oldValue: { status: sess[0].status }, newValue: { status: sessionStatus, reason } });
        }
      } else {
        const [r] = await conn.query('INSERT INTO attendance_sessions (class_id, subject_id, faculty_id, session_date, status) VALUES (?,?,?,?,?)', [classId, subjectId, facultyId, date, sessionStatus]);
        sessionId = r.insertId;
      }

      const [existing] = await conn.query('SELECT student_id, status, remarks FROM attendance_records WHERE session_id = ?', [sessionId]);
      const existingMap = new Map(existing.map((e) => [e.student_id, e]));
      let created = 0, corrected = 0;
      for (const rec of records) {
        const sid = Number(rec.studentId);
        const remarks = rec.remarks || null;
        const old = existingMap.get(sid);
        if (!old) {
          await conn.query(
            `INSERT INTO attendance_records (session_id, student_id, status, remarks, marked_by) VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), marked_by = VALUES(marked_by)`,
            [sessionId, sid, rec.status, remarks, req.user.id]);
          created++;
          if (isCorrection) await logAudit(conn, { userId: req.user.id, action: 'ATTENDANCE_ADDED_LATE', entity: 'attendance_record', entityId: sessionId, newValue: { studentId: sid, status: rec.status, reason } });
        } else if (old.status !== rec.status || (old.remarks || null) !== remarks) {
          await conn.query('UPDATE attendance_records SET status=?, remarks=?, marked_by=? WHERE session_id=? AND student_id=?', [rec.status, remarks, req.user.id, sessionId, sid]);
          corrected++;
          await logAudit(conn, { userId: req.user.id, action: 'ATTENDANCE_CORRECTED', entity: 'attendance_record', entityId: sessionId,
            oldValue: { studentId: sid, status: old.status, remarks: old.remarks }, newValue: { studentId: sid, status: rec.status, remarks, reason } });
        }
      }
      if (!isCorrection) await logAudit(conn, { userId: req.user.id, action: 'SESSION_CREATED', entity: 'attendance_session', entityId: sessionId, newValue: { classId, subjectId, date, status: sessionStatus, records: created } });
      await conn.commit();
      res.status(isCorrection ? 200 : 201).json({ sessionId, created, corrected, isCorrection });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }));

// Session history for faculty (own assignments) / admin (all)
router.get('/history', authorize('admin', 'faculty'),
  query('classId').optional({ checkFalsy: true }).isInt(), query('subjectId').optional({ checkFalsy: true }).isInt(),
  query('from').optional({ checkFalsy: true }).isISO8601(), query('to').optional({ checkFalsy: true }).isISO8601(),
  validate,
  asyncHandler(async (req, res) => {
    const conds = [], params = [];
    if (req.user.role === 'faculty') {
      conds.push('EXISTS (SELECT 1 FROM faculty_assignments fa WHERE fa.faculty_id = ? AND fa.class_id = s.class_id AND fa.subject_id = s.subject_id)');
      params.push(await getFacultyId(req.user.id));
    }
    if (req.query.classId) { conds.push('s.class_id = ?'); params.push(req.query.classId); }
    if (req.query.subjectId) { conds.push('s.subject_id = ?'); params.push(req.query.subjectId); }
    if (req.query.from) { conds.push('s.session_date >= ?'); params.push(req.query.from); }
    if (req.query.to) { conds.push('s.session_date <= ?'); params.push(req.query.to); }
    const [rows] = await db.query(
      `SELECT s.id, s.session_date AS date, s.status AS sessionStatus, c.name AS className, sub.name AS subjectName, f.full_name AS facultyName,
              COALESCE(SUM(ar.status='present'),0) AS present, COALESCE(SUM(ar.status='absent'),0) AS absent, COALESCE(SUM(ar.status='leave'),0) AS \`leave\`
         FROM attendance_sessions s JOIN classes c ON c.id = s.class_id JOIN subjects sub ON sub.id = s.subject_id JOIN faculty f ON f.id = s.faculty_id
         LEFT JOIN attendance_records ar ON ar.session_id = s.id
        ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
        GROUP BY s.id, s.session_date, s.status, c.name, sub.name, f.full_name
        ORDER BY s.session_date DESC, s.id DESC LIMIT 500`, params);
    res.json(rows.map((r) => ({ ...r, present: Number(r.present), absent: Number(r.absent), leave: Number(r.leave) })));
  }));

// Audit trail of attendance changes: admin sees all, faculty sees only their own changes
router.get('/audit', authorize('admin', 'faculty'), asyncHandler(async (req, res) => {
  const params = [];
  let where = "WHERE a.entity IN ('attendance_session','attendance_record')";
  if (req.user.role === 'faculty') { where += ' AND a.user_id = ?'; params.push(req.user.id); }
  const [rows] = await db.query(
    `SELECT a.id, a.action, a.entity_id AS sessionId, a.old_value AS oldValue, a.new_value AS newValue, a.created_at AS createdAt, u.email AS changedBy
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${where} ORDER BY a.id DESC LIMIT 200`, params);
  res.json(rows);
}));

// ----- Student self-service (a student can only ever see their own data) -----
async function getStudentId(userId) {
  const [r] = await db.query('SELECT id FROM students WHERE user_id = ?', [userId]);
  if (!r.length) throw new HttpError(403, 'Student profile not found');
  return r[0].id;
}

router.get('/me/summary', authorize('student'), asyncHandler(async (req, res) => {
  res.json(await studentSummary(db, await getStudentId(req.user.id)));
}));

router.get('/me/history', authorize('student'),
  query('subjectId').optional({ checkFalsy: true }).isInt(), query('from').optional({ checkFalsy: true }).isISO8601(), query('to').optional({ checkFalsy: true }).isISO8601(),
  validate,
  asyncHandler(async (req, res) => {
    const conds = ['ar.student_id = ?'], params = [await getStudentId(req.user.id)];
    if (req.query.subjectId) { conds.push('s.subject_id = ?'); params.push(req.query.subjectId); }
    if (req.query.from) { conds.push('s.session_date >= ?'); params.push(req.query.from); }
    if (req.query.to) { conds.push('s.session_date <= ?'); params.push(req.query.to); }
    const [rows] = await db.query(
      `SELECT ar.id, s.session_date AS date, sub.name AS subjectName, sub.code AS subjectCode, s.status AS sessionStatus, ar.status, ar.remarks
         FROM attendance_records ar JOIN attendance_sessions s ON s.id = ar.session_id JOIN subjects sub ON sub.id = s.subject_id
        WHERE ${conds.join(' AND ')} ORDER BY s.session_date DESC, sub.name LIMIT 1000`, params);
    res.json(rows);
  }));

// Staff view of one student's summary (faculty only for students in classes they are assigned to)
router.get('/student/:id/summary', authorize('admin', 'faculty'), param('id').isInt(), validate, asyncHandler(async (req, res) => {
  if (req.user.role === 'faculty') {
    const [ok] = await db.query(
      `SELECT 1 FROM enrollments e JOIN faculty_assignments fa ON fa.class_id = e.class_id
        WHERE e.student_id = ? AND fa.faculty_id = ? LIMIT 1`, [req.params.id, await getFacultyId(req.user.id)]);
    if (!ok.length) throw new HttpError(403, 'This student is not in any of your classes');
  }
  res.json(await studentSummary(db, req.params.id));
}));

module.exports = router;
