import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Pager from '../../components/Pager';
import Modal from '../../components/Modal';

interface Tx { _id: string; externalReference: string; source: string; transactionDate: string; customerName: string; lines: unknown[]; totals: { net: number; tax: number; gross: number }; status: 'unbilled' | 'invoiced' | 'void' }
interface Report { committed: boolean; rows: number; transactions: number; toCreate: number; duplicateCount: number; errorCount: number; errors: { row: number; message: string }[] }

const TEMPLATE =
  'reference,date,customer_name,customer_ntn,description,hs_code,uom,quantity,unit_price,tax_rate\n' +
  'INV-1001,2026-11-01,Acme Traders,1234567,Cotton fabric,5208.1100,Meter,10,250.00,18\n';

export default function TransactionsTab({ businessId, canWrite }: { businessId: string; canWrite: boolean }) {
  const [data, setData] = useState<{ items: Tx[]; total: number; limit: number }>({ items: [], total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await api.get(`/businesses/${businessId}/transactions`, { params: { search: search || undefined, status: status || undefined, page } })).data);
    } catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId, search, status, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const send = async (commit: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data: r } = await api.post<Report>(`/businesses/${businessId}/transactions/import`, fd, { params: { commit: commit || undefined } });
      setReport(r);
      if (commit && r.committed) {
        toast.success(`Imported ${r.toCreate} sale(s)`);
        setFile(null); setReport(null); setImportOpen(false); load();
      } else if (commit) toast.error('Nothing was imported. Fix the issues first.');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'sales-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const doVoid = async (id: string) => {
    try {
      await api.post(`/businesses/${businessId}/transactions/${id}/void`, { reason });
      toast.success('Sale voided');
      setVoidId(null); setReason(''); load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="space-y-6">
      {canWrite && (
        <>
          <div className="flex justify-end">
            <button className="fbr-btn sm:w-auto" onClick={() => setImportOpen(true)}>
              Import sales from CSV
            </button>
          </div>
          <Modal
            open={importOpen}
            title="Import sales"
            description="Review the file before committing any sales to this client's ledger."
            size="lg"
            onClose={() => setImportOpen(false)}
          >
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-fbr-text-light">
                  One row per line item. Rows sharing a <code>reference</code> become one sale. Maximum 2 MB / 5,000 rows.
                </p>
                <button className="text-sm font-medium text-fbr-green-light hover:text-fbr-gold-dark" onClick={downloadTemplate}>Download template</button>
              </div>
              <input
                type="file"
                accept=".csv"
                className="block w-full rounded-xl border border-dashed border-fbr-border bg-fbr-bg p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fbr-green file:px-3 file:py-2 file:font-medium file:text-white"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }}
              />
              <div className="flex flex-wrap gap-2">
                <button className="fbr-btn-secondary" disabled={!file || busy} onClick={() => send(false)}>Check file</button>
                <button className="fbr-btn sm:w-auto" disabled={!report || report.errorCount > 0 || report.toCreate === 0 || busy} onClick={() => send(true)}>
                  {busy ? 'Importing…' : `Import ${report && report.errorCount === 0 ? report.toCreate : ''}`}
                </button>
              </div>
              {report && (
                <div className="rounded-xl border border-fbr-border bg-fbr-bg p-4 text-sm">
                  <p>{report.rows} row(s) → {report.transactions} sale(s): <b>{report.toCreate} new</b>, {report.duplicateCount} already imported (skipped), {report.errorCount} error(s).</p>
                  {report.errorCount > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-fbr-error">
                      {report.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                      {report.errorCount > report.errors.length && <li>…and {report.errorCount - report.errors.length} more</li>}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </Modal>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <input className="fbr-input max-w-xs" placeholder="Search reference or customer" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="fbr-input w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="unbilled">Unbilled</option><option value="invoiced">Invoiced</option><option value="void">Void</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-fbr-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-fbr-bg-dark text-fbr-text-light">
            <tr><th className="p-3">Reference</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Lines</th><th className="p-3 text-right">Net</th><th className="p-3 text-right">Tax</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t._id} className="border-t border-fbr-border">
                <td className="p-3">{t.externalReference}<div className="text-xs text-fbr-text-light">{t.source}</div></td>
                <td className="p-3">{new Date(t.transactionDate).toLocaleDateString()}</td>
                <td className="p-3">{t.customerName}</td><td className="p-3">{t.lines.length}</td>
                <td className="p-3 text-right">{formatMoney(t.totals.net)}</td><td className="p-3 text-right">{formatMoney(t.totals.tax)}</td><td className="p-3 text-right">{formatMoney(t.totals.gross)}</td>
                <td className="p-3 capitalize">{t.status}</td>
                <td className="p-3 text-right">
                  {canWrite && t.status === 'unbilled' && (
                    <button className="text-fbr-error hover:underline" onClick={() => { setVoidId(t._id); setReason(''); }}>
                      Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-fbr-text-light">No sales yet. Import a CSV to get started.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />
      <Modal
        open={!!voidId}
        title="Void this sale?"
        description="This action is recorded in the audit history and cannot be undone."
        onClose={() => { setVoidId(null); setReason(''); }}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Reason</span>
            <input className="fbr-input" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} required />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={() => { setVoidId(null); setReason(''); }}>Keep sale</button>
            <button className="fbr-btn bg-fbr-error hover:bg-red-700 sm:w-auto" disabled={reason.trim().length < 3} onClick={() => { if (voidId) doVoid(voidId); }}>
              Confirm void
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}