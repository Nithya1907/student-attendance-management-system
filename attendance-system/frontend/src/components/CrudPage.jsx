import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api/client';
import useFetch from '../utils/useFetch';
import { useToast } from '../context/ToastContext.jsx';
import DataTable from './DataTable.jsx';
import { Button, ConfirmDialog, Field, Modal, PageHeader, inputCls } from './ui.jsx';

/**
 * Generic list + create/edit modal + delete confirmation.
 * fields: [{ name, label, type, required, minLength, pattern, patternMessage, createOnly, lookup: {url, label} , options, hint }]
 */
export default function CrudPage({ title, subtitle, endpoint, entity, columns, fields, searchKeys, toRow, embedded, lookups = {} }) {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(endpoint);
  const [lookupData, setLookupData] = useState({});
  useEffect(() => {
    Promise.all(Object.entries(lookups).map(([k, url]) => api.get(url).then((r) => [k, r.data])))
      .then((entries) => setLookupData(Object.fromEntries(entries)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  const isNew = editing && !editing.id;
  const visibleFields = fields.filter((f) => !(f.createOnly && !isNew));

  const openForm = (row) => {
    setErrors({});
    setForm(row ? (toRow ? toRow(row) : { ...row }) : Object.fromEntries(fields.map((f) => [f.name, f.type === 'checkbox' ? false : ''])));
    setEditing(row || {});
  };

  const validate = () => {
    const e = {};
    visibleFields.forEach((f) => {
      const v = String(form[f.name] ?? '').trim();
      if (f.required && !v && f.type !== 'checkbox') e[f.name] = `${f.label} is required`;
      else if (v && f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) e[f.name] = 'Enter a valid email address';
      else if (v && f.minLength && v.length < f.minLength) e[f.name] = `${f.label} must be at least ${f.minLength} characters`;
      else if (v && f.pattern && !f.pattern.test(v)) e[f.name] = f.patternMessage || `${f.label} is invalid`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      fields.forEach((f) => { if (f.type === 'number' || f.type === 'select') payload[f.name] = payload[f.name] === '' ? null : Number(payload[f.name]); });
      if (isNew) await api.post(endpoint, payload); else await api.put(`${endpoint}/${editing.id}`, payload);
      toast.success(`${entity} ${isNew ? 'added' : 'updated'} successfully`);
      setEditing(null);
      reload();
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe); else toast.error(errorMessage(e));
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    setDelBusy(true);
    try {
      await api.delete(`${endpoint}/${deleting.id}`);
      toast.success(`${entity} deleted`);
      setDeleting(null);
      reload();
    } catch (e) { toast.error(errorMessage(e)); setDeleting(null); } finally { setDelBusy(false); }
  };

  const optionsFor = (f) => (f.options || (f.lookup ? (lookupData[f.lookup.key] || []).map((o) => ({ value: o.id, label: o[f.lookup.label] })) : []));

  return (
    <div>
      {!embedded && <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => openForm(null)}><Plus size={16} /> Add {entity}</Button>} />}
      {embedded && <div className="mb-3 flex justify-end"><Button onClick={() => openForm(null)}><Plus size={16} /> Add {entity}</Button></div>}
      <DataTable columns={columns} rows={data} loading={loading} error={error} onRetry={reload} searchKeys={searchKeys}
        emptyTitle={`No ${entity.toLowerCase()} records`} emptyMessage={`Click "Add ${entity}" to create the first one.`}
        rowActions={(row) => (
          <>
            <button onClick={() => openForm(row)} aria-label={`Edit ${entity}`} className="rounded p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={16} /></button>
            <button onClick={() => setDeleting(row)} aria-label={`Delete ${entity}`} className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>
          </>
        )} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`${isNew ? 'Add' : 'Edit'} ${entity}`}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button busy={saving} type="submit" form="crud-form">Save</Button></>}>
        <form id="crud-form" onSubmit={save} noValidate className="space-y-4">
          {visibleFields.map((f) => (
            <Field key={f.name} label={`${f.label}${f.required ? ' *' : ''}`} error={errors[f.name]} hint={f.hint} htmlFor={`f-${f.name}`}>
              {f.type === 'select' ? (
                <select id={`f-${f.name}`} className={inputCls} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  <option value="">Select...</option>
                  {optionsFor(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <input id={`f-${f.name}`} type="checkbox" className="h-4 w-4" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
              ) : (
                <input id={`f-${f.name}`} type={f.type || 'text'} className={inputCls} value={form[f.name] ?? ''} autoComplete="off"
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              )}
            </Field>
          ))}
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} busy={delBusy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
        message={`Delete this ${entity.toLowerCase()}? This action cannot be undone and may remove related records.`} />
    </div>
  );
}
