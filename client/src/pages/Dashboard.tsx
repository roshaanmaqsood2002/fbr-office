import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/permissions";
import { STATUS_LABEL } from "../lib/invoice";
import { formatMoney } from "../lib/money";

interface InvoiceRow {
  _id: string;
  businessId: string;
  businessName: string;
  invoiceNumber?: string;
  status?: string;
  issueDate?: string;
  buyerName?: string;
  gross: number;
}
interface DashboardData {
  kpis: {
    activeClients: number;
    clientsMissingAuthorization: number;
    unbilledCount: number;
    unbilledGross: number;
    awaitingApproval: number;
    readyToSubmit: number;
  };
  invoicesByStatus: Record<string, number>;
  attention: {
    missingAuthorization: { _id: string; legalName: string }[];
    awaitingApproval: InvoiceRow[];
  };
  recentInvoices: InvoiceRow[];
  recentActivity:
    | {
        _id: string;
        summary: string;
        actorName: string;
        actorRole: string;
        createdAt: string;
      }[]
    | null;
}

// Full class names so Tailwind can see them. Each segment also has a text label in the legend.
const SEGMENT: Record<string, string> = {
  draft: "bg-fbr-border",
  awaiting_approval: "bg-fbr-gold",
  ready_to_submit: "bg-fbr-green-lighter",
  submitted: "bg-fbr-green-light",
  accepted: "bg-fbr-green",
  rejected: "bg-fbr-error",
  action_required: "bg-fbr-warning",
  cancelled: "bg-zinc-300",
};
const ORDER = Object.keys(SEGMENT);

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

