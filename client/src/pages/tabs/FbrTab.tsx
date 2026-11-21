import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { formatMoney } from '../../lib/money';
import Pager from '../../components/Pager';
import Modal from '../../components/Modal';

type Env = 'sandbox' | 'production';
interface Integration { environment: Env; status: 'connected' | 'disconnected' | 'error'; tokenLast4?: string; lastTestedAt?: string; lastTestMessage?: string }
interface Attempt { at: string; outcome: string; httpStatus?: number; message?: string }
interface Sub {
  _id: string; invoiceId: string; invoiceNumber?: string; buyerName?: string; gross?: number; environment: Env; status: string;
  fbrInvoiceNumber?: string; lastError?: string; errors?: { code?: string; field?: string; message: string }[]; attempts: Attempt[]; updatedAt: string;
}

const GROUPS = [['pending', 'Pending'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['attention', 'Needs action']] as const;
const LABEL: Record<string, string> = { queued: 'Queued', processing: 'Sending…', accepted: 'Accepted', rejected: 'Rejected', failed: 'Needs action' };

function Connection({ env, businessId, integ, canManage, onChange }: { env: Env; businessId: string; integ?: Integration; canManage: boolean; onChange: () => void }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const url = `/businesses/${businessId}/fbr/integrations/${env}`;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setToken(''); onChange(); return true; }
    catch (err) { toast.error(getErrorMessage(err)); onChange(); return false; }
    finally { setBusy(false); }
  };

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api.put(url, { token }), 'FBR connected')) setConnectOpen(false);
  };

  const disconnect = async () => {
    if (await run(() => api.delete(url), 'Disconnected')) setDisconnectOpen(false);
  };

  const connected = integ?.status === 'connected';
  return (
    <div className="space-y-3 rounded-xl border border-fbr-border bg-white p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-medium capitalize">{env}</h3>
        <span>{connected ? '✔ Connected' : integ?.status === 'error' ? '⚠ Connection error' : '○ Not connected'}</span>
      </div>
      {env === 'production' && <p className="text-xs text-fbr-warning">Production sends real invoices to FBR.</p>}
      {integ?.tokenLast4 && <p className="text-fbr-text-light">Token ••••{integ.tokenLast4}{integ.lastTestedAt && ` · tested ${new Date(integ.lastTestedAt).toLocaleString()}`}</p>}
      {integ?.lastTestMessage && <p className="text-fbr-text-light">{integ.lastTestMessage}</p>}
      {canManage && (
        <>
          <div className="flex flex-wrap gap-2">
            <button className="fbr-btn-secondary" disabled={busy} onClick={() => setConnectOpen(true)}>
              {connected ? 'Replace token' : 'Connect FBR'}
            </button>
          {integ && integ.status !== 'disconnected' && (
            <div className="flex items-center gap-4">
              <button className="text-fbr-green-light hover:text-fbr-gold-dark" disabled={busy} onClick={() => run(async () => { const r = await api.post(url + '/test'); if (!r.data.ok) throw new Error(r.data.message); }, 'Connection works')}>Test connection</button>
              <button className="text-fbr-error hover:underline" disabled={busy} onClick={() => setDisconnectOpen(true)}>Disconnect</button>
            </div>
          )}
          </div>
          <Modal
            open={connectOpen}
            title={connected ? `Replace ${env} token` : `Connect ${env}`}
            description="The access token is encrypted and never returned to the browser."
            onClose={() => { setConnectOpen(false); setToken(''); }}
          >
            <form onSubmit={connect} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">FBR access token</span>
                <input className="fbr-input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} minLength={8} required />
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="fbr-btn-secondary" onClick={() => { setConnectOpen(false); setToken(''); }}>Cancel</button>
                <button className="fbr-btn sm:w-auto" disabled={busy || token.length < 8}>{busy ? 'Connecting…' : connected ? 'Replace token' : 'Connect'}</button>
              </div>
            </form>
          </Modal>
          <Modal
            open={disconnectOpen}
            title={`Disconnect ${env}?`}
            description="Queued submissions for this environment will stop until a new connection is configured."
            onClose={() => setDisconnectOpen(false)}
          >
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="fbr-btn-secondary" onClick={() => setDisconnectOpen(false)}>Keep connection</button>
              <button className="fbr-btn bg-fbr-error hover:bg-red-700 sm:w-auto" disabled={busy} onClick={disconnect}>Disconnect</button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

export default function FbrTab({ businessId }: { businessId: string }) {
  const { user } = useAuth();
  const canManage = can(user?.role, 'fbr.manage');
  const [adapter, setAdapter] = useState('mock');
  const [integs, setIntegs] = useState<Integration[]>([]);
  const [group, setGroup] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Sub[]; total: number; limit: number; counts: Record<string, number> }>({ items: [], total: 0, limit: 20, counts: {} });
  const [open, setOpen] = useState<string | null>(null);

  const loadIntegs = useCallback(async () => {
    try { const r = await api.get(`/businesses/${businessId}/fbr/integrations`); setAdapter(r.data.adapter); setIntegs(r.data.integrations); }
    catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId]);

  const loadSubs = useCallback(async () => {
    try { setData((await api.get(`/businesses/${businessId}/fbr/submissions`, { params: { group, page } })).data); }
    catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId, group, page]);

  useEffect(() => { loadIntegs(); }, [loadIntegs]);
  useEffect(() => { loadSubs(); const t = setInterval(loadSubs, 5000); return () => clearInterval(t); }, [loadSubs]); // live-ish updates while jobs run

  return (
    <div className="space-y-8">
      {adapter === 'mock' && (
        <div className="rounded-lg border border-fbr-gold/50 bg-white p-3 text-sm">
          <b>Test mode:</b> FBR is simulated. Use a token starting with <code>test_</code>. Nothing is sent to FBR.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {(['sandbox', 'production'] as Env[]).map((e) => (
          <Connection key={e} env={e} businessId={businessId} integ={integs.find((i) => i.environment === e)} canManage={canManage} onChange={loadIntegs} />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Submissions</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {GROUPS.map(([k, label]) => (
            <button key={k} onClick={() => { setGroup(k); setPage(1); }} className={`rounded-full px-3 py-1 ${group === k ? 'bg-fbr-green text-white' : 'border border-fbr-border bg-white'}`}>
              {label} ({data.counts[k] ?? 0})
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-fbr-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-fbr-bg-dark text-fbr-text-light"><tr><th className="p-3">Invoice</th><th className="p-3">Buyer</th><th className="p-3 text-right">Total</th><th className="p-3">Env</th><th className="p-3">Status</th><th className="p-3">Tries</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <Fragment key={s._id}>
                  <tr className="border-t border-fbr-border">
                    <td className="p-3"><Link className="font-medium text-fbr-green-light hover:text-fbr-gold-dark" to={`/businesses/${businessId}/invoices/${s.invoiceId}`}>{s.invoiceNumber}</Link>{s.fbrInvoiceNumber && <div className="text-xs text-fbr-text-light">FBR: {s.fbrInvoiceNumber}</div>}</td>
                    <td className="p-3">{s.buyerName}</td><td className="p-3 text-right">{formatMoney(s.gross ?? 0)}</td>
                    <td className="p-3 capitalize">{s.environment}</td><td className="p-3">{LABEL[s.status] ?? s.status}</td><td className="p-3">{s.attempts.length}</td>
                    <td className="p-3 text-right"><button className="text-fbr-green-light hover:text-fbr-gold-dark" onClick={() => setOpen(open === s._id ? null : s._id)}>{open === s._id ? 'Hide' : 'Details'}</button></td>
                  </tr>
                  {open === s._id && (
                    <tr className="bg-fbr-bg"><td colSpan={7} className="space-y-2 p-3 text-xs">
                      {s.lastError && <p className="text-fbr-error">{s.lastError}</p>}
                      {s.errors?.map((e, i) => <p key={i}>{e.code && `[${e.code}] `}{e.field && `${e.field}: `}{e.message}</p>)}
                      <ul className="space-y-1">{s.attempts.map((a, i) => <li key={i}>#{i + 1} · {new Date(a.at).toLocaleString()} · {a.outcome.replace('_', ' ')}{a.httpStatus && ` (${a.httpStatus})`}{a.message && ` · ${a.message}`}</li>)}</ul>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {data.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-fbr-text-light">Nothing in this list.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />
      </section>
    </div>
  );
}