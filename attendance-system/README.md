# Student Attendance Management System

Full-stack college project (Software Engineering & System Design).

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS 3, Recharts, Lucide React, Axios, React Router |
| Backend | Node.js + Express.js (REST API) |
| Database | MySQL 8 |
| Auth | JWT + bcrypt (`bcryptjs`, pure JS, so no native build problems on Windows) |

> **Dependency note:** `bcryptjs` is used instead of `bcrypt` because `bcrypt` needs native compilation (Python/C++ build tools) which commonly fails on student laptops. It uses the same algorithm and hash format. Tailwind is pinned to v3.4 (stable, works with the classic `tailwind.config.js` setup).

## Folder structure

```
attendance-system/
├── README.md
├── database/
│   └── schema.sql                 # all tables, keys, constraints, indexes
├── docs/
│   └── PROJECT_DOCUMENTATION.md   # SRS, UML, ER, DFD, test plan, etc. (Mermaid)
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── server.js, app.js
│   │   ├── config/db.js
│   │   ├── middleware/            # auth.js (JWT + roles), validate.js, error.js
│   │   ├── routes/                # auth, users, students, faculty, academic, attendance, reports, dashboard
│   │   ├── utils/                 # attendance.js (percentage rules), audit.js
│   │   └── scripts/seed.js        # creates schema + sample data (hashed passwords)
│   └── tests/                     # unit.test.js, api.test.js
└── frontend/
    ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── api/client.js
        ├── context/               # AuthContext, ToastContext
        ├── components/            # Layout, ProtectedRoute, DataTable, CrudPage, ui (Modal, Card, ...)
        ├── utils/                 # useFetch, format
        └── pages/                 # Login, 3 dashboards, Students, FacultyManagement, Academics,
                                   # Assignments, UsersSettings, MarkAttendance, Reports,
                                   # StudentAttendance, Profile, Errors (403/404)
```

## Setup (VS Code)

**Prerequisites:** Node.js 18+ (20/22 fine), MySQL 8 running locally, VS Code.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `backend/.env`: set `DB_PASSWORD` to your MySQL root password and `JWT_SECRET` to a long random string.

Create the schema **and** load sample data (this also creates the `attendance_db` database):

```bash
npm run seed
```

> `npm run seed` **wipes and re-creates all data** in the configured database. To create only the empty tables, run `database/schema.sql` in MySQL Workbench / `mysql < database/schema.sql` instead.

Start the API:

```bash
npm run dev      # http://localhost:5000  (health check: /api/health)
```

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:5000`, so no extra config is needed.

### 3. Demo logins (from the seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@college.edu | Admin@123 |
| Faculty | faculty1@college.edu (also faculty2, faculty3) | Faculty@123 |
| Student | student1@college.edu … student20@college.edu | Student@123 |

`student3` and `student7` are deliberately low attenders so the below-75% warning can be demonstrated. Faculty 1 is assigned CS501 (both classes) and CS502 (CSE-A).

## Attendance calculation policy

```
Attendance % = present / (present + absent + leave) × 100      (2 decimals)
```

* Only sessions with status `held` are **eligible**. **Cancelled sessions are excluded** entirely.
* `present` counts as attended.
* `absent` is eligible but not attended.
* `leave` is eligible but **not** counted as present (never silently treated as present).
* No eligible sessions → `0.00` (no division by zero).
* The warning threshold defaults to **75%** and is editable by the admin (*Users & Settings*), stored in the `settings` table.

Implemented in `backend/src/utils/attendance.js`.

## API reference

All routes are prefixed `/api`. Send `Authorization: Bearer <token>` except for login. Errors: `{ "message": "...", "errors": [{ "field", "message" }] }`.

| Method & path | Roles | Purpose |
|---|---|---|
| POST `/auth/login` | public | Login → `{ token, user }` |
| GET `/auth/me` | any | Current user + profile |
| PUT `/auth/password` | any | Change own password |
| GET `/dashboard` | any | Role-specific dashboard data |
| GET/POST `/users`, PATCH `/users/:id`, POST `/users/:id/reset-password` | admin | Manage accounts / roles / status |
| GET/POST `/students`, GET/PUT/DELETE `/students/:id` | admin | Student CRUD |
| GET/POST `/faculty`, GET/PUT/DELETE `/faculty/:id` | admin | Faculty CRUD |
| GET/POST/PUT/DELETE `/departments`, `/academic-years`, `/classes`, `/subjects` | GET: admin+faculty; writes: admin | Academic structure |
| GET/POST `/enrollments`, DELETE `/enrollments/:id` | admin | Enroll students in classes |
| GET/POST `/assignments`, DELETE `/assignments/:id` | admin | Assign faculty to class+subject |
| GET `/settings`, PUT `/settings` | GET any, PUT admin | Attendance threshold |
| GET `/attendance/my-assignments` | faculty/admin | Assigned class+subject pairs |
| GET `/attendance/roster?classId&subjectId&date` | faculty (assigned)/admin | Students + existing marks |
| POST `/attendance/save` | faculty (assigned only) | Create/correct a session (transaction) |
| GET `/attendance/history` | faculty/admin | Session list with counts |
| GET `/attendance/audit` | faculty (own)/admin | Audit trail of changes |
| GET `/attendance/me/summary`, `/attendance/me/history` | student | Own percentages / history only |
| GET `/attendance/student/:id/summary` | admin, faculty (own classes) | Staff view of a student |
| GET `/reports/attendance?view=subject\|daily\|weekly\|monthly&classId&subjectId&from&to` | faculty/admin | Report data |
| GET `/reports/export?...same params` | faculty/admin | CSV download |

### Example: login

```http
POST /api/auth/login
{ "email": "faculty1@college.edu", "password": "Faculty@123" }

