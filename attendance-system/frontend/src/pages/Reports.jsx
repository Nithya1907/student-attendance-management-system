import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import api, { errorMessage } from '../api/client';
import useFetch from '../utils/useFetch';
import { useToast } from '../context/ToastContext.jsx';
import DataTable from '../components/DataTable.jsx';
import { Badge, Button, Card, Field, PageHeader, PercentBadge, Tabs, inputCls } from '../components/ui.jsx';
import { fmtDate } from '../utils/format';

const VIEWS = [{ value: 'subject', label: 'Subject-wise' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }];

export default function Reports() {
  const [tab, setTab] = useState('report');
  return (
    <div>
      <PageHeader title="Attendance Reports" subtitle="Reports, session history and the audit trail of corrections" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'report', label: 'Reports' }, { value: 'history', label: 'Session History' }, { value: 'audit', label: 'Audit Log' }]} />
      {tab === 'report' && <ReportTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function useFilters() {
  const assignments = useFetch('/attendance/my-assignments');
  const [f, setF] = useState({ classId: '', subjectId: '', from: '', to: '' });
  const classes = useMemo(() => [...new Map((assignments.data || []).map((a) => [a.classId, { id: a.classId, name: a.className }])).values()], [assignments.data]);
  const subjects = useMemo(() => [...new Map((assignments.data || []).filter((a) => !f.classId || String(a.classId) === f.classId).map((a) => [a.subjectId, { id: a.subjectId, name: `${a.subjectCode} - ${a.subjectName}` }])).values()], [assignments.data, f.classId]);
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
  return { f, setF, classes, subjects, params };
}

function FilterBar({ filters, children }) {
  const { f, setF, classes, subjects } = filters;
  return (
    <Card className="mb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Class" htmlFor="f-class"><select id="f-class" className={inputCls} value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, subjectId: '' })}><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Subject" htmlFor="f-sub"><select id="f-sub" className={inputCls} value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })}><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="From" htmlFor="f-from"><input id="f-from" type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To" htmlFor="f-to"><input id="f-to" type="date" className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        {children}
      </div>
    </Card>
  );
}

function ReportTab() {
  const toast = useToast();
  const filters = useFilters();
  const [view, setView] = useState('subject');
  const [exporting, setExporting] = useState(false);
  const { data, loading, error, reload } = useFetch('/reports/attendance', { ...filters.params, view });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/export', { params: { ...filters.params, view }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `attendance-${view}-report.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  };

  const trendCols = [{ key: 'period', label: view === 'weekly' ? 'Week starting' : view === 'monthly' ? 'Month' : 'Date' }, { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'Leave' }, { key: 'eligible', label: 'Total' }, { key: 'percentage', label: 'Attendance', render: (r) => <PercentBadge value={r.percentage} /> }];
  const subjectCols = [{ key: 'rollNo', label: 'Roll No' }, { key: 'studentName', label: 'Student' }, { key: 'className', label: 'Class' }, { key: 'subjectName', label: 'Subject' }, { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'Leave' }, { key: 'eligible', label: 'Eligible' }, { key: 'percentage', label: 'Attendance', render: (r) => <PercentBadge value={r.percentage} /> }];
  const rows = (data || []).map((r, i) => ({ ...r, id: i }));

  return (
    <>
      <FilterBar filters={filters}>
        <Field label="Report type" htmlFor="f-view"><select id="f-view" className={inputCls} value={view} onChange={(e) => setView(e.target.value)}>{VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select></Field>
      </FilterBar>
      {view !== 'subject' && rows.length > 0 && (
        <Card title="Attendance trend" className="mb-4">
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis domain={[0, 100]} unit="%" fontSize={12} /><Tooltip formatter={(v) => `${v}%`} /><Line type="monotone" dataKey="percentage" name="Attendance" stroke="#2563eb" strokeWidth={2} /></LineChart>
          </ResponsiveContainer></div>
        </Card>
      )}
      {view === 'subject' && rows.length > 0 && <SubjectBars rows={rows} />}
      <DataTable rows={rows} loading={loading} error={error} onRetry={reload} columns={view === 'subject' ? subjectCols : trendCols}
        searchKeys={view === 'subject' ? ['rollNo', 'studentName', 'subjectName', 'className'] : ['period']} emptyTitle="No attendance data" emptyMessage="No sessions match these filters yet."
        toolbar={<Button variant="secondary" className="sm:ml-auto" onClick={exportCsv} busy={exporting} disabled={!rows.length}><Download size={16} /> Export CSV</Button>} />
    </>
  );
}

function SubjectBars({ rows }) {
  const bySubject = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r.subjectName] = m[r.subjectName] || { subject: r.subjectName, present: 0, eligible: 0 }; m[r.subjectName].present += r.present; m[r.subjectName].eligible += r.eligible; });
    return Object.values(m).map((s) => ({ subject: s.subject, percentage: s.eligible ? Number(((s.present / s.eligible) * 100).toFixed(2)) : 0 }));
  }, [rows]);
  return (
    <Card title="Average attendance by subject" className="mb-4">
      <div className="h-60"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={bySubject}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="subject" fontSize={11} /><YAxis domain={[0, 100]} unit="%" fontSize={12} /><Tooltip formatter={(v) => `${v}%`} /><Legend /><Bar dataKey="percentage" name="Attendance" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart>
      </ResponsiveContainer></div>
    </Card>
  );
}

