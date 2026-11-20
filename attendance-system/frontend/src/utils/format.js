export const pct = (n) => `${Number(n || 0).toFixed(2)}%`;
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const fmtDate = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '');
export const statusTone = { present: 'green', absent: 'red', leave: 'amber', held: 'blue', cancelled: 'slate' };
