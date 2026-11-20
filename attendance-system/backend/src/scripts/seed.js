/**
 * Creates the schema (database/schema.sql) and loads sample data with bcrypt-hashed passwords.
 * WARNING: wipes all existing data in the configured database. Usage: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let seedVal = 42;
const rand = () => { seedVal = (seedVal * 1664525 + 1013904223) % 4294967296; return seedVal / 4294967296; };

(async () => {
  const dbName = process.env.DB_NAME || 'attendance_db';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true,
  });
  try {
    let schema = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
    schema = schema.replace(/attendance_db/g, dbName);
    await conn.query(schema);
    await conn.query(`USE \`${dbName}\``);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['audit_logs', 'attendance_records', 'attendance_sessions', 'faculty_assignments', 'enrollments', 'students', 'faculty', 'subjects', 'classes', 'academic_years', 'departments', 'users']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const hash = async (p) => bcrypt.hash(p, 10);
    const [adminHash, facHash, stuHash] = await Promise.all([hash('Admin@123'), hash('Faculty@123'), hash('Student@123')]);

    await conn.query("INSERT INTO departments (id, name, code) VALUES (1,'Computer Science & Engineering','CSE'),(2,'Electronics & Communication','ECE')");
    await conn.query("INSERT INTO academic_years (id, label, is_current) VALUES (1,'2024-25',0),(2,'2025-26',1)");
    await conn.query("INSERT INTO classes (id, name, semester, department_id, academic_year_id) VALUES (1,'CSE-A Sem 5',5,1,2),(2,'CSE-B Sem 5',5,1,2)");
    await conn.query(`INSERT INTO subjects (id, code, name, department_id) VALUES
      (1,'CS501','Software Engineering',1),(2,'CS502','Database Systems',1),(3,'CS503','Operating Systems',1),
      (4,'CS504','Computer Networks',1),(5,'CS505','Web Technologies',1)`);

    await conn.query("INSERT INTO users (id, email, password_hash, role) VALUES (1,'admin@college.edu',?, 'admin')", [adminHash]);

    const facultyNames = ['Dr. Anita Rao', 'Prof. Rahul Mehta', 'Dr. Sunita Verma'];
    for (let i = 0; i < facultyNames.length; i++) {
      const [u] = await conn.query("INSERT INTO users (email, password_hash, role) VALUES (?,?, 'faculty')", [`faculty${i + 1}@college.edu`, facHash]);
      await conn.query('INSERT INTO faculty (id, user_id, employee_id, full_name, phone, department_id) VALUES (?,?,?,?,?,1)',
        [i + 1, u.insertId, `EMP10${i + 1}`, facultyNames[i], `98765432${10 + i}`]);
    }

    const first = ['Aarav', 'Diya', 'Rohan', 'Sneha', 'Karthik', 'Priya', 'Arjun', 'Meera', 'Vikram', 'Ananya', 'Rahul', 'Kavya', 'Siddharth', 'Ishita', 'Manoj', 'Pooja', 'Nikhil', 'Divya', 'Suresh', 'Lakshmi'];
    const last = ['Sharma', 'Reddy', 'Patel', 'Nair', 'Gupta', 'Iyer', 'Singh', 'Rao', 'Kumar', 'Joshi'];
    for (let i = 1; i <= 20; i++) {
      const [u] = await conn.query("INSERT INTO users (email, password_hash, role) VALUES (?,?, 'student')", [`student${i}@college.edu`, stuHash]);
      await conn.query('INSERT INTO students (id, user_id, roll_no, full_name, phone, department_id) VALUES (?,?,?,?,?,1)',
        [i, u.insertId, `CSE25${String(i).padStart(3, '0')}`, `${first[i - 1]} ${last[i % 10]}`, `90000000${String(i).padStart(2, '0')}`]);
      await conn.query('INSERT INTO enrollments (student_id, class_id) VALUES (?,?)', [i, i <= 10 ? 1 : 2]);
    }

    // [facultyId, classId, subjectId]
    const assignments = [[1, 1, 1], [1, 2, 1], [1, 1, 2], [2, 1, 3], [2, 2, 3], [2, 2, 4], [3, 1, 5], [3, 2, 5], [3, 2, 2]];
    await conn.query('INSERT INTO faculty_assignments (faculty_id, class_id, subject_id) VALUES ?', [assignments]);

    // ~6 weeks of weekday sessions. Students 3 and 7 are deliberately low attenders (<75%).
    const propensity = (sid) => (sid === 3 ? 0.45 : sid === 7 ? 0.6 : 0.88);
    const today = new Date();
    let sessionCount = 0, recordCount = 0;
    for (let back = 42; back >= 1; back--) {
      const d = new Date(today); d.setDate(d.getDate() - back);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      for (let a = 0; a < assignments.length; a++) {
        if ((back + a) % 2 !== 0) continue;
        const [fid, cid, sub] = assignments[a];
        const cancelled = rand() < 0.06;
        const [s] = await conn.query('INSERT INTO attendance_sessions (class_id, subject_id, faculty_id, session_date, status) VALUES (?,?,?,?,?)',
          [cid, sub, fid, ymd(d), cancelled ? 'cancelled' : 'held']);
        sessionCount++;
        if (cancelled) continue;
        const [[fac]] = await conn.query('SELECT user_id FROM faculty WHERE id = ?', [fid]);
        const rows = [];
        for (let st = cid === 1 ? 1 : 11; st <= (cid === 1 ? 10 : 20); st++) {
          const r = rand();
          const status = r < propensity(st) ? 'present' : (r < propensity(st) + 0.05 ? 'leave' : 'absent');
          rows.push([s.insertId, st, status, fac.user_id]);
        }
        await conn.query('INSERT INTO attendance_records (session_id, student_id, status, marked_by) VALUES ?', [rows]);
        recordCount += rows.length;
      }
    }
    console.log(`Seed complete: ${sessionCount} sessions, ${recordCount} attendance records.`);
    console.log('Logins -> admin@college.edu / Admin@123 | faculty1@college.edu / Faculty@123 | student1@college.edu / Student@123');
  } finally { await conn.end(); }
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
