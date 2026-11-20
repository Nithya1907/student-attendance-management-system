const router = require('express').Router();
const { body, param, query } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { logAudit } = require('../utils/audit');

router.use(authenticate);
const adminOnly = authorize('admin');
const staff = authorize('admin', 'faculty');

/**
 * Generic CRUD for simple lookup tables.
 * fields: [{ key: bodyKey, col: dbColumn }]; select must alias the table as `t` and return camelCase keys.
 */
function crud(path, { table, select, orderBy, fields, rules, entity }) {
  const selectOne = async (id) => (await db.query(`${select} WHERE t.id = ?`, [id]))[0][0];
  router.get(path, staff, asyncHandler(async (req, res) => {
    const [rows] = await db.query(`${select} ORDER BY ${orderBy}`);
    res.json(rows);
  }));
  router.post(path, adminOnly, ...rules, validate, asyncHandler(async (req, res) => {
    const cols = fields.map((f) => f.col);
    const [r] = await db.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, fields.map((f) => req.body[f.key] ?? null));
    await logAudit(db, { userId: req.user.id, action: `${entity.toUpperCase()}_CREATED`, entity, entityId: r.insertId, newValue: req.body });
    res.status(201).json(await selectOne(r.insertId));
  }));
  router.put(`${path}/:id`, adminOnly, param('id').isInt(), ...rules, validate, asyncHandler(async (req, res) => {
    const [r] = await db.query(`UPDATE ${table} SET ${fields.map((f) => `${f.col}=?`).join(',')} WHERE id=?`, [...fields.map((f) => req.body[f.key] ?? null), req.params.id]);
    if (!r.affectedRows && !(await selectOne(req.params.id))) throw new HttpError(404, `${entity} not found`);
    await logAudit(db, { userId: req.user.id, action: `${entity.toUpperCase()}_UPDATED`, entity, entityId: Number(req.params.id), newValue: req.body });
    res.json(await selectOne(req.params.id));
  }));
  router.delete(`${path}/:id`, adminOnly, param('id').isInt(), validate, asyncHandler(async (req, res) => {
    const [r] = await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!r.affectedRows) throw new HttpError(404, `${entity} not found`);
    await logAudit(db, { userId: req.user.id, action: `${entity.toUpperCase()}_DELETED`, entity, entityId: Number(req.params.id) });
    res.status(204).end();
  }));
}

const name = (min = 2) => body('name').trim().isLength({ min, max: 120 }).withMessage(`Name must be ${min}-120 characters`);
const code = body('code').trim().isLength({ min: 1, max: 20 }).withMessage('Code is required (max 20 chars)');

crud('/departments', {
  table: 'departments', entity: 'department', orderBy: 't.name',
  select: 'SELECT t.id, t.name, t.code FROM departments t',
  fields: [{ key: 'name', col: 'name' }, { key: 'code', col: 'code' }],
  rules: [name(), code],
});

crud('/academic-years', {
  table: 'academic_years', entity: 'academic_year', orderBy: 't.label DESC',
  select: 'SELECT t.id, t.label, t.is_current AS isCurrent FROM academic_years t',
  fields: [{ key: 'label', col: 'label' }, { key: 'isCurrent', col: 'is_current' }],
  rules: [body('label').trim().matches(/^\d{4}-\d{2,4}$/).withMessage('Use format 2025-26'), body('isCurrent').optional().isBoolean().toBoolean()],
});

crud('/classes', {
  table: 'classes', entity: 'class', orderBy: 't.name',
  select: `SELECT t.id, t.name, t.semester, t.department_id AS departmentId, d.name AS departmentName,
                  t.academic_year_id AS academicYearId, y.label AS academicYear,
                  (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = t.id) AS studentCount
             FROM classes t JOIN departments d ON d.id = t.department_id JOIN academic_years y ON y.id = t.academic_year_id`,
  fields: [{ key: 'name', col: 'name' }, { key: 'semester', col: 'semester' }, { key: 'departmentId', col: 'department_id' }, { key: 'academicYearId', col: 'academic_year_id' }],
  rules: [name(1), body('semester').isInt({ min: 1, max: 12 }).withMessage('Semester must be 1-12'),
    body('departmentId').isInt({ min: 1 }).withMessage('Department is required'), body('academicYearId').isInt({ min: 1 }).withMessage('Academic year is required')],
});

