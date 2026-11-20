/**
 * Integration tests against a RUNNING server with seeded data.
 *   1) npm run seed   2) npm start (another terminal)   3) npm test
 * Set API_URL to override (default http://localhost:5000/api).
 */
const test = require('node:test');
const assert = require('node:assert');
const API = process.env.API_URL || 'http://localhost:5000/api';

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = raw ? await res.text() : await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } }));

let admin, faculty, student, student2, serverUp = true;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

test('setup: server reachable and logins work', async (t) => {
  try { await call('GET', '/health'); } catch { serverUp = false; return t.skip('Server not running'); }
  admin = (await login('admin@college.edu', 'Admin@123')).data.token;
  faculty = (await login('faculty1@college.edu', 'Faculty@123')).data.token;
  student = (await login('student1@college.edu', 'Student@123')).data.token;
  student2 = (await login('student2@college.edu', 'Student@123')).data.token;
  assert.ok(admin && faculty && student);
});

test('invalid login rejected with 401', async (t) => {
  if (!serverUp) return t.skip();
  assert.strictEqual((await login('admin@college.edu', 'wrong')).status, 401);
  assert.strictEqual((await login('nobody@college.edu', 'x')).status, 401);
});

test('invalid login payload -> 422', async (t) => {
  if (!serverUp) return t.skip();
  assert.strictEqual((await call('POST', '/auth/login', { body: { email: 'bad', password: '' } })).status, 422);
});

test('protected route without token -> 401', async (t) => {
  if (!serverUp) return t.skip();
  assert.strictEqual((await call('GET', '/students')).status, 401);
});

test('role access: student and faculty cannot list students (403)', async (t) => {
  if (!serverUp) return t.skip();
  assert.strictEqual((await call('GET', '/students', { token: student })).status, 403);
  assert.strictEqual((await call('GET', '/students', { token: faculty })).status, 403);
  assert.strictEqual((await call('GET', '/students', { token: admin })).status, 200);
});

test('admin can add and edit a student; invalid data rejected', async (t) => {
  if (!serverUp) return t.skip();
  const uniq = Date.now();
  const body = { fullName: 'Test Student', rollNo: `T${uniq}`, email: `t${uniq}@college.edu`, password: 'Passw0rd!', departmentId: 1, phone: '9999999999' };
  const created = await call('POST', '/students', { token: admin, body });
  assert.strictEqual(created.status, 201);
  const edited = await call('PUT', `/students/${created.data.id}`, { token: admin, body: { ...body, fullName: 'Edited Name' } });
  assert.strictEqual(edited.status, 200);
  assert.strictEqual((await call('POST', '/students', { token: admin, body: { ...body, email: 'bad' } })).status, 422);
  assert.strictEqual((await call('POST', '/students', { token: admin, body })).status, 409); // duplicate email/roll
  assert.strictEqual((await call('DELETE', `/students/${created.data.id}`, { token: admin })).status, 204);
});

test('faculty cannot mark attendance for an unassigned class (403)', async (t) => {
  if (!serverUp) return t.skip();
  // faculty1 teaches CS501 (subject 1) and CS502 for class 1 only; subject 4 is not assigned to faculty1
  const r = await call('POST', '/attendance/save', { token: faculty, body: { classId: 1, subjectId: 4, date: today(), records: [{ studentId: 1, status: 'present' }] } });
  assert.strictEqual(r.status, 403);
});

test('empty session, invalid status and future date rejected', async (t) => {
  if (!serverUp) return t.skip();
  const base = { classId: 1, subjectId: 1, date: today() };
  assert.strictEqual((await call('POST', '/attendance/save', { token: faculty, body: { ...base, records: [] } })).status, 400);
  assert.strictEqual((await call('POST', '/attendance/save', { token: faculty, body: { ...base, records: [{ studentId: 1, status: 'maybe' }] } })).status, 422);
  assert.strictEqual((await call('POST', '/attendance/save', { token: faculty, body: { ...base, date: '2999-01-01', records: [{ studentId: 1, status: 'present' }] } })).status, 400);
});

test('save attendance, no duplicates, correction creates audit entry', async (t) => {
  if (!serverUp) return t.skip();
  const date = '2020-01-15'; // old date so it does not collide with seeded data
  const roster = (await call('GET', `/attendance/roster?classId=1&subjectId=1&date=${date}`, { token: faculty })).data;
  assert.ok(roster.students.length > 0);
  const records = roster.students.map((s) => ({ studentId: s.studentId, status: 'present' }));
  const first = await call('POST', '/attendance/save', { token: faculty, body: { classId: 1, subjectId: 1, date, records } });
  assert.ok([200, 201].includes(first.status));
  // Saving again must update, not duplicate
  records[0].status = 'absent';
  const second = await call('POST', '/attendance/save', { token: faculty, body: { classId: 1, subjectId: 1, date, records, reason: 'Marked wrongly' } });
  assert.strictEqual(second.status, 200);
  assert.strictEqual(second.data.isCorrection, true);
  assert.strictEqual(second.data.sessionId, first.data.sessionId);
  const after = (await call('GET', `/attendance/roster?classId=1&subjectId=1&date=${date}`, { token: faculty })).data;
  assert.strictEqual(after.students.length, roster.students.length);
  assert.strictEqual(after.students[0].status, 'absent');
  const audit = (await call('GET', '/attendance/audit', { token: faculty })).data;
  assert.ok(audit.some((a) => a.action === 'ATTENDANCE_CORRECTED'));
});

test('student sees own summary; cannot access staff endpoints or other students', async (t) => {
  if (!serverUp) return t.skip();
  const mine = await call('GET', '/attendance/me/summary', { token: student });
  assert.strictEqual(mine.status, 200);
  assert.ok(typeof mine.data.overall.percentage === 'number');
  assert.strictEqual((await call('GET', '/attendance/student/2/summary', { token: student })).status, 403);
  assert.strictEqual((await call('GET', '/reports/attendance', { token: student })).status, 403);
  const other = await call('GET', '/attendance/me/summary', { token: student2 });
  assert.notDeepStrictEqual(mine.data.subjects, undefined);
  assert.strictEqual(other.status, 200);
});

test('CSV export returns text/csv with header row', async (t) => {
  if (!serverUp) return t.skip();
  const r = await call('GET', '/reports/export?view=subject', { token: admin, raw: true });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.startsWith('rollNo,studentName'));
});
