import { useMemo, useState } from 'react';
import { Link2, Trash2, UserPlus } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import useFetch from '../utils/useFetch';
import { useToast } from '../context/ToastContext.jsx';
import DataTable from '../components/DataTable.jsx';
import { Button, Card, ConfirmDialog, Field, PageHeader, Tabs, inputCls } from '../components/ui.jsx';

export default function Assignments() {
  const [tab, setTab] = useState('enroll');
  return (
    <div>
      <PageHeader title="Enrollment & Assignment" subtitle="Enroll students into classes and assign faculty to subjects" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'enroll', label: 'Student Enrollment' }, { value: 'assign', label: 'Faculty Assignment' }]} />
      {tab === 'enroll' ? <Enrollment /> : <FacultyAssignment />}
    </div>
  );
}

function Enrollment() {
  const toast = useToast();
  const classes = useFetch('/classes');
  const students = useFetch('/students');
  const [classId, setClassId] = useState('');
  const enrollments = useFetch('/enrollments', { classId }, { skip: !classId });
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const enrolledIds = useMemo(() => new Set((enrollments.data || []).map((e) => e.studentId)), [enrollments.data]);
  const available = (students.data || []).filter((s) => !enrolledIds.has(s.id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const enroll = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/enrollments', { classId: Number(classId), studentIds: selected });
      toast.success(`${data.added} student(s) enrolled${data.skipped ? `, ${data.skipped} already enrolled` : ''}`);
      setSelected([]);
      enrollments.reload(); classes.reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    try { await api.delete(`/enrollments/${removing.id}`); toast.success('Student removed from class'); setRemoving(null); enrollments.reload(); classes.reload(); }
    catch (e) { toast.error(errorMessage(e)); setRemoving(null); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Add students to class">
        <Field label="Class" htmlFor="enr-class">
          <select id="enr-class" className={inputCls} value={classId} onChange={(e) => { setClassId(e.target.value); setSelected([]); }}>
            <option value="">Select a class...</option>
            {(classes.data || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academicYear})</option>)}
          </select>
        </Field>
        {classId && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Students not yet in this class ({available.length})</p>
            <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {available.length === 0 && <p className="p-4 text-sm text-slate-500">All students are already enrolled.</p>}
              {available.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span className="font-medium">{s.rollNo}</span> <span className="text-slate-600">{s.fullName}</span>
                </label>
              ))}
            </div>
            <Button className="mt-4" disabled={!selected.length} busy={busy} onClick={enroll}><UserPlus size={16} /> Enroll {selected.length || ''} selected</Button>
          </div>
        )}
      </Card>
      <div>
        <h2 className="mb-3 font-semibold text-slate-900">Enrolled students</h2>
        {!classId ? <Card><p className="text-sm text-slate-500">Select a class to see its students.</p></Card> : (
          <DataTable rows={enrollments.data} loading={enrollments.loading} error={enrollments.error} onRetry={enrollments.reload}
            searchKeys={['rollNo', 'studentName']} pageSize={8} emptyTitle="No students enrolled" emptyMessage="Use the panel on the left to enroll students."
            columns={[{ key: 'rollNo', label: 'Roll No' }, { key: 'studentName', label: 'Name' }]}
            rowActions={(r) => <button aria-label="Remove from class" onClick={() => setRemoving(r)} className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>} />
        )}
      </div>
      <ConfirmDialog open={!!removing} confirmLabel="Remove" onCancel={() => setRemoving(null)} onConfirm={remove}
        message={`Remove ${removing?.studentName} from ${removing?.className}? Their past attendance records are kept.`} />
    </div>
  );
}

function FacultyAssignment() {
  const toast = useToast();
  const faculty = useFetch('/faculty');
  const classes = useFetch('/classes');
  const subjects = useFetch('/subjects');
  const list = useFetch('/assignments');
  const [form, setForm] = useState({ facultyId: '', classId: '', subjectId: '' });
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    if (!form.facultyId || !form.classId || !form.subjectId) return toast.error('Select faculty, class and subject');
    setBusy(true);
    try {
      await api.post('/assignments', { facultyId: Number(form.facultyId), classId: Number(form.classId), subjectId: Number(form.subjectId) });
      toast.success('Faculty assigned');
      list.reload();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    try { await api.delete(`/assignments/${removing.id}`); toast.success('Assignment removed'); setRemoving(null); list.reload(); }
    catch (e) { toast.error(errorMessage(e)); setRemoving(null); }
  };

  const sel = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="New assignment">
        <form onSubmit={add} className="space-y-4">
          <Field label="Faculty" htmlFor="as-f"><select id="as-f" className={inputCls} {...sel('facultyId')}><option value="">Select...</option>{(faculty.data || []).map((f) => <option key={f.id} value={f.id}>{f.fullName}</option>)}</select></Field>
          <Field label="Class" htmlFor="as-c"><select id="as-c" className={inputCls} {...sel('classId')}><option value="">Select...</option>{(classes.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Subject" htmlFor="as-s"><select id="as-s" className={inputCls} {...sel('subjectId')}><option value="">Select...</option>{(subjects.data || []).map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}</select></Field>
          <Button type="submit" busy={busy}><Link2 size={16} /> Assign</Button>
        </form>
      </Card>
      <div className="lg:col-span-2">
        <DataTable rows={list.data} loading={list.loading} error={list.error} onRetry={list.reload} searchKeys={['facultyName', 'className', 'subjectName', 'subjectCode']}
          emptyTitle="No assignments yet" emptyMessage="Assign a faculty member to a class and subject so they can mark attendance."
          columns={[{ key: 'facultyName', label: 'Faculty' }, { key: 'className', label: 'Class' }, { key: 'subjectName', label: 'Subject', render: (r) => `${r.subjectCode} - ${r.subjectName}` }]}
          rowActions={(r) => <button aria-label="Remove assignment" onClick={() => setRemoving(r)} className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>} />
      </div>
      <ConfirmDialog open={!!removing} confirmLabel="Remove" onCancel={() => setRemoving(null)} onConfirm={remove}
        message={`Remove ${removing?.facultyName} from ${removing?.subjectName} (${removing?.className})? They will no longer be able to mark attendance for it.`} />
    </div>
  );
}
