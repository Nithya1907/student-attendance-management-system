import { useState } from 'react';
import { KeyRound, Plus, Save, ShieldCheck, ShieldOff } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import useFetch from '../utils/useFetch';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import DataTable from '../components/DataTable.jsx';
import { Badge, Button, Card, ConfirmDialog, Field, Modal, PageHeader, inputCls } from '../components/ui.jsx';

export default function UsersSettings() {
  const toast = useToast();
  const { user: me } = useAuth();
  const users = useFetch('/users');
  const settings = useFetch('/settings');
  const [threshold, setThreshold] = useState(null);
  const [savingT, setSavingT] = useState(false);
  const [toggle, setToggle] = useState(null);
  const [reset, setReset] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [passErr, setPassErr] = useState('');
  const [admin, setAdmin] = useState(null);
  const [adminErrors, setAdminErrors] = useState({});

  const tVal = threshold ?? settings.data?.attendanceThreshold ?? 75;

  const saveThreshold = async () => {
    setSavingT(true);
    try { await api.put('/settings', { attendanceThreshold: Number(tVal) }); toast.success('Attendance threshold updated'); settings.reload(); setThreshold(null); }
    catch (e) { toast.error(fieldErrors(e).attendanceThreshold || errorMessage(e)); } finally { setSavingT(false); }
  };

  const doToggle = async () => {
    try { await api.patch(`/users/${toggle.id}`, { isActive: !toggle.isActive }); toast.success(`Account ${toggle.isActive ? 'disabled' : 'enabled'}`); users.reload(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setToggle(null); }
  };

  const doReset = async () => {
    if (newPass.length < 8) return setPassErr('Password must be at least 8 characters');
    try { await api.post(`/users/${reset.id}/reset-password`, { password: newPass }); toast.success('Password reset'); setReset(null); setNewPass(''); setPassErr(''); }
    catch (e) { setPassErr(errorMessage(e)); }
  };

  const createAdmin = async (e) => {
    e.preventDefault();
    const v = {};
    if (!/^\S+@\S+\.\S+$/.test(admin.email)) v.email = 'Enter a valid email';
    if ((admin.password || '').length < 8) v.password = 'Password must be at least 8 characters';
    setAdminErrors(v);
    if (Object.keys(v).length) return;
    try { await api.post('/users', admin); toast.success('Admin account created'); setAdmin(null); users.reload(); }
    catch (err) { const fe = fieldErrors(err); if (Object.keys(fe).length) setAdminErrors(fe); else toast.error(errorMessage(err)); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users & Settings" subtitle="Manage accounts, roles and attendance policy"
        actions={<Button onClick={() => { setAdmin({ email: '', password: '' }); setAdminErrors({}); }}><Plus size={16} /> New admin</Button>} />
      <Card title="Attendance threshold">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Minimum required attendance (%)" htmlFor="thr" hint="Students below this percentage see a warning. Default 75%.">
            <input id="thr" type="number" min="1" max="100" className={`${inputCls} sm:w-48`} value={tVal} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <Button onClick={saveThreshold} busy={savingT} disabled={threshold === null}><Save size={16} /> Save</Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Policy: only held sessions count. Cancelled sessions are excluded; leave counts as an eligible session but is NOT counted as present.</p>
      </Card>
      <DataTable rows={users.data} loading={users.loading} error={users.error} onRetry={users.reload} searchKeys={['email', 'fullName', 'role']}
        columns={[
          { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (r) => <Badge tone={r.role === 'admin' ? 'blue' : r.role === 'faculty' ? 'amber' : 'green'}>{r.role}</Badge> },
          { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Active' : 'Disabled'}</Badge> },
        ]}
        rowActions={(r) => (
          <>
            <button onClick={() => { setReset(r); setNewPass(''); setPassErr(''); }} aria-label="Reset password" title="Reset password" className="rounded p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><KeyRound size={16} /></button>
            {r.id !== me.id && (
              <button onClick={() => setToggle(r)} aria-label={r.isActive ? 'Disable account' : 'Enable account'} title={r.isActive ? 'Disable' : 'Enable'} className="rounded p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700">
                {r.isActive ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
              </button>
            )}
          </>
        )} />
      <ConfirmDialog open={!!toggle} confirmLabel={toggle?.isActive ? 'Disable' : 'Enable'} title="Change account status" onCancel={() => setToggle(null)} onConfirm={doToggle}
        message={`${toggle?.isActive ? 'Disable' : 'Enable'} the account ${toggle?.email}?`} />
      <Modal open={!!reset} onClose={() => setReset(null)} title={`Reset password: ${reset?.email}`} footer={<><Button variant="secondary" onClick={() => setReset(null)}>Cancel</Button><Button onClick={doReset}>Reset</Button></>}>
        <Field label="New password" error={passErr} htmlFor="np"><input id="np" type="password" className={inputCls} value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" /></Field>
      </Modal>
      <Modal open={!!admin} onClose={() => setAdmin(null)} title="Create admin account" footer={<><Button variant="secondary" onClick={() => setAdmin(null)}>Cancel</Button><Button type="submit" form="admin-form">Create</Button></>}>
        <form id="admin-form" onSubmit={createAdmin} noValidate className="space-y-4">
          <Field label="Email *" error={adminErrors.email} htmlFor="ae"><input id="ae" type="email" className={inputCls} value={admin?.email || ''} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} /></Field>
          <Field label="Password *" error={adminErrors.password} htmlFor="ap" hint="At least 8 characters"><input id="ap" type="password" className={inputCls} value={admin?.password || ''} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} autoComplete="new-password" /></Field>
        </form>
      </Modal>
    </div>
  );
}
