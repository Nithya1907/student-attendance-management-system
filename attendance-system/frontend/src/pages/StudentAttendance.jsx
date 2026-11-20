import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import useFetch from '../utils/useFetch';
import DataTable from '../components/DataTable.jsx';
import { Badge, Card, ErrorState, Field, PageHeader, PercentBadge, Spinner, inputCls } from '../components/ui.jsx';
import { fmtDate, pct, statusTone } from '../utils/format';

export default function StudentAttendance() {
  const summary = useFetch('/attendance/me/summary');
  const [f, setF] = useState({ subjectId: '', from: '', to: '' });
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
  const history = useFetch('/attendance/me/history', params);

  if (summary.loading) return <Spinner />;
  if (summary.error) return <ErrorState message={summary.error} onRetry={summary.reload} />;
  const { subjects, overall, threshold } = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader title="My Attendance" subtitle="Subject-wise percentages and full attendance history" />
      {overall.belowThreshold && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={20} className="shrink-0" /> Your overall attendance ({pct(overall.percentage)}) is below the {threshold}% requirement.
        </div>
      )}
      <DataTable rows={subjects.map((s) => ({ ...s, id: s.subjectId, missed: s.absent + s.leave }))} pageSize={10} emptyTitle="No attendance recorded yet"
        columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Subject' }, { key: 'present', label: 'Attended' }, { key: 'missed', label: 'Missed' }, { key: 'leave', label: 'of which Leave' }, { key: 'eligible', label: 'Total classes' },
          { key: 'percentage', label: 'Percentage', render: (r) => <span className="inline-flex items-center gap-2"><PercentBadge value={r.percentage} threshold={threshold} />{r.percentage < threshold && r.eligible > 0 && <AlertTriangle size={14} className="text-red-500" aria-label="Below threshold" />}</span> }]} />
      <Card title="Attendance history">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="Subject" htmlFor="h-sub"><select id="h-sub" className={inputCls} value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })}><option value="">All subjects</option>{subjects.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.name}</option>)}</select></Field>
          <Field label="From" htmlFor="h-from"><input id="h-from" type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To" htmlFor="h-to"><input id="h-to" type="date" className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <DataTable rows={history.data} loading={history.loading} error={history.error} onRetry={history.reload} searchKeys={['subjectName', 'status']} emptyTitle="No records found" emptyMessage="Try changing the filters."
          columns={[{ key: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { key: 'subjectName', label: 'Subject' },
            { key: 'status', label: 'Status', render: (r) => (r.sessionStatus === 'cancelled' ? <Badge tone="slate">class cancelled</Badge> : <Badge tone={statusTone[r.status]}>{r.status === 'leave' ? 'on leave' : r.status}</Badge>) }]} />
      </Card>
    </div>
  );
}
