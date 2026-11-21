import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { api, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/permissions";
import {
  type Buyer,
  type Invoice,
  type Issue,
  STATUS_LABEL,
} from "../lib/invoice";
import { formatMoney } from "../lib/money";
import BuyerFields from "../components/BuyerFields";
import LinesEditor, {
  linesToRows,
  type ProductOption,
  type Row,
  rowsToPayload,
} from "../components/LinesEditor";
import FbrPanel from "../components/FbrPanel";
import Modal from "../components/Modal";

export default function InvoiceDetail() {
  const { id = "", invoiceId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = `/businesses/${id}/invoices/${invoiceId}`;
  const [inv, setInv] = useState<Invoice | null>(null);
  const [issues, setIssues] = useState<{
    errors: Issue[];
    warnings: Issue[];
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [issueDate, setIssueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [reason, setReason] = useState("");
  const [reasonFor, setReasonFor] = useState<"return" | "cancel" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setInv((await api.get(base)).data.invoice);
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate(`/businesses/${id}`);
    }
  }, [base, id, navigate]);
  useEffect(() => {
    load();
  }, [load]);

  // Run an action; on a 422 show the validation issues returned by the server
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      setIssues(null);
      setReasonFor(null);
      setReason("");
      await load();
      return true;
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 422 &&
        err.response.data?.details
      )
        setIssues(err.response.data.details);
      toast.error(getErrorMessage(err));
      return false;
    }
  };

  const startEdit = async () => {
    if (!inv) return;
    setBuyer(inv.buyer);
    setRows(linesToRows(inv.lines));
    setIssueDate(inv.issueDate.slice(0, 10));
    setNotes(inv.notes ?? "");
    try {
      setProducts(
        (await api.get(`/businesses/${id}/products`, { params: { limit: 50 } }))
          .data.items,
      );
    } catch {
      /* optional */
    }
    setEditing(true);
  };

  const save = async () => {
    const r = rowsToPayload(rows);
    if (r.error) return toast.error(r.error);
    const { customerId, ...b } = buyer!; // keep the link if present
    const saved = await act(
      () =>
        api.patch(base, {
          buyer: { ...b, ...(customerId && { customerId }) },
          lines: r.lines,
          issueDate,
          notes,
        }),
      "Draft saved",
    );
    if (saved) setEditing(false);
  };

  const deleteDraft = async () => {
    try {
      await api.delete(base);
      toast.success("Draft deleted");
      setDeleteOpen(false);
      navigate(`/businesses/${id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const pdf = async () => {
    try {
      const { data } = await api.get(`${base}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv?.invoiceNumber ?? "draft-invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!inv)
    return <p className="animate-pulse-soft text-fbr-text-light">Loading…</p>;

  const write = can(user?.role, "invoice.write");
  const approve = can(user?.role, "invoice.approve");
  const s = inv.status;

  return (
    <div className="space-y-6">
      <Link
        to={`/businesses/${id}`}
        className="text-sm text-fbr-green-light hover:text-fbr-gold-dark"
      >
        ← Back to client
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">
            {inv.invoiceNumber ?? "Draft invoice"}
          </h1>
          <p className="text-sm text-fbr-text-light">
            Status: <b className="text-fbr-text">{STATUS_LABEL[s] ?? s}</b> ·
            Issued {new Date(inv.issueDate).toLocaleDateString()}
          </p>
        </div>
        <button
          className="rounded-lg border border-fbr-green px-3 py-1.5 text-sm text-fbr-green hover:bg-fbr-green hover:text-white"
          onClick={pdf}
        >
          Download PDF
        </button>
      </div>

      {inv.returnReason && s === "draft" && (
        <div className="rounded-lg border border-fbr-warning/50 bg-white p-3 text-sm">
          ⚠ Returned for changes: {inv.returnReason}
        </div>
      )}

      {/* Workflow actions */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          className="rounded-lg border border-fbr-border bg-white px-3 py-1.5"
          onClick={async () => {
            try {
              setIssues((await api.post(`${base}/validate`)).data);
            } catch (e) {
              toast.error(getErrorMessage(e));
            }
          }}
        >
          Validate
        </button>
        {s === "draft" && write && (
          <>
            <button
              className="rounded-lg border border-fbr-border bg-white px-3 py-1.5"
              onClick={editing ? () => setEditing(false) : startEdit}
            >
              {editing ? "Cancel editing" : "Edit"}
            </button>
            <button
              className="rounded-lg bg-fbr-green px-3 py-1.5 text-white hover:bg-fbr-green-light"
              onClick={() =>
                act(() => api.post(`${base}/finalize`), "Invoice finalized")
              }
            >
              Finalize
            </button>
            {!inv.invoiceNumber && (
              <button
                className="px-3 py-1.5 text-fbr-error"
                onClick={() => setDeleteOpen(true)}
              >
                Delete draft
              </button>
            )}
          </>
        )}
        {s === "awaiting_approval" && approve && (
          <>
            <button
              className="rounded-lg bg-fbr-green px-3 py-1.5 text-white hover:bg-fbr-green-light"
              onClick={() =>
                act(() => api.post(`${base}/approve`), "Invoice approved")
              }
            >
              Approve
            </button>
            <button
              className="rounded-lg border border-fbr-border bg-white px-3 py-1.5"
              onClick={() => setReasonFor("return")}
            >
              Return for changes
            </button>
          </>
        )}
        {s === "ready_to_submit" && write && (
          <button
            className="rounded-lg border border-fbr-border bg-white px-3 py-1.5"
            onClick={() =>
              act(() => api.post(`${base}/withdraw`), "Moved back to draft")
            }
          >
            Withdraw to draft
          </button>
        )}
        {["draft", "awaiting_approval", "ready_to_submit"].includes(s) &&
          write && (
            <button
              className="px-3 py-1.5 text-fbr-error"
              onClick={() => setReasonFor("cancel")}
            >
              Cancel invoice
            </button>
          )}
        {s === "ready_to_submit" && (
          <FbrPanel businessId={id} invoice={inv} onChanged={load} />
        )}
      </div>

      <Modal
        open={!!reasonFor}
        title={reasonFor === "return" ? "Return invoice for changes" : "Cancel invoice"}
        description={reasonFor === "return" ? "Explain what needs to be corrected before this invoice can be approved." : "This will cancel the invoice and record the reason in the audit history."}
        onClose={() => { setReasonFor(null); setReason(""); }}
      >
        {reasonFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.post(`${base}/${reasonFor}`, { reason }), reasonFor === "return" ? "Returned to draft" : "Invoice cancelled");
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Reason</span>
              <input
                className="fbr-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={3}
                required
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="fbr-btn-secondary" onClick={() => { setReasonFor(null); setReason(""); }}>Go back</button>
              <button className="fbr-btn sm:w-auto" disabled={reason.trim().length < 3}>Confirm</button>
            </div>
          </form>
        )}
      </Modal>

      {issues &&
        (issues.errors.length > 0 || issues.warnings.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-fbr-border bg-white p-4 text-sm">
            {issues.errors.length > 0 && (
              <div>
                <div className="font-medium text-fbr-error">
                  Must fix ({issues.errors.length})
                </div>
                <ul className="list-disc pl-5">
                  {issues.errors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {issues.warnings.length > 0 && (
              <div>
                <div className="font-medium text-fbr-warning">
                  Review ({issues.warnings.length})
                </div>
                <ul className="list-disc pl-5">
                  {issues.warnings.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-fbr-border bg-white p-3 text-sm">
            ✔ No issues found.
          </div>
        ))}

      {editing && buyer && (
        <Modal
          open={editing}
          title="Edit draft invoice"
          description="Update buyer, invoice lines, date, and notes before finalizing."
          size="xl"
          onClose={() => setEditing(false)}
        >
        <div className="space-y-5">
          <BuyerFields value={buyer} onChange={setBuyer} />
          <LinesEditor rows={rows} onChange={setRows} products={products} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="fbr-input"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            <input
              className="fbr-input"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="fbr-btn sm:w-auto" onClick={save}>Save draft</button>
          </div>
        </div>
        </Modal>
      )}
      {!editing && (
        <>
          <section className="rounded-xl border border-fbr-border bg-white p-4 text-sm">
            <div className="text-fbr-text-light">Bill to</div>
            <div className="font-medium">{inv.buyer.name}</div>
            <div>
              {inv.buyer.registrationType}
              {inv.buyer.ntn && ` · NTN ${inv.buyer.ntn}`}
            </div>
            <div className="text-fbr-text-light">
              {[inv.buyer.address, inv.buyer.province]
                .filter(Boolean)
                .join(", ")}
            </div>
          </section>
          <div className="overflow-x-auto rounded-xl border border-fbr-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-fbr-bg-dark text-fbr-text-light">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3">HS code</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Tax</th>
                  <th className="p-3 text-right">Net</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} className="border-t border-fbr-border">
                    <td className="p-3">{l.description}</td>
                    <td className="p-3">{l.hsCode || "—"}</td>
                    <td className="p-3">
                      {l.quantity} {l.uom}
                    </td>
                    <td className="p-3 text-right">
                      {formatMoney(l.unitPrice)}
                    </td>
                    <td className="p-3 text-right">{l.taxRatePercent}%</td>
                    <td className="p-3 text-right">
                      {formatMoney(l.net ?? 0)}
                    </td>
                    <td className="p-3 text-right">
                      {formatMoney(l.gross ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-fbr-border text-sm">
                <tr>
                  <td
                    colSpan={6}
                    className="p-3 text-right text-fbr-text-light"
                  >
                    Net
                  </td>
                  <td className="p-3 text-right">
                    {formatMoney(inv.totals.net)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={6}
                    className="p-3 text-right text-fbr-text-light"
                  >
                    Tax
                  </td>
                  <td className="p-3 text-right">
                    {formatMoney(inv.totals.tax)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="p-3 text-right font-medium">
                    Total
                  </td>
                  <td className="p-3 text-right font-medium">
                    {formatMoney(inv.totals.gross)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {inv.notes && (
            <p className="text-sm text-fbr-text-light">Notes: {inv.notes}</p>
          )}
        </>
      )}
      <Modal
        open={deleteOpen}
        title="Delete draft invoice?"
        description="Only unnumbered draft invoices can be deleted. This cannot be undone."
        onClose={() => setDeleteOpen(false)}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="fbr-btn-secondary" onClick={() => setDeleteOpen(false)}>Keep draft</button>
          <button type="button" className="fbr-btn bg-fbr-error hover:bg-red-700 sm:w-auto" onClick={deleteDraft}>Delete draft</button>
        </div>
      </Modal>
    </div>
  );
}
