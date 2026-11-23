import { type FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import { useFbrReference } from '../lib/useFbrReference';

export interface BusinessData {
  _id: string; legalName: string; tradeName?: string; businessType: string; ntn: string; strn?: string; status: string;
  address?: { line1?: string; city?: string; province?: string; postalCode?: string };
  contacts?: { name: string; email?: string; phone?: string; designation?: string }[];
}

const strip = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined)) as Partial<T>;

export default function BusinessForm({
  initial, onSaved, submitLabel,
}: { initial?: BusinessData; onSaved: (b: BusinessData) => void; submitLabel: string }) {
  const ref = useFbrReference();
  const c0 = initial?.contacts?.[0];
  const [f, setF] = useState({
    legalName: initial?.legalName ?? '', tradeName: initial?.tradeName ?? '',
    businessType: initial?.businessType ?? 'company', ntn: initial?.ntn ?? '', strn: initial?.strn ?? '',
    line1: initial?.address?.line1 ?? '', city: initial?.address?.city ?? '',
    province: initial?.address?.province ?? '', postalCode: initial?.address?.postalCode ?? '',
    contactName: c0?.name ?? '', contactEmail: c0?.email ?? '', contactPhone: c0?.phone ?? '',
    status: initial?.status ?? 'active',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const primary = f.contactName
      ? strip({ name: f.contactName, email: f.contactEmail, phone: f.contactPhone, designation: c0?.designation })
      : null;
    const payload = {
      ...strip({ legalName: f.legalName, tradeName: f.tradeName, businessType: f.businessType, ntn: f.ntn, strn: f.strn }),
      address: strip({ line1: f.line1, city: f.city, province: f.province, postalCode: f.postalCode }),
      contacts: [...(primary ? [primary] : []), ...(initial?.contacts?.slice(1) ?? [])],
      ...(initial ? { status: f.status } : {}),
    };
    try {
      const { data } = initial
        ? await api.patch(`/businesses/${initial._id}`, payload)
        : await api.post('/businesses', payload);
      toast.success(initial ? 'Client updated' : 'Client created');
      onSaved(data.business);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <input className="fbr-input sm:col-span-2" placeholder="Legal name *" value={f.legalName} onChange={set('legalName')} required />
      <input className="fbr-input" placeholder="Trade name" value={f.tradeName} onChange={set('tradeName')} />
      <select className="fbr-input" value={f.businessType} onChange={set('businessType')}>
        <option value="company">Company</option>
        <option value="aop">AOP</option>
        <option value="individual">Individual</option>
        <option value="other">Other</option>
      </select>
      <input className="fbr-input" placeholder="NTN / CNIC *" value={f.ntn} onChange={set('ntn')} required />
      <input className="fbr-input" placeholder="STRN" value={f.strn} onChange={set('strn')} />
      <input className="fbr-input sm:col-span-2" placeholder="Address" value={f.line1} onChange={set('line1')} />
      <input className="fbr-input" placeholder="City" value={f.city} onChange={set('city')} />
      <select className="fbr-input" value={f.province} onChange={set('province')}>
        <option value="">Province</option>
        {f.province && !ref?.provinces.includes(f.province) && <option value={f.province}>{f.province}</option>}
        {ref?.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input className="fbr-input" placeholder="Primary contact name" value={f.contactName} onChange={set('contactName')} />
      <input className="fbr-input" type="email" placeholder="Contact email" value={f.contactEmail} onChange={set('contactEmail')} />
      <input className="fbr-input" placeholder="Contact phone" value={f.contactPhone} onChange={set('contactPhone')} />
      {initial && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Client status</span>
          <select className="fbr-input" value={f.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
          <span className="mt-1.5 block text-xs leading-relaxed text-fbr-text-light">
            Archived clients are hidden from the default list, but invoices and audit history are retained.
          </span>
        </label>
      )}
      <div className="sm:col-span-2">
        <button className="fbr-btn w-full sm:w-auto" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}