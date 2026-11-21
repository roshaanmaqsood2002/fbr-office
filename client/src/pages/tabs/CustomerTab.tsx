import { type FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import Pager from '../../components/Pager';
import Modal from '../../components/Modal';

interface Customer { _id: string; name: string; registrationType: 'registered' | 'unregistered'; ntn?: string; address?: string; province?: string; phone?: string; email?: string; isActive: boolean }
const empty = { name: '', registrationType: 'registered', ntn: '', address: '', province: '', phone: '', email: '', isActive: true };
const strip = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== ''));

export default function CustomersTab({ businessId, canWrite }: { businessId: string; canWrite: boolean }) {
  const [data, setData] = useState<{ items: Customer[]; total: number; limit: number }>({ items: [], total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await api.get(`/businesses/${businessId}/customers`, { params: { search: search || undefined, page, includeInactive: true } })).data);
    } catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId, search, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const startEdit = (c: Customer) => {
    setEditId(c._id);
    setForm({ name: c.name, registrationType: c.registrationType, ntn: c.ntn ?? '', address: c.address ?? '', province: c.province ?? '', phone: c.phone ?? '', email: c.email ?? '', isActive: c.isActive });
    setOpen(true);
  };

  const startCreate = () => {
    setEditId(null);
    setForm(empty);
    setOpen(true);
  };

  const closeForm = () => {
    setOpen(false);
    setEditId(null);
    setForm(empty);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { isActive, ...fields } = form;
      const payload = {
        ...strip(fields),
        ...(editId ? { isActive } : {}),
      };
      if (editId) await api.patch(`/businesses/${businessId}/customers/${editId}`, payload);
      else await api.post(`/businesses/${businessId}/customers`, payload);
      toast.success(editId ? 'Customer updated' : 'Customer added');
      closeForm();
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const set = (k: Exclude<keyof typeof form, 'isActive'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="fbr-input max-w-xs" placeholder="Search name or NTN" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        {canWrite && <button className="fbr-btn ml-auto sm:w-auto" onClick={startCreate}>Add customer</button>}
      </div>

      <Modal
        open={open && canWrite}
        title={editId ? 'Edit customer' : 'Add customer'}
        description="Keep buyer details ready for invoicing. Deactivate customers to preserve their historical invoice references."
        size="lg"
        onClose={closeForm}
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Customer name</span>
            <input className="fbr-input" placeholder="Full legal name" value={form.name} onChange={set('name')} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Registration type</span>
            <select className="fbr-input" value={form.registrationType} onChange={set('registrationType')}>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">NTN / CNIC{form.registrationType === 'registered' ? ' *' : ''}</span>
            <input className="fbr-input" value={form.ntn} onChange={set('ntn')} required={form.registrationType === 'registered'} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Phone</span>
            <input className="fbr-input" type="tel" value={form.phone} onChange={set('phone')} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Email</span>
            <input className="fbr-input" type="email" value={form.email} onChange={set('email')} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Province</span>
            <input className="fbr-input" value={form.province} onChange={set('province')} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Address</span>
            <input className="fbr-input" value={form.address} onChange={set('address')} />
          </label>
          {editId && (
            <label className="flex items-start gap-3 rounded-xl border border-fbr-border p-3 sm:col-span-2">
              <input type="checkbox" className="mt-1 accent-fbr-green" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>
                <span className="block text-sm font-medium">Customer active</span>
                <span className="mt-1 block text-xs leading-relaxed text-fbr-text-light">Inactive customers remain available in history and can be reactivated later.</span>
              </span>
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={closeForm}>Cancel</button>
            <button className="fbr-btn sm:w-auto" disabled={busy}>{busy ? 'Saving…' : editId ? 'Save customer' : 'Add customer'}</button>
          </div>
        </form>
      </Modal>

      <div className="overflow-x-auto rounded-xl border border-fbr-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-fbr-bg-dark text-fbr-text-light">
            <tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">NTN</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c._id} className="border-t border-fbr-border">
                <td className="p-3">{c.name}</td><td className="p-3 capitalize">{c.registrationType}</td>
                <td className="p-3">{c.ntn || '—'}</td><td className="p-3">{c.phone || '—'}</td>
                <td className="p-3">{c.isActive ? '● Active' : '○ Inactive'}</td>
                <td className="p-3 text-right">
                  {canWrite && <button className="text-fbr-green-light hover:text-fbr-gold-dark" onClick={() => startEdit(c)}>Edit</button>}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-fbr-text-light">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />
    </div>
  );
}