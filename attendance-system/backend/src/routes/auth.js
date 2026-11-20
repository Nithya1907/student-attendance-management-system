
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/error');

async function loadProfile(user) {
  if (user.role === 'student') {
    const [rows] = await db.query(
      `SELECT s.id, s.roll_no AS rollNo,
              s.full_name AS fullName, s.phone,
              d.name AS department
       FROM students s
       JOIN departments d ON d.id = s.department_id
       WHERE s.user_id = ?`,
      [user.id]
    );
    return rows[0] || null;
  }

  if (user.role === 'faculty') {
    const [rows] = await db.query(
      `SELECT f.id, f.employee_id AS employeeId,
              f.full_name AS fullName, f.phone,
              d.name AS department
       FROM faculty f
       JOIN departments d ON d.id = f.department_id
       WHERE f.user_id = ?`,
      [user.id]
    );
    return rows[0] || null;
  }

  return { fullName: 'Administrator' };
}

// List departments for student registration
router.get('/departments', asyncHandler(async (req, res) => {
  const [departments] = await db.query(
    'SELECT id, name, code FROM departments ORDER BY name'
  );

  res.json(departments);
}));

// Register a new student account
router.post(
  '/register',
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters'),

  body('rollNo')
    .trim()
    .notEmpty()
    .isLength({ max: 30 })
    .withMessage('Enter a valid roll number'),

  body('email')
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  body('departmentId')
    .isInt({ min: 1 })
    .withMessage('Select a department'),

  validate,

  asyncHandler(async (req, res) => {
    const { fullName, rollNo, email, password } = req.body;
    const departmentId = Number(req.body.departmentId);

    const [existingEmail] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.length) {
      throw new HttpError(
        409,
        'This email is already registered. Please sign in.'
      );
    }

    const [existingRoll] = await db.query(
      'SELECT id FROM students WHERE roll_no = ?',
      [rollNo]
    );

    if (existingRoll.length) {
      throw new HttpError(
        409,
        'This roll number is already registered.'
      );
    }

    const [departments] = await db.query(
      'SELECT id FROM departments WHERE id = ?',
      [departmentId]
    );

    if (!departments.length) {
      throw new HttpError(400, 'Please select a valid department.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const passwordHash = await bcrypt.hash(password, 10);

      const [userResult] = await connection.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES (?, ?, 'student')`,
        [email, passwordHash]
      );

      await connection.query(
        `INSERT INTO students
          (user_id, roll_no, full_name, department_id)
         VALUES (?, ?, ?, ?)`,
        [userResult.insertId, rollNo, fullName, departmentId]
      );

      await connection.commit();

      res.status(201).json({
        message: 'Account created successfully. You can now sign in.'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

// Login
router.post(
  '/login',
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .isString()
    .notEmpty()
    .withMessage('Password is required'),

  validate,

  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const user = rows[0];

    const ok =
      user &&
      user.is_active &&
      await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: await loadProfile(user)
      }
    });
  })
);

// Get the currently logged-in user's profile
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      profile: await loadProfile(req.user)
    });
  })
);

// Change password
router.put(
  '/password',
  authenticate,

  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),

  validate,

  asyncHandler(async (req, res) => {
    const [rows] = await db.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(
        req.body.currentPassword,
        rows[0].password_hash
      ))
    ) {
      throw new HttpError(400, 'Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(
      req.body.newPassword,
      10
    );

    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, req.user.id]
    );

    res.json({ message: 'Password updated' });
  })
);

module.exports = router;
