import { useState } from 'react';
import { Shield } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Card, Field, PageHeader, inputCls } from '../components/ui.jsx';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const p = user.profile || {};

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!form.currentPassword) v.currentPassword = 'Current password is required';
    if (form.newPassword.length < 8) v.newPassword = 'New password must be at least 8 characters';
    if (form.confirm !== form.newPassword) v.confirm = 'Passwords do not match';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe); else setErrors({ currentPassword: errorMessage(err) });
    } finally { setBusy(false); }
  };

  const rows = [
    ['Name', p.fullName], ['Email', user.email], ['Role', user.role],
    p.rollNo && ['Roll number', p.rollNo], p.employeeId && ['Employee ID', p.employeeId],
    p.department && ['Department', p.department], p.phone && ['Phone', p.phone],
  ].filter(Boolean);

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your account details and password" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account details">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">{(p.fullName || user.email).charAt(0).toUpperCase()}</div>
            <div><p className="font-semibold text-slate-900">{p.fullName}</p><p className="flex items-center gap-1 text-sm capitalize text-slate-500"><Shield size={14} /> {user.role}</p></div>
          </div>
          <dl className="divide-y text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
        </Card>
        <Card title="Change password">
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field label="Current password" error={errors.currentPassword} htmlFor="cp"><input id="cp" type="password" autoComplete="current-password" className={inputCls} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
            <Field label="New password" error={errors.newPassword} htmlFor="np" hint="At least 8 characters"><input id="np" type="password" autoComplete="new-password" className={inputCls} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
            <Field label="Confirm new password" error={errors.confirm} htmlFor="cf"><input id="cf" type="password" autoComplete="new-password" className={inputCls} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
            <Button type="submit" busy={busy}>Update password</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
