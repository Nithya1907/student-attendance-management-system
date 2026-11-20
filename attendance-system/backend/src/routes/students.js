const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { logAudit } = require('../utils/audit');

router.use(authenticate, authorize('admin'));

const SELECT = `SELECT s.id, s.user_id AS userId, s.roll_no AS rollNo, s.full_name AS fullName, s.phone,
       s.department_id AS departmentId, d.name AS departmentName, u.email, u.is_active AS isActive,
       (SELECT GROUP_CONCAT(c.name SEPARATOR ', ') FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.student_id = s.id) AS classes
  FROM students s JOIN users u ON u.id = s.user_id JOIN departments d ON d.id = s.department_id`;

const rules = [
  body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Full name must be 2-120 characters'),
  body('rollNo').trim().isLength({ min: 1, max: 30 }).withMessage('Roll number is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).matches(/^[0-9+\-\s]{7,20}$/).withMessage('Invalid phone number'),
  body('departmentId').isInt({ min: 1 }).withMessage('Department is required'),
];

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(`${SELECT} ORDER BY s.roll_no`);
  res.json(rows.map((r) => ({ ...r, isActive: !!r.isActive })));
}));

router.get('/:id', param('id').isInt(), validate, asyncHandler(async (req, res) => {
  const [rows] = await db.query(`${SELECT} WHERE s.id = ?`, [req.params.id]);
  if (!rows.length) throw new HttpError(404, 'Student not found');
  res.json(rows[0]);
}));

router.post('/', ...rules,
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  asyncHandler(async (req, res) => {
    const b = req.body;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [u] = await conn.query('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)', [b.email, await bcrypt.hash(b.password, 10), 'student']);
      const [s] = await conn.query('INSERT INTO students (user_id, roll_no, full_name, phone, department_id) VALUES (?,?,?,?,?)',
        [u.insertId, b.rollNo, b.fullName, b.phone || null, b.departmentId]);
      await logAudit(conn, { userId: req.user.id, action: 'STUDENT_CREATED', entity: 'student', entityId: s.insertId, newValue: { rollNo: b.rollNo, email: b.email } });
      await conn.commit();
      res.status(201).json({ id: s.insertId });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }));

router.put('/:id', param('id').isInt(), ...rules, validate, asyncHandler(async (req, res) => {
  const b = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT id, user_id FROM students WHERE id = ?', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Student not found');
    await conn.query('UPDATE students SET roll_no=?, full_name=?, phone=?, department_id=? WHERE id=?',
      [b.rollNo, b.fullName, b.phone || null, b.departmentId, req.params.id]);
    await conn.query('UPDATE users SET email=? WHERE id=?', [b.email, rows[0].user_id]);
    await logAudit(conn, { userId: req.user.id, action: 'STUDENT_UPDATED', entity: 'student', entityId: Number(req.params.id), newValue: { rollNo: b.rollNo, email: b.email } });
    await conn.commit();
    res.json({ message: 'Student updated' });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.delete('/:id', param('id').isInt(), validate, asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT user_id, roll_no FROM students WHERE id = ?', [req.params.id]);
  if (!rows.length) throw new HttpError(404, 'Student not found');
  await db.query('DELETE FROM users WHERE id = ?', [rows[0].user_id]); // cascades to student, enrollments, records
  await logAudit(db, { userId: req.user.id, action: 'STUDENT_DELETED', entity: 'student', entityId: Number(req.params.id), oldValue: { rollNo: rows[0].roll_no } });
  res.status(204).end();
}));

module.exports = router;
