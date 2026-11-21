import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import Modal from '../components/Modal';

export default function FirmSettings() {
  const [required, setRequired] = useState<boolean | null>(null);
  const [draftRequired, setDraftRequired] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.get('/firm/settings').then((r) => setRequired(r.data.settings.requireInvoiceApproval)).catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const toggle = async (v: boolean) => {
    try {
      await api.patch('/firm/settings', { requireInvoiceApproval: v });
      setRequired(v);
      setEditing(false);
      toast.success(v ? 'Approval is now required' : 'Approval is now optional');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-fbr-green-lighter">Firm administration</div>
        <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-fbr-text-light">Configure approvals and controls for your office.</p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-fbr-border bg-white shadow-sm">
        <div className="border-b border-fbr-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Invoice workflow</h2>
          <p className="mt-1 text-sm text-fbr-text-light">Choose how finalized invoices move through your firm.</p>
            </div>
            <button
              className="fbr-btn-secondary"
              disabled={required === null}
              onClick={() => {
                setDraftRequired(required ?? true);
                setEditing(true);
              }}
            >
              Configure
            </button>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${required ? 'bg-fbr-success' : 'bg-fbr-text-light/40'}`} />
          <div>
            <div className="font-medium">
              {required === null ? 'Loading approval policy…' : required ? 'Approval required' : 'Approval optional'}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-fbr-text-light">
              {required === null
                ? 'Your firm setting is being loaded.'
                : required
                ? 'Finalized invoices wait for an owner or admin to approve them before submission.'
                : 'Authorized team members can submit finalized invoices without an approval step.'}
            </p>
          </div>
        </div>
      </section>
      <Modal
        open={editing}
        title="Configure invoice approval"
        description="Choose whether finalized invoices need review before submission."
        onClose={() => setEditing(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toggle(draftRequired);
          }}
          className="space-y-5"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-fbr-border p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-fbr-green"
              checked={draftRequired}
              onChange={(e) => setDraftRequired(e.target.checked)}
            />
            <span>
              <span className="font-medium">Require approval before submission</span>
              <span className="mt-1 block text-sm leading-relaxed text-fbr-text-light">
                Invoices already awaiting approval are not changed when you turn this off.
              </span>
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="fbr-btn sm:w-auto">Save setting</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}