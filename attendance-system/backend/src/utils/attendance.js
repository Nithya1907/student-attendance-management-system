/**
 * ATTENDANCE POLICY (documented in README / SRS)
 *  - Only sessions with status = 'held' are eligible. 'cancelled' sessions are excluded.
 *  - present -> attended and eligible
 *  - absent  -> eligible, not attended
 *  - leave   -> eligible, NOT attended (never silently treated as present)
 *  - percentage = present / (present + absent + leave) * 100, 2 decimals, 0.00 when no eligible sessions
 */
function calcPercentage(present, absent, leave) {
  const eligible = Number(present) + Number(absent) + Number(leave);
  if (eligible === 0) return 0;
  return Number(((Number(present) / eligible) * 100).toFixed(2));
}

async function getThreshold(conn) {
  const [rows] = await conn.query("SELECT setting_value FROM settings WHERE setting_key='attendance_threshold'");
  return rows.length ? Number(rows[0].setting_value) : 75;
}

// Per-subject summary for one student
async function studentSummary(conn, studentId) {
  const [rows] = await conn.query(
    `SELECT sub.id AS subject_id, sub.code, sub.name,
            SUM(ar.status='present') AS present,
            SUM(ar.status='absent') AS absent,
            SUM(ar.status='leave') AS \`leave\`
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id AND s.status = 'held'
       JOIN subjects sub ON sub.id = s.subject_id
      WHERE ar.student_id = ?
      GROUP BY sub.id, sub.code, sub.name
      ORDER BY sub.name`, [studentId]);
  const subjects = rows.map((r) => {
    const present = Number(r.present), absent = Number(r.absent), leave = Number(r.leave);
    return { subjectId: r.subject_id, code: r.code, name: r.name, present, absent, leave,
      eligible: present + absent + leave, percentage: calcPercentage(present, absent, leave) };
  });
  const t = subjects.reduce((a, s) => ({ p: a.p + s.present, a: a.a + s.absent, l: a.l + s.leave }), { p: 0, a: 0, l: 0 });
  const threshold = await getThreshold(conn);
  const eligible = t.p + t.a + t.l;
  const percentage = calcPercentage(t.p, t.a, t.l);
  return {
    threshold, subjects,
    overall: { present: t.p, absent: t.a, leave: t.l, eligible, percentage, belowThreshold: eligible > 0 && percentage < threshold },
  };
}

module.exports = { calcPercentage, getThreshold, studentSummary };
