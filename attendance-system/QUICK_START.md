# Quick start (VS Code)

1. Unzip, then **File > Open Folder...** and choose `attendance-system`.
2. Install MySQL 8 and make sure it is running. Install Node.js 18+.
3. Open a terminal (Ctrl+`) and run:

```bash
cd backend
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
```
4. Open `backend/.env` and set `DB_PASSWORD` (your MySQL password) and `JWT_SECRET` (any long random text).
5. Still in `backend`:

```bash
npm run seed     # creates database + sample data (wipes existing data in that DB)
npm run dev      # API on http://localhost:5000
```
6. Open a **second** terminal:

```bash
cd frontend
npm install
npm run dev      # open http://localhost:5173
```

You can also use **Terminal > Run Task...** (install, seed, start API, start UI, run tests).

Logins: admin@college.edu / Admin@123, faculty1@college.edu / Faculty@123, student1@college.edu / Student@123

Run the API tests (server must be running): `cd backend && npm test`

Full details: README.md. Diagrams, SRS and test plan: docs/PROJECT_DOCUMENTATION.md.