200 { "token": "eyJhbGciOi...", "user": { "id": 2, "email": "faculty1@college.edu", "role": "faculty",
      "profile": { "id": 1, "employeeId": "EMP101", "fullName": "Dr. Anita Rao", "department": "Computer Science & Engineering" } } }
401 { "message": "Invalid email or password" }
```

### Example: save attendance

```http
POST /api/attendance/save
{ "classId": 1, "subjectId": 1, "date": "2026-10-22", "sessionStatus": "held", "reason": "optional, for corrections",
  "records": [ { "studentId": 1, "status": "present" }, { "studentId": 2, "status": "leave", "remarks": "Medical" } ] }

201 { "sessionId": 57, "created": 2, "corrected": 0, "isCorrection": false }   // first save
200 { "sessionId": 57, "created": 0, "corrected": 1, "isCorrection": true }    // later correction (audited)
403 { "message": "You are not assigned to this class and subject" }
400 { "message": "Cannot save an empty attendance session" }
```

### Example: summary (student)

```http
GET /api/attendance/me/summary
200 { "threshold": 75, "subjects": [ { "subjectId": 1, "code": "CS501", "name": "Software Engineering",
      "present": 10, "absent": 2, "leave": 1, "eligible": 13, "percentage": 76.92 } ],
      "overall": { "present": 10, "absent": 2, "leave": 1, "eligible": 13, "percentage": 76.92, "belowThreshold": false } }
```

## Security implemented

* Passwords stored only as bcrypt hashes; login returns one generic message (no account enumeration); login rate limit.
* JWT verified on every request; the user is re-read from the DB so disabled accounts are rejected immediately.
* Role checks on the **server** for every route (`authorize(...)`); the React route guards are only for UX.
* Students can only call `/attendance/me/*`, so there is no way to request another student's data.
* Faculty can only save/read attendance for class+subject pairs in `faculty_assignments`; reports are filtered the same way.
* `express-validator` validation on inputs; all SQL is parameterized; `helmet` headers; CORS limited to `CLIENT_ORIGIN`.
* Unique keys `(class_id, subject_id, session_date)` and `(session_id, student_id)` prevent duplicates in the database; saves run in a transaction.
* Every attendance creation and correction is written to `audit_logs` (old value, new value, user, reason).
* CSV export neutralises spreadsheet formula injection (cells starting with `= + - @`).
* Errors are centralised; internal/SQL details are never sent to the client.

### Remaining limitations (be ready to mention in the viva)

* JWT is kept in `localStorage` (readable by XSS). Production would use httpOnly cookies + CSRF protection.
* No refresh tokens / token revocation list; tokens live until expiry (8h).
* No email-based password reset or MFA; admin resets passwords manually.
* HTTPS, backups, centralised logging and monitoring are deployment concerns not covered here.
* Report tables are loaded fully then paginated in the browser (fine for a college-sized dataset, not for huge data).
* A student/faculty account's role cannot be converted (by design, as profiles are linked).

## Testing

```bash
cd backend
npm test            # unit tests always run; API tests run if the server is up, else are skipped
```

For the integration tests: (1) `npm run seed`, (2) `npm run dev` in one terminal, (3) `npm test` in another. Use `API_URL=http://host:port/api npm test` for a different address.

Covered: valid/invalid login, unauthorized role access, add/edit/validate students, attendance save, duplicate prevention (re-save updates, never duplicates), percentage maths, correction + audit entry, invalid data, empty session, future date, CSV export, student privacy, faculty-assignment restriction. The full manual/UI test plan is in `docs/PROJECT_DOCUMENTATION.md`.

## Troubleshooting

* `ECONNREFUSED` / "Cannot reach the server": start the backend and check `DB_*` values in `.env`.
* `Access denied for user`: wrong `DB_USER` / `DB_PASSWORD`.
* `JWT_SECRET is missing`: you did not create `backend/.env`.
* Blank page after login: open the browser console and confirm the API is on port 5000.
* Port in use: change `PORT` in `.env` **and** the proxy target in `frontend/vite.config.js`.
