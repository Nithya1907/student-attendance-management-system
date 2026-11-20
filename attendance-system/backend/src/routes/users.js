const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');
const { logAudit } = require('../utils/audit');

router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.role, u.is_active AS isActive, u.created_at AS createdAt,
            COALESCE(s.full_name, f.full_name, 'Administrator') AS fullName
       FROM users u LEFT JOIN students s ON s.user_id = u.id LEFT JOIN faculty f ON f.user_id = u.id
      ORDER BY u.id`);
  res.json(rows.map((r) => ({ ...r, isActive: !!r.isActive })));
}));

// Creates an ADMIN account (students/faculty accounts are created with their profiles)
router.post('/',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  asyncHandler(async (req, res) => {
    const [r] = await db.query('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)',
      [req.body.email, await bcrypt.hash(req.body.password, 10), 'admin']);
    await logAudit(db, { userId: req.user.id, action: 'USER_CREATED', entity: 'user', entityId: r.insertId, newValue: { email: req.body.email, role: 'admin' } });
    res.status(201).json({ id: r.insertId });
  }));

router.patch('/:id',
  param('id').isInt(),
  body('role').optional().isIn(['admin', 'faculty', 'student']),
  body('isActive').optional().isBoolean(),
  validate,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await db.query('SELECT id, role, is_active FROM users WHERE id = ?', [id]);
    if (!rows.length) throw new HttpError(404, 'User not found');
    const u = rows[0];
    if (id === req.user.id && (req.body.isActive === false || (req.body.role && req.body.role !== 'admin')))
      throw new HttpError(400, 'You cannot disable or demote your own account');
    if (req.body.role && req.body.role !== u.role) {
      // Student/faculty accounts own a profile row, so their role is fixed; only profile-less accounts may change.
      const [p] = await db.query('SELECT (SELECT COUNT(*) FROM students WHERE user_id=?) + (SELECT COUNT(*) FROM faculty WHERE user_id=?) AS c', [id, id]);
      if (p[0].c > 0 || req.body.role !== 'admin')
        throw new HttpError(400, 'Role cannot be changed for accounts that own a student/faculty profile');
    }
    const role = req.body.role || u.role;
    const active = req.body.isActive === undefined ? u.is_active : (req.body.isActive ? 1 : 0);
    await db.query('UPDATE users SET role = ?, is_active = ? WHERE id = ?', [role, active, id]);
    await logAudit(db, { userId: req.user.id, action: 'USER_UPDATED', entity: 'user', entityId: id, oldValue: { role: u.role, isActive: !!u.is_active }, newValue: { role, isActive: !!active } });
    res.json({ message: 'User updated' });
  }));

router.post('/:id/reset-password',
  param('id').isInt(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  asyncHandler(async (req, res) => {
    const [r] = await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(req.body.password, 10), req.params.id]);
    if (!r.affectedRows) throw new HttpError(404, 'User not found');
    await logAudit(db, { userId: req.user.id, action: 'PASSWORD_RESET', entity: 'user', entityId: Number(req.params.id) });
    res.json({ message: 'Password reset' });
  }));

module.exports = router;