function Kpi({
  label,
  value,
  hint,
  to,
  warn,
}: {
  label: string;
  value: string | number;
  hint: string;
  to: string;
  warn?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group block rounded-2xl border border-fbr-border border-l-4 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${warn ? "border-l-fbr-warning" : "border-l-fbr-gold"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-fbr-text-light">
          {label}
        </div>
        <span className="text-fbr-green-lighter transition group-hover:translate-x-0.5">
          ↗
        </span>
      </div>
      <div className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">
        {value}
      </div>
      <div className="mt-2 text-xs leading-relaxed text-fbr-text-light">
        {hint}
      </div>
    </Link>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-fbr-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-fbr-border/80 px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api
      .get("/dashboard")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const firstName = user?.name.split(" ")[0] || "there";
  const canCreate = can(user?.role, "business.create");

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse-soft">
        <div className="h-9 w-72 rounded bg-fbr-bg-dark" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-fbr-bg-dark" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-fbr-bg-dark" />
      </div>
    );
  }

  const { kpis, invoicesByStatus, attention, recentInvoices, recentActivity } =
    data;
  const totalInvoices = ORDER.reduce(
    (t, k) => t + (invoicesByStatus[k] ?? 0),
    0,
  );
  const isNew = kpis.activeClients === 0 && totalInvoices === 0;
  const nothingToDo =
    attention.missingAuthorization.length === 0 &&
    attention.awaitingApproval.length === 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fbr-green via-fbr-green to-fbr-green-light px-6 py-7 text-white shadow-lg sm:px-9 sm:py-9">
      <div className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-1 -top-11 h-52 w-52 rounded-full border border-fbr-gold/25" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-fbr-gold" />
            FBR compliance workspace
          </div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Your firm overview, client filings, and the next actions that
            need attention — all in one place.
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-fbr-gold">
            {user?.firmName}
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2 text-sm">
          <Link
            to="/businesses"
            className="rounded-xl border border-white/25 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/15"
          >
            Browse clients
          </Link>
          {canCreate && (
            <Link
              to="/businesses/new"
              state={{ backgroundLocation: location }}
              className="rounded-xl bg-fbr-gold px-4 py-3 font-semibold text-fbr-green transition hover:-translate-y-0.5 hover:bg-white"
            >
              + Add client
            </Link>
          )}
        </div>
      </div>
      </section>

      {isNew && (
      <section className="rounded-2xl border border-fbr-gold/50 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fbr-gold/15 text-lg text-fbr-gold-dark">
            ✦
          </span>
          <div>
            <h2 className="font-serif text-xl">Get started</h2>
            <p className="mt-1 text-sm text-fbr-text-light">
              A few steps to get your office ready to file.
            </p>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 pl-5 text-sm leading-relaxed sm:grid-cols-2">
            <li>
              Add your first client business
              {canCreate && (
                <>
                  {" "}
                  —{" "}
                  <Link
                    to="/businesses/new"
                    state={{ backgroundLocation: location }}
                    className="text-fbr-green-light hover:text-fbr-gold-dark"
                  >
                    add client
                  </Link>
                </>
              )}
              .
            </li>
            <li>Record the client's authorization to file on their behalf.</li>
            <li>Add products and customers, or import sales from a CSV.</li>
            <li>Create an invoice, validate it, and send it for approval.</li>
          </ol>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Active clients"
          value={kpis.activeClients}
          hint="Businesses you can file for"
          to="/businesses"
        />
        <Kpi
          label="Missing authorization"
          value={kpis.clientsMissingAuthorization}
          warn={kpis.clientsMissingAuthorization > 0}
          hint={
            kpis.clientsMissingAuthorization > 0
              ? "⚠ Submissions are blocked for these"
              : "✔ All active clients covered"
          }
          to="/businesses"
        />
        <Kpi
          label="Unbilled sales"
          value={formatMoney(kpis.unbilledGross)}
          hint={`${kpis.unbilledCount} sale(s) waiting to be invoiced`}
          to="/businesses"
        />
        <Kpi
          label="In the pipeline"
          value={kpis.awaitingApproval + kpis.readyToSubmit}
          hint={`${kpis.awaitingApproval} awaiting approval · ${kpis.readyToSubmit} ready to submit`}
          to="/businesses"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Invoice pipeline">
            {totalInvoices === 0 ? (
              <p className="text-sm text-fbr-text-light">
                No invoices yet. They will appear here as you create them.
              </p>
            ) : (
              <>
                <div
                  className="flex h-3 overflow-hidden rounded-full bg-fbr-bg-dark"
                  role="img"
                  aria-label="Invoices by status"
                >
                  {ORDER.filter((k) => invoicesByStatus[k]).map((k) => (
                    <div
                      key={k}
                      className={SEGMENT[k]}
                      style={{
                        width: `${(invoicesByStatus[k] / totalInvoices) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {ORDER.filter((k) => invoicesByStatus[k]).map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${SEGMENT[k]}`}
                      />
                      <span>{STATUS_LABEL[k]}</span>
                      <span className="ml-auto text-fbr-text-light">
                        {invoicesByStatus[k]} (
                        {Math.round(
                          (invoicesByStatus[k] / totalInvoices) * 100,
                        )}
                        %)
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Recent invoices">
            <div className="-m-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-fbr-text-light">
                  <tr>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((i) => (
                    <tr
                        key={i._id}
                        className="border-t border-fbr-border/80 transition hover:bg-fbr-bg"
                    >
                      <td className="p-3">
                        <Link
                          to={`/businesses/${i.businessId}/invoices/${i._id}`}
                          className="font-medium text-fbr-green-light hover:text-fbr-gold-dark"
                        >
                          {i.invoiceNumber ?? "Draft"}
                        </Link>
                      </td>
                      <td className="p-3">{i.businessName}</td>
                      <td className="p-3">{i.buyerName}</td>
                      <td className="p-3 text-right">{formatMoney(i.gross)}</td>
                      <td className="p-3">
                        {i.status ? STATUS_LABEL[i.status] : ""}
                      </td>
                    </tr>
                  ))}
                  {recentInvoices.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-6 text-center text-fbr-text-light"
                      >
                        Nothing here yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Needs attention">
            {nothingToDo ? (
              <p className="text-sm text-fbr-text-light">
                ✔ Nothing needs your attention right now.
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                {attention.awaitingApproval.length > 0 && (
                  <div>
                    <div className="mb-1 font-medium">
                      Waiting for your approval
                    </div>
                    <ul className="space-y-1">
                      {attention.awaitingApproval.map((i) => (
                        <li key={i._id}>
                          <Link
                            to={`/businesses/${i.businessId}/invoices/${i._id}`}
                            className="text-fbr-green-light hover:text-fbr-gold-dark"
                          >
                            {i.invoiceNumber}
                          </Link>
                          <span className="text-fbr-text-light">
                            {" "}
                            · {i.buyerName} · {formatMoney(i.gross)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {attention.missingAuthorization.length > 0 && (
                  <div>
                    <div className="mb-1 font-medium">
                      ⚠ No active authorization
                    </div>
                    <ul className="space-y-1">
                      {attention.missingAuthorization.map((b) => (
                        <li key={b._id}>
                          <Link
                            to={`/businesses/${b._id}`}
                            className="text-fbr-green-light hover:text-fbr-gold-dark"
                          >
                            {b.legalName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {recentActivity && (
            <Panel title="Recent activity">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-fbr-text-light">No activity yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {recentActivity.map((e) => (
                    <li key={e._id}>
                      <div>{e.summary}</div>
                      <div className="text-xs text-fbr-text-light">
                        {e.actorName} · {timeAgo(e.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
