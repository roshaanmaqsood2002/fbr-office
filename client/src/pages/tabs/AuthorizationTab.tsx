import { type FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import Modal from '../../components/Modal';

interface Auth {
  _id: string; representativeName: string; scope: string; authorizedOn: string; evidenceRef?: string;
  status: 'active' | 'revoked'; revokedAt?: string; revokeReason?: string;
}

export default function AuthorizationTab({ businessId, onChange }: { businessId: string; onChange: () => void }) {
  const { user } = useAuth();
  const manage = can(user?.role, 'authorization.manage');
  const [items, setItems] = useState<Auth[]>([]);
  const [f, setF] = useState({ representativeName: '', scope: '', authorizedOn: '', evidenceRef: '' });
  const [reason, setReason] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api.get(`/businesses/${businessId}/authorizations`)).data.authorizations);
    } catch (err) { toast.error(getErrorMessage(err)); }
  }, [businessId]);
  useEffect(() => { load(); }, [load]);

  const active = items.find((i) => i.status === 'active');

  const record = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/businesses/${businessId}/authorizations`, { ...f, evidenceRef: f.evidenceRef || undefined });
      toast.success('Authorization recorded');
      setF({ representativeName: '', scope: '', authorizedOn: '', evidenceRef: '' });
      setRecordOpen(false);
      load(); onChange();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const revoke = async (id: string) => {
    try {
      await api.post(`/businesses/${businessId}/authorizations/${id}/revoke`, { reason });
      toast.success('Authorization revoked');
      setReason(''); setRevokeOpen(false); load(); onChange();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="space-y-6">
      {active ? (
        <div className="rounded-xl border border-fbr-border bg-white p-4 text-sm">
          <div className="font-medium">Active authorization</div>
          <p className="mt-1">{active.representativeName} · {active.scope}</p>
          <p className="text-fbr-text-light">Since {new Date(active.authorizedOn).toLocaleDateString()}{active.evidenceRef && ` · Ref: ${active.evidenceRef}`}</p>
          {manage && (
            <button className="mt-4 rounded-lg border border-fbr-error/40 px-3 py-2 text-xs font-semibold text-fbr-error hover:bg-red-50" onClick={() => setRevokeOpen(true)}>
              Revoke authorization
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-fbr-warning/50 bg-white p-4 text-sm">⚠ No active authorization. FBR submissions for this client will be blocked.</div>
      )}

      {manage && !active && (
        <button className="fbr-btn sm:w-auto" onClick={() => setRecordOpen(true)}>
          Record authorization
        </button>
      )}

      <Modal
        open={recordOpen && manage && !active}
        title="Record authorization"
        description="Record the client's permission for your firm to act on their behalf."
        size="lg"
        onClose={() => setRecordOpen(false)}
      >
        <form onSubmit={record} className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Representative name</span>
            <input className="fbr-input" value={f.representativeName} onChange={(e) => setF({ ...f, representativeName: e.target.value })} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Authorized on</span>
            <input className="fbr-input" type="date" value={f.authorizedOn} onChange={(e) => setF({ ...f, authorizedOn: e.target.value })} required />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Authorized scope</span>
            <input className="fbr-input" placeholder="e.g. Prepare and submit sales invoices to FBR" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} required />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Evidence reference (optional)</span>
            <input className="fbr-input" placeholder="Document or letter number" value={f.evidenceRef} onChange={(e) => setF({ ...f, evidenceRef: e.target.value })} />
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={() => setRecordOpen(false)}>Cancel</button>
            <button className="fbr-btn sm:w-auto">Record authorization</button>
          </div>
        </form>
      </Modal>
      <Modal
        open={revokeOpen}
        title="Revoke authorization?"
        description="FBR submissions will be blocked until a new authorization is recorded."
        onClose={() => setRevokeOpen(false)}
      >
        <form onSubmit={(e) => { e.preventDefault(); if (active) revoke(active._id); }} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Reason for revoking</span>
            <input className="fbr-input" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} required />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={() => setRevokeOpen(false)}>Keep authorization</button>
            <button className="fbr-btn bg-fbr-error hover:bg-red-700 sm:w-auto" disabled={reason.trim().length < 3}>Revoke authorization</button>
          </div>
        </form>
      </Modal>

      {items.some((i) => i.status === 'revoked') && (
        <section>
          <h2 className="mb-2 font-medium">History</h2>
          <ul className="divide-y divide-fbr-border rounded-xl border border-fbr-border bg-white text-sm">
            {items.filter((i) => i.status === 'revoked').map((i) => (
              <li key={i._id} className="p-3">{i.representativeName} · revoked {i.revokedAt && new Date(i.revokedAt).toLocaleDateString()} · {i.revokeReason}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}