import type { Buyer } from '../lib/invoice';

export default function BuyerFields({ value, onChange }: { value: Buyer; onChange: (b: Buyer) => void }) {
  const set = <K extends keyof Buyer>(k: K, v: Buyer[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input className="fbr-input" placeholder="Buyer name *" value={value.name} onChange={(e) => set('name', e.target.value)} required />
      <select className="fbr-input" value={value.registrationType} onChange={(e) => set('registrationType', e.target.value as Buyer['registrationType'])}>
        <option value="registered">Registered</option><option value="unregistered">Unregistered</option>
      </select>
      <input className="fbr-input" placeholder={value.registrationType === 'registered' ? 'NTN / CNIC *' : 'NTN / CNIC'} value={value.ntn ?? ''} onChange={(e) => set('ntn', e.target.value || undefined)} />
      <input className="fbr-input" placeholder="Province" value={value.province ?? ''} onChange={(e) => set('province', e.target.value || undefined)} />
      <input className="fbr-input sm:col-span-2" placeholder="Address" value={value.address ?? ''} onChange={(e) => set('address', e.target.value || undefined)} />
    </div>
  );
}