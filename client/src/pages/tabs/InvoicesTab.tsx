import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/invoice';
import { formatMoney } from '../../lib/money';
import Pager from '../../components/Pager';

interface Row { _id: string; invoiceNumber?: string; status: string; issueDate: string; buyer: { name: string }; totals: { gross: number } }

export default function InvoicesTab({ businessId, canWrite }: { businessId: string; canWrite: boolean }) {
  const location = useLocation();
  const [data, setData] = useState<{ items: Row[]; total: number; limit: number }>({ items: [], total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try { setData((await api.get(`/businesses/${businessId}/invoices`, { params: { search: search || undefined, status: status || undefined, page } })).data); }
    catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId, search, status, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="fbr-input max-w-xs" placeholder="Search number or buyer" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="fbr-input w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {canWrite && <Link to={`/businesses/${businessId}/invoices/new`} state={{ backgroundLocation: location }} className="ml-auto fbr-btn sm:w-auto">New invoice</Link>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-fbr-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-fbr-bg-dark text-fbr-text-light"><tr><th className="p-3">Number</th><th className="p-3">Buyer</th><th className="p-3">Issued</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i._id} className="border-t border-fbr-border hover:bg-fbr-bg">
                <td className="p-3"><Link to={`/businesses/${businessId}/invoices/${i._id}`} className="font-medium text-fbr-green-light hover:text-fbr-gold-dark">{i.invoiceNumber ?? 'Draft'}</Link></td>
                <td className="p-3">{i.buyer.name}</td><td className="p-3">{new Date(i.issueDate).toLocaleDateString()}</td>
                <td className="p-3 text-right">{formatMoney(i.totals.gross)}</td><td className="p-3">{STATUS_LABEL[i.status] ?? i.status}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-fbr-text-light">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />
    </div>
  );
}