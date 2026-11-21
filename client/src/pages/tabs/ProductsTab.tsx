import { type FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import { formatMoney, fromMinor, toMinor } from '../../lib/money';
import Pager from '../../components/Pager';
import Modal from '../../components/Modal';

interface Product { _id: string; name: string; sku?: string; hsCode?: string; uom: string; unitPrice: number; taxRatePercent: number; isActive: boolean }
const empty = { name: '', sku: '', hsCode: '', uom: 'Unit', unitPrice: '', taxRatePercent: '18', isActive: true };

export default function ProductsTab({ businessId, canWrite }: { businessId: string; canWrite: boolean }) {
  const [data, setData] = useState<{ items: Product[]; total: number; limit: number }>({ items: [], total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/businesses/${businessId}/products`, {
        params: { search: search || undefined, page, includeInactive: showInactive || undefined },
      });
      setData(data);
    } catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId, search, page, showInactive]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const startEdit = (p: Product) => {
    setEditId(p._id);
    setForm({ name: p.name, sku: p.sku ?? '', hsCode: p.hsCode ?? '', uom: p.uom, unitPrice: fromMinor(p.unitPrice), taxRatePercent: String(p.taxRatePercent), isActive: p.isActive });
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
    const price = toMinor(form.unitPrice);
    if (price === null) return toast.error('Enter a valid price, e.g. 1250.50');
    const rate = Number(form.taxRatePercent);
    if (Number.isNaN(rate)) return toast.error('Enter a valid tax rate');
    const payload = {
      name: form.name, uom: form.uom, unitPrice: price, taxRatePercent: rate,
      ...(form.sku && { sku: form.sku }), ...(form.hsCode && { hsCode: form.hsCode }),
      ...(editId ? { isActive: form.isActive } : {}),
    };
    setBusy(true);
    try {
      if (editId) await api.patch(`/businesses/${businessId}/products/${editId}`, payload);
      else await api.post(`/businesses/${businessId}/products`, payload);
      toast.success(editId ? 'Product updated' : 'Product added');
      closeForm();
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="fbr-input max-w-xs" placeholder="Search name, SKU, HS code" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
        {canWrite && <button className="fbr-btn ml-auto sm:w-auto" onClick={startCreate}>Add product</button>}
      </div>

      <Modal
        open={open && canWrite}
        title={editId ? 'Edit product' : 'Add product'}
        description="Maintain product details used for invoices. Deactivate products to keep historical invoice references intact."
        size="lg"
        onClose={closeForm}
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Product name</span>
            <input className="fbr-input" placeholder="Product or service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">SKU</span>
            <input className="fbr-input" placeholder="Optional" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">HS code</span>
            <input className="fbr-input" placeholder="Optional" value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Unit of measure</span>
            <input className="fbr-input" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Unit price (Rs)</span>
            <input className="fbr-input" inputMode="decimal" placeholder="0.00" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Tax rate (%)</span>
            <input className="fbr-input" inputMode="decimal" value={form.taxRatePercent} onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })} required />
          </label>
          {editId && (
            <label className="flex items-start gap-3 rounded-xl border border-fbr-border p-3 sm:col-span-2">
              <input type="checkbox" className="mt-1 accent-fbr-green" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>
                <span className="block text-sm font-medium">Product active</span>
                <span className="mt-1 block text-xs leading-relaxed text-fbr-text-light">Inactive products are hidden from invoice entry; existing invoice records are preserved.</span>
              </span>
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={closeForm}>Cancel</button>
            <button className="fbr-btn sm:w-auto" disabled={busy}>{busy ? 'Saving…' : editId ? 'Save product' : 'Add product'}</button>
          </div>
        </form>
      </Modal>

      <div className="overflow-x-auto rounded-xl border border-fbr-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-fbr-bg-dark text-fbr-text-light">
            <tr><th className="p-3">Product</th><th className="p-3">HS code</th><th className="p-3">UOM</th><th className="p-3">Price</th><th className="p-3">Tax</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p._id} className="border-t border-fbr-border">
                <td className="p-3">{p.name}{p.sku && <div className="text-xs text-fbr-text-light">{p.sku}</div>}</td>
                <td className="p-3">{p.hsCode || '—'}</td><td className="p-3">{p.uom}</td>
                <td className="p-3">{formatMoney(p.unitPrice)}</td><td className="p-3">{p.taxRatePercent}%</td>
                <td className="p-3">{p.isActive ? '● Active' : '○ Inactive'}</td>
                <td className="p-3 text-right">
                  {canWrite && <button className="text-fbr-green-light hover:text-fbr-gold-dark" onClick={() => startEdit(p)}>Edit</button>}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-fbr-text-light">No products yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />
    </div>
  );
}