function HistoryTab() {
  const filters = useFilters();
  const { data, loading, error, reload } = useFetch('/attendance/history', filters.params);
  return (
    <>
      <FilterBar filters={filters} />
      <DataTable rows={data} loading={loading} error={error} onRetry={reload} searchKeys={['className', 'subjectName', 'facultyName', 'date']} emptyTitle="No sessions found"
        columns={[{ key: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { key: 'className', label: 'Class' }, { key: 'subjectName', label: 'Subject' }, { key: 'facultyName', label: 'Faculty' },
          { key: 'sessionStatus', label: 'Session', render: (r) => <Badge tone={r.sessionStatus === 'held' ? 'blue' : 'slate'}>{r.sessionStatus}</Badge> },
          { key: 'present', label: 'P' }, { key: 'absent', label: 'A' }, { key: 'leave', label: 'L' }]} />
    </>
  );
}

function AuditTab() {
  const { data, loading, error, reload } = useFetch('/attendance/audit');
  const summarize = (r) => {
    const o = r.oldValue && (typeof r.oldValue === 'string' ? JSON.parse(r.oldValue) : r.oldValue);
    const n = r.newValue && (typeof r.newValue === 'string' ? JSON.parse(r.newValue) : r.newValue);
    if (r.action === 'ATTENDANCE_CORRECTED') return `Student #${n.studentId}: ${o.status} → ${n.status}${n.reason ? ` (reason: ${n.reason})` : ''}`;
    if (r.action === 'SESSION_CREATED') return `Session created with ${n.records} record(s)`;
    if (r.action === 'SESSION_STATUS_CHANGED') return `Status ${o.status} → ${n.status}`;
    return n ? JSON.stringify(n) : '';
  };
  const rows = (data || []).map((r) => ({ ...r, details: summarize(r) }));
  return (
    <DataTable rows={rows} loading={loading} error={error} onRetry={reload} searchKeys={['action', 'changedBy', 'details']} emptyTitle="No audit entries" emptyMessage="Corrections to attendance appear here."
      columns={[{ key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt.replace(' ', 'T')).toLocaleString() }, { key: 'changedBy', label: 'By' }, { key: 'action', label: 'Action', render: (r) => <Badge tone={r.action === 'ATTENDANCE_CORRECTED' ? 'amber' : 'blue'}>{r.action.replaceAll('_', ' ').toLowerCase()}</Badge> }, { key: 'sessionId', label: 'Session #' }, { key: 'details', label: 'Details' }]} />
  );
}