crud('/subjects', {
  table: 'subjects', entity: 'subject', orderBy: 't.code',
  select: 'SELECT t.id, t.code, t.name, t.department_id AS departmentId, d.name AS departmentName FROM subjects t JOIN departments d ON d.id = t.department_id',
  fields: [{ key: 'code', col: 'code' }, { key: 'name', col: 'name' }, { key: 'departmentId', col: 'department_id' }],
  rules: [name(), code, body('departmentId').isInt({ min: 1 }).withMessage('Department is required')],
});

// ---------- Enrollments ----------
router.get('/enrollments', adminOnly, query('classId').optional().isInt(), validate, asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.classId) { where = 'WHERE e.class_id = ?'; params.push(req.query.classId); }
  const [rows] = await db.query(
    `SELECT e.id, e.student_id AS studentId, s.roll_no AS rollNo, s.full_name AS studentName, e.class_id AS classId, c.name AS className
       FROM enrollments e JOIN students s ON s.id = e.student_id JOIN classes c ON c.id = e.class_id ${where} ORDER BY c.name, s.roll_no`, params);
  res.json(rows);
}));

router.post('/enrollments', adminOnly,
  body('classId').isInt({ min: 1 }), body('studentIds').isArray({ min: 1 }).withMessage('Select at least one student'), body('studentIds.*').isInt({ min: 1 }),
  validate,
  asyncHandler(async (req, res) => {
    const { classId, studentIds } = req.body;
    const [r] = await db.query('INSERT IGNORE INTO enrollments (student_id, class_id) VALUES ?', [studentIds.map((s) => [s, classId])]);
    await logAudit(db, { userId: req.user.id, action: 'ENROLLED', entity: 'class', entityId: Number(classId), newValue: { studentIds } });
    res.status(201).json({ added: r.affectedRows, skipped: studentIds.length - r.affectedRows });
  }));

router.delete('/enrollments/:id', adminOnly, param('id').isInt(), validate, asyncHandler(async (req, res) => {
  const [r] = await db.query('DELETE FROM enrollments WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Enrollment not found');
  await logAudit(db, { userId: req.user.id, action: 'UNENROLLED', entity: 'enrollment', entityId: Number(req.params.id) });
  res.status(204).end();
}));

// ---------- Faculty assignments ----------
router.get('/assignments', adminOnly, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT fa.id, fa.faculty_id AS facultyId, f.full_name AS facultyName, fa.class_id AS classId, c.name AS className,
            fa.subject_id AS subjectId, sub.code AS subjectCode, sub.name AS subjectName
       FROM faculty_assignments fa JOIN faculty f ON f.id = fa.faculty_id JOIN classes c ON c.id = fa.class_id JOIN subjects sub ON sub.id = fa.subject_id
      ORDER BY f.full_name, c.name`);
  res.json(rows);
}));

router.post('/assignments', adminOnly,
  body('facultyId').isInt({ min: 1 }), body('classId').isInt({ min: 1 }), body('subjectId').isInt({ min: 1 }),
  validate,
  asyncHandler(async (req, res) => {
    const { facultyId, classId, subjectId } = req.body;
    const [r] = await db.query('INSERT INTO faculty_assignments (faculty_id, class_id, subject_id) VALUES (?,?,?)', [facultyId, classId, subjectId]);
    await logAudit(db, { userId: req.user.id, action: 'ASSIGNED', entity: 'assignment', entityId: r.insertId, newValue: req.body });
    res.status(201).json({ id: r.insertId });
  }));

router.delete('/assignments/:id', adminOnly, param('id').isInt(), validate, asyncHandler(async (req, res) => {
  const [r] = await db.query('DELETE FROM faculty_assignments WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Assignment not found');
  await logAudit(db, { userId: req.user.id, action: 'UNASSIGNED', entity: 'assignment', entityId: Number(req.params.id) });
  res.status(204).end();
}));

// ---------- Settings ----------
router.get('/settings', asyncHandler(async (req, res) => {
  const [rows] = await db.query("SELECT setting_value FROM settings WHERE setting_key='attendance_threshold'");
  res.json({ attendanceThreshold: rows.length ? Number(rows[0].setting_value) : 75 });
}));

router.put('/settings', adminOnly, body('attendanceThreshold').isFloat({ min: 1, max: 100 }).withMessage('Threshold must be between 1 and 100'), validate,
  asyncHandler(async (req, res) => {
    await db.query("INSERT INTO settings (setting_key, setting_value) VALUES ('attendance_threshold', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [String(req.body.attendanceThreshold)]);
    await logAudit(db, { userId: req.user.id, action: 'SETTINGS_UPDATED', entity: 'settings', newValue: req.body });
    res.json({ attendanceThreshold: Number(req.body.attendanceThreshold) });
  }));

module.exports = router;
