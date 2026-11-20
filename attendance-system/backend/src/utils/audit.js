// Writes an audit row. `conn` may be a transaction connection or the pool.
async function logAudit(conn, { userId, action, entity, entityId, oldValue, newValue }) {
  await conn.query(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value) VALUES (?,?,?,?,?,?)',
    [userId || null, action, entity, entityId || null,
      oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue === undefined ? null : JSON.stringify(newValue)]
  );
}
module.exports = { logAudit };
