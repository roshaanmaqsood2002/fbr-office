import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, type Location } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import type { Buyer } from '../lib/invoice';
import { formatMoney } from '../lib/money';
import BuyerFields from '../components/BuyerFields';
import LinesEditor, { emptyRow, type ProductOption, type Row, rowsToPayload } from '../components/LinesEditor';
import Modal from '../components/Modal';

interface Tx { _id: string; externalReference: string; transactionDate: string; customerName: string; customerNtn?: string; totals: { gross: number } }
interface Cust { _id: string; name: string; registrationType: 'registered' | 'unregistered'; ntn?: string; address?: string; province?: string }

const key = (t: Tx) => `${t.customerName}|${t.customerNtn ?? ''}`;

export default function InvoiceWizard() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasBackground = !!(
    location.state as { backgroundLocation?: Location } | null
  )?.backgroundLocation;
  const [mode, setMode] = useState<'from_sales' | 'manual'>('from_sales');
  const [step, setStep] = useState(0);
  const [sales, setSales] = useState<Tx[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [buyer, setBuyer] = useState<Buyer>({ name: '', registrationType: 'registered' });
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const base = `/businesses/${id}`;
    Promise.all([
      api.get(`${base}/transactions`, { params: { status: 'unbilled', limit: 50 } }),
      api.get(`${base}/customers`, { params: { limit: 50 } }),
      api.get(`${base}/products`, { params: { limit: 50 } }),
    ])
      .then(([t, c, p]) => { setSales(t.data.items); setCustomers(c.data.items); setProducts(p.data.items); })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id]);

  const steps = mode === 'from_sales' ? ['Source', 'Sales', 'Review'] : ['Source', 'Buyer', 'Lines', 'Review'];
  const current = steps[step];
  const firstPicked = sales.find((s) => s._id === picked[0]);
  const pickedTotal = useMemo(() => sales.filter((s) => picked.includes(s._id)).reduce((t, s) => t + s.totals.gross, 0), [sales, picked]);

  const togglePick = (t: Tx) => {
    if (!picked.includes(t._id) && firstPicked && key(firstPicked) !== key(t)) return toast.error('Pick sales for one customer at a time');
    setPicked((p) => (p.includes(t._id) ? p.filter((x) => x !== t._id) : [...p, t._id]));
  };

  const useCustomer = (cid: string) => {
    const c = customers.find((x) => x._id === cid);
    if (c) setBuyer({ customerId: c._id, name: c.name, registrationType: c.registrationType, ntn: c.ntn, address: c.address, province: c.province });
  };

  const next = () => {
    if (current === 'Sales' && picked.length === 0) return toast.error('Select at least one sale');
    if (current === 'Buyer' && buyer.name.trim().length < 2) return toast.error('Enter the buyer name');
    if (current === 'Lines') { const r = rowsToPayload(rows); if (r.error) return toast.error(r.error); }
    setStep(step + 1);
  };

  const create = async () => {
    setBusy(true);
    try {
      const common = { issueDate, ...(notes && { notes }) };
      const body = mode === 'from_sales'
        ? { mode, transactionIds: picked, ...common }
        : { mode, buyer, lines: rowsToPayload(rows).lines, ...common };
      const { data } = await api.post(`/businesses/${id}/invoices`, body);
      toast.success('Draft invoice created');
      navigate(`/businesses/${id}/invoices/${data.invoice._id}`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open
      title="New invoice"
      description="Create a draft invoice from sales or enter the buyer and line items manually."
      size="xl"
      onClose={() => navigate(hasBackground ? -1 : `/businesses/${id}`)}
    >
      <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${i === step ? 'bg-fbr-green text-white' : i < step ? 'bg-fbr-bg-dark' : 'border border-fbr-border text-fbr-text-light'}`}>{i + 1}. {s}</li>
        ))}
      </ol>

      {current === 'Source' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([['from_sales', 'From sales', 'Invoice unbilled sales you already imported.'], ['manual', 'Manual', 'Type the buyer and line items yourself.']] as const).map(([m, t, d]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-xl border p-4 text-left ${mode === m ? 'border-fbr-gold bg-white ring-2 ring-fbr-gold/30' : 'border-fbr-border bg-white'}`}>
              <div className="font-medium">{t}</div><div className="mt-1 text-sm text-fbr-text-light">{d}</div>
            </button>
          ))}
        </div>
      )}

      {current === 'Sales' && (
        <div className="space-y-3">
          <p className="text-sm text-fbr-text-light">Select unbilled sales for a single customer.</p>
          <ul className="divide-y divide-fbr-border rounded-xl border border-fbr-border bg-white text-sm">
            {sales.map((t) => (
              <li key={t._id} className="flex items-center gap-3 p-3">
                <input type="checkbox" checked={picked.includes(t._id)} onChange={() => togglePick(t)} />
                <span className="font-medium">{t.externalReference}</span>
                <span className="text-fbr-text-light">{t.customerName} · {new Date(t.transactionDate).toLocaleDateString()}</span>
                <span className="ml-auto">{formatMoney(t.totals.gross)}</span>
              </li>
            ))}
            {sales.length === 0 && <li className="p-6 text-center text-fbr-text-light">No unbilled sales. Import some under Sales, or use Manual.</li>}
          </ul>
        </div>
      )}

      {current === 'Buyer' && (
        <div className="space-y-4">
          <select className="fbr-input" defaultValue="" onChange={(e) => useCustomer(e.target.value)}>
            <option value="">Pick an existing customer (optional)…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <BuyerFields value={buyer} onChange={setBuyer} />
        </div>
      )}

      {current === 'Lines' && <LinesEditor rows={rows} onChange={setRows} products={products} />}

      {current === 'Review' && (
        <div className="space-y-4 rounded-xl border border-fbr-border bg-white p-4 text-sm">
          <p>
            {mode === 'from_sales'
              ? <>Invoice for <b>{firstPicked?.customerName}</b> from <b>{picked.length}</b> sale(s), total <b>{formatMoney(pickedTotal)}</b>.</>
              : <>Manual invoice for <b>{buyer.name}</b> with <b>{rows.length}</b> line(s).</>}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-fbr-text-light">Issue date<input className="fbr-input mt-1" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
            <label className="text-fbr-text-light sm:col-span-2">Notes<input className="fbr-input mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </div>
          <p className="text-fbr-text-light">This creates a <b>draft</b>. You can validate and finalize it on the next screen.</p>
        </div>
      )}

      <div className="flex justify-between">
        <button className="text-fbr-text-light hover:text-fbr-text disabled:opacity-40" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {current === 'Review'
          ? <button className="fbr-btn w-auto" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create draft'}</button>
          : <button className="fbr-btn w-auto" onClick={next}>Next</button>}
      </div>
      </div>
    </Modal>
  );
}