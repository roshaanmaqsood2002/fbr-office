import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import type { Invoice } from '../lib/invoice';
import { formatMoney } from '../lib/money';
import Modal from './Modal';

type Env = 'sandbox' | 'production';

export default function FbrPanel({ businessId, invoice, onChanged }: { businessId: string; invoice: Invoice; onChanged: () => void }) {
  const { user } = useAuth();
  const canSubmit = can(user?.role, 'fbr.submit');
  const canRevise = can(user?.role, 'invoice.write');
  const [connected, setConnected] = useState<Env[]>([]);
  const [env, setEnv] = useState<Env>('sandbox');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = invoice.status;
  const base = `/businesses/${businessId}/fbr`;

  useEffect(() => {
    if (s !== 'ready_to_submit') return;
    api.get(`${base}/integrations`).then((r) => {
      const ok = (r.data.integrations as { environment: Env; status: string }[]).filter((i) => i.status === 'connected').map((i) => i.environment);
      setConnected(ok);
      if (ok.length && !ok.includes(env)) setEnv(ok[0]);
    }).catch(() => undefined);
  }, [s, base]); // eslint-disable-line react-hooks/exhaustive-deps

  // While FBR is processing, refresh the invoice every few seconds
  useEffect(() => {
    if (s !== 'submitted') return;
    const t = setInterval(onChanged, 4000);
    return () => clearInterval(t);
  }, [s, onChanged]);

  const act = async (path: string, body: object | undefined, ok: string) => {
    setBusy(true);
    try { await api.post(`${base}/invoices/${invoice._id}/${path}`, body); toast.success(ok); setConfirm(false); onChanged(); }
    catch (err) { toast.error(getErrorMessage(err)); onChanged(); }
    finally { setBusy(false); }
  };

  if (!['ready_to_submit', 'submitted', 'accepted', 'rejected', 'action_required'].includes(s)) return null;

  return (
    <section className="space-y-3 rounded-xl border border-fbr-gold/40 bg-white p-4 text-sm">
      <h2 className="font-medium">FBR submission</h2>

      {s === 'ready_to_submit' && (connected.length === 0 ? (
        <p className="text-fbr-text-light">Connect FBR for this client first (client page → FBR tab).</p>
      ) : !canSubmit ? (
        <p className="text-fbr-text-light">You do not have permission to submit to FBR.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <select className="fbr-input w-44" value={env} onChange={(e) => setEnv(e.target.value as Env)}>
            {connected.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button className="fbr-btn sm:w-auto" onClick={() => setConfirm(true)}>Submit to FBR…</button>
        </div>
      ))}

      <Modal
        open={confirm}
        title={`Submit invoice to FBR (${env})?`}
        description={`Send ${invoice.invoiceNumber} to ${invoice.buyer.name} for ${formatMoney(invoice.totals.gross)}.`}
        onClose={() => setConfirm(false)}
      >
        {env === 'production' && (
          <p className="rounded-xl border border-fbr-warning/30 bg-fbr-warning/10 p-4 text-sm text-fbr-warning">
            This is the production environment. The invoice can no longer be edited once sent.
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="fbr-btn-secondary" onClick={() => setConfirm(false)}>Go back</button>
          <button className="fbr-btn sm:w-auto" disabled={busy} onClick={() => act('submit', { environment: env }, 'Queued for FBR')}>
            {busy ? 'Sending…' : 'Yes, submit'}
          </button>
        </div>
      </Modal>

      {s === 'submitted' && <p className="animate-pulse-soft">Submitted. Waiting for FBR’s response…</p>}
      {s === 'accepted' && <p>✔ Accepted by FBR. FBR invoice number: <b>{invoice.fbrInvoiceNumber}</b></p>}

      {(s === 'rejected' || s === 'action_required') && (
        <div className="space-y-3">
          <p className="text-fbr-error">{s === 'rejected' ? 'Rejected by FBR' : 'Needs your attention'}: {invoice.fbrLastError}</p>
          <div className="flex flex-wrap gap-3">
            {canRevise && <button className="rounded-lg border border-fbr-border px-3 py-1.5" disabled={busy} onClick={() => act('revise', undefined, 'Moved back to draft')}>Fix as draft</button>}
            {s === 'action_required' && canSubmit && <button className="rounded-lg border border-fbr-border px-3 py-1.5" disabled={busy} onClick={() => act('reopen', undefined, 'Ready to submit again')}>Back to ready to submit</button>}
          </div>
        </div>
      )}
    </section>
  );
}