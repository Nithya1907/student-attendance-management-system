import { useMemo, useState } from 'react';
import { CheckCheck, Info, Save, Search } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import useFetch from '../utils/useFetch';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, Spinner, inputCls } from '../components/ui.jsx';
import { todayISO } from '../utils/format';

const OPTIONS = [
  { value: 'present', label: 'Present', on: 'bg-green-600 text-white border-green-600' },
  { value: 'absent', label: 'Absent', on: 'bg-red-600 text-white border-red-600' },
  { value: 'leave', label: 'On Leave', on: 'bg-amber-500 text-white border-amber-500' },
];

export default function MarkAttendance() {
  const toast = useToast();
  const assignments = useFetch('/attendance/my-assignments');
  const [assignmentId, setAssignmentId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [roster, setRoster] = useState(null); // { session, students }
  const [rows, setRows] = useState([]);
  const [cancelled, setCancelled] = useState(false);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const assignment = (assignments.data || []).find((a) => String(a.id) === assignmentId);

  const load = async () => {
    setFormError('');
    if (!assignment) return setFormError('Select a class and subject');
    if (!date) return setFormError('Select a date');
    setLoading(true); setLoadError(''); setRoster(null);
    try {
      const { data } = await api.get('/attendance/roster', { params: { classId: assignment.classId, subjectId: assignment.subjectId, date } });
      setRoster(data);
      setRows(data.students.map((s) => ({ ...s, status: s.status || '' })));
      setCancelled(data.session?.status === 'cancelled');
      setReason('');
    } catch (e) { setLoadError(errorMessage(e)); } finally { setLoading(false); }
  };

  const setStatus = (id, status) => setRows((r) => r.map((x) => (x.studentId === id ? { ...x, status } : x)));
  const markAll = () => setRows((r) => r.map((x) => ({ ...x, status: 'present' })));
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t ? rows.filter((r) => r.fullName.toLowerCase().includes(t) || r.rollNo.toLowerCase().includes(t)) : rows;
  }, [rows, search]);
  const counts = useMemo(() => rows.reduce((a, r) => ({ ...a, [r.status || 'unmarked']: (a[r.status || 'unmarked'] || 0) + 1 }), {}), [rows]);
  const isCorrection = !!roster?.session;

  const save = async () => {
    setFormError('');
    if (!cancelled && counts.unmarked) return setFormError(`${counts.unmarked} student(s) are not marked yet. Mark everyone or use "Mark All Present".`);
    if (!cancelled && rows.length === 0) return setFormError('This class has no enrolled students');
    setSaving(true);
    try {
      const { data } = await api.post('/attendance/save', {
        classId: assignment.classId, subjectId: assignment.subjectId, date,
        sessionStatus: cancelled ? 'cancelled' : 'held', reason: reason || undefined,
        records: cancelled ? [] : rows.map((r) => ({ studentId: r.studentId, status: r.status, remarks: r.remarks || undefined })),
      });
      toast.success(data.isCorrection ? `Attendance updated (${data.corrected} correction(s) logged)` : 'Attendance saved');
      load();
    } catch (e) { setFormError(errorMessage(e)); toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  if (assignments.loading) return <Spinner />;
  if (assignments.error) return <ErrorState message={assignments.error} onRetry={assignments.reload} />;

  return (
    <div>
      <PageHeader title="Mark Attendance" subtitle="Select class, subject and date, then mark each student" />
      <Card>
        {(assignments.data || []).length === 0 ? <EmptyState title="No assignments" message="You are not assigned to any class/subject yet. Contact the administrator." /> : (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Class & subject" htmlFor="m-as">
                <select id="m-as" className={inputCls} value={assignmentId} onChange={(e) => { setAssignmentId(e.target.value); setRoster(null); }}>
                  <option value="">Select...</option>
                  {assignments.data.map((a) => <option key={a.id} value={a.id}>{a.className} - {a.subjectCode} {a.subjectName}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Date" htmlFor="m-date"><input id="m-date" type="date" max={todayISO()} className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setRoster(null); }} /></Field>
            <div className="flex items-end"><Button onClick={load} busy={loading} className="w-full">Load students</Button></div>
          </div>
        )}
        {formError && !roster && <p role="alert" className="mt-3 text-sm text-red-600">{formError}</p>}
      </Card>

      {loading && <Spinner label="Loading students..." />}
      {loadError && <ErrorState message={loadError} onRetry={load} />}

      {roster && (
        <div className="mt-6 space-y-4">
          {isCorrection && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <Info size={18} className="mt-0.5 shrink-0" />
              Attendance already exists for this session. Saving will update it and every change is recorded in the audit history.
            </div>
          )}
          <Card>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative lg:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll no" aria-label="Search students" className={`${inputCls} pl-9`} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">Present {counts.present || 0}</Badge><Badge tone="red">Absent {counts.absent || 0}</Badge>
                <Badge tone="amber">Leave {counts.leave || 0}</Badge><Badge tone="slate">Unmarked {counts.unmarked || 0}</Badge>
                <Button variant="secondary" onClick={markAll} disabled={cancelled}><CheckCheck size={16} /> Mark All Present</Button>
              </div>
            </div>
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} />
              This class was <b>cancelled</b> (excluded from attendance percentage)
            </label>

            {rows.length === 0 ? <EmptyState title="No students enrolled" message="Ask the admin to enroll students into this class." /> : cancelled ? (
              <EmptyState title="Session will be saved as cancelled" message="No student attendance is recorded and it is not counted as an eligible session." />
            ) : filtered.length === 0 ? <EmptyState title="No matching students" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Roll No</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody className="divide-y">
                    {filtered.map((r) => (
                      <tr key={r.studentId}>
                        <td className="px-3 py-2 font-medium">{r.rollNo}</td>
                        <td className="px-3 py-2">{r.fullName}</td>
                        <td className="px-3 py-2">
                          <div className="inline-flex gap-1" role="radiogroup" aria-label={`Status for ${r.fullName}`}>
                            {OPTIONS.map((o) => (
                              <button key={o.value} type="button" role="radio" aria-checked={r.status === o.value} onClick={() => setStatus(r.studentId, o.value)}
                                className={`rounded-md border px-3 py-1 text-xs font-medium ${r.status === o.value ? o.on : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{o.label}</button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 grid gap-4 border-t pt-4 md:grid-cols-3">
              {isCorrection && <div className="md:col-span-2"><Field label="Reason for correction (optional, stored in audit log)" htmlFor="m-reason"><input id="m-reason" maxLength={255} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>}
              <div className="flex items-end md:col-start-3"><Button onClick={save} busy={saving} className="w-full"><Save size={16} /> {isCorrection ? 'Update attendance' : 'Save attendance'}</Button></div>
            </div>
            {formError && <p role="alert" className="mt-3 text-sm text-red-600">{formError}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
