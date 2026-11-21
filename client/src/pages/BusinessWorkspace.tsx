import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/permissions";
import BusinessForm, { type BusinessData } from "../components/BusinessForm";
import Modal from "../components/Modal";
import AuthorizationTab from "./tabs/AuthorizationTab";
import AccessTab from "./tabs/AccessTab";
import ActivityTab from "./tabs/ActivityTab";
import TransactionsTab from "./tabs/TransactionTab";
import ProductsTab from "./tabs/ProductsTab";
import CustomersTab from "./tabs/CustomerTab";
import InvoicesTab from "./tabs/InvoicesTab";
import FbrTab from "./tabs/FbrTab";

export default function BusinessWorkspace() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [business, setBusiness] = useState<
    (BusinessData & { assignedUsers: string[] }) | null
  >(null);
  const [hasAuth, setHasAuth] = useState(false);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/businesses/${id}`);
      setBusiness(data.business);
      setHasAuth(!!data.activeAuthorization);
    } catch (err) {
      setMissing(true);
      toast.error(getErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (missing)
    return (
      <div className="rounded-2xl border border-fbr-border bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl">Client not found</h1>
        <p className="mt-2 text-sm text-fbr-text-light">This client may have been removed or you may not have access.</p>
        <Link to="/businesses" className="fbr-btn-secondary mt-5">Back to clients</Link>
      </div>
    );
  if (!business)
    return (
      <div className="space-y-5">
        <div className="h-40 animate-pulse-soft rounded-3xl bg-fbr-bg-dark" />
        <div className="h-14 animate-pulse-soft rounded-2xl bg-fbr-bg-dark" />
        <div className="h-64 animate-pulse-soft rounded-2xl bg-fbr-bg-dark" />
      </div>
    );

  const active = business.status === "active";

  const tabs = [
    { key: "overview", label: "Overview", show: true },
    { key: "sales", label: "Sales", show: can(user?.role, "transaction.read") },
    {
      key: "products",
      label: "Products",
      show: can(user?.role, "masterdata.read"),
    },
    {
      key: "customers",
      label: "Customers",
      show: can(user?.role, "masterdata.read"),
    },
    { key: "authorization", label: "Authorization", show: true },
    {
      key: "access",
      label: "Access",
      show: can(user?.role, "business.assign"),
    },
    { key: "activity", label: "Activity", show: can(user?.role, "audit.read") },
    {
      key: "invoices",
      label: "Invoices",
      show: can(user?.role, "invoice.read"),
    },
    { key: "fbr", label: "FBR", show: can(user?.role, "fbr.read") },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fbr-green to-fbr-green-light px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative">
          <Link to="/businesses" className="inline-flex items-center gap-2 text-xs font-medium text-white/65 hover:text-white">
            <span aria-hidden="true">←</span> All clients
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-fbr-gold">
                Client workspace
              </div>
              <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
                {business.legalName}
              </h1>
              {business.tradeName && (
                <p className="mt-1 text-sm text-white/65">{business.tradeName}</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-xs text-white/85">
                  NTN {business.ntn}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${active ? "bg-emerald-300/15 text-emerald-100" : "bg-white/10 text-white/75"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-300" : "bg-white/50"}`} />
                  {business.status}
                </span>
                <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${hasAuth ? "bg-emerald-300/15 text-emerald-100" : "bg-amber-200/15 text-amber-100"}`}>
                  {hasAuth ? "Authorization active" : "Authorization required"}
                </span>
              </div>
            </div>
            {!editing && can(user?.role, "business.update") && (
              <button
                className="rounded-xl bg-fbr-gold px-4 py-3 text-sm font-semibold text-fbr-green shadow-sm hover:-translate-y-0.5 hover:bg-white"
                onClick={() => setEditing(true)}
              >
                Edit client details
              </button>
            )}
          </div>
          <div className="mt-6 border-t border-white/15 pt-4 text-xs text-white/55">
            Acting for {user?.firmName}
          </div>
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-fbr-border bg-white p-1.5 shadow-sm" role="tablist" aria-label="Client workspace sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium ${tab === t.key ? "bg-fbr-green text-white shadow-sm" : "text-fbr-text-light hover:bg-fbr-bg hover:text-fbr-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="overflow-hidden rounded-2xl border border-fbr-border bg-white shadow-sm">
          <div className="border-b border-fbr-border px-5 py-5 sm:px-7">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fbr-green-lighter">
              Client profile
            </div>
            <h2 className="mt-1 font-serif text-2xl">Business details</h2>
            <p className="mt-1 text-sm text-fbr-text-light">
              Registration, address, and contact information for this client.
            </p>
          </div>

          <div className="divide-y divide-fbr-border">
            <section className="px-5 py-5 sm:px-7" aria-labelledby="registration-heading">
              <h3 id="registration-heading" className="text-sm font-semibold">
                Registration
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Legal name", business.legalName],
                  ["Trade name", business.tradeName || "—"],
                  ["Business type", business.businessType],
                  ["NTN / CNIC", business.ntn],
                  ["STRN", business.strn || "—"],
                  ["Status", business.status],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-fbr-text-light">{label}</dt>
                    <dd className={`mt-1 break-words text-sm font-semibold ${label === "Business type" || label === "Status" ? "capitalize" : ""}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="px-5 py-5 sm:px-7" aria-labelledby="address-heading">
              <h3 id="address-heading" className="text-sm font-semibold">
                Business address
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Street address", business.address?.line1 || "—"],
                  ["City", business.address?.city || "—"],
                  ["Province", business.address?.province || "—"],
                  ["Postal code", business.address?.postalCode || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-fbr-text-light">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="px-5 py-5 sm:px-7" aria-labelledby="contact-heading">
              <h3 id="contact-heading" className="text-sm font-semibold">
                Contacts
              </h3>
              {business.contacts?.length ? (
                <div className="mt-4 space-y-4">
                  {business.contacts.map((contact, index) => (
                    <dl key={`${contact.name}-${index}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        [index === 0 ? "Primary contact" : `Contact ${index + 1}`, contact.name],
                        ["Designation", contact.designation || "—"],
                        ["Email", contact.email || "—"],
                        ["Phone", contact.phone || "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs font-medium text-fbr-text-light">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-fbr-text-light">
                  No contact details have been added.
                </p>
              )}
            </section>
          </div>
        </section>
      )}
      <Modal
        open={editing}
        title="Edit client details"
        description="Update business information, contact details, and client status."
        size="lg"
        onClose={() => setEditing(false)}
      >
        <BusinessForm
          initial={business}
          submitLabel="Save changes"
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
        <button
          type="button"
          className="fbr-btn-secondary mt-3 w-full sm:w-auto"
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </Modal>
      {tab === "authorization" && (
        <AuthorizationTab businessId={id} onChange={load} />
      )}
      {tab === "access" && (
        <AccessTab
          businessId={id}
          assigned={business.assignedUsers}
          onChange={load}
        />
      )}
      {tab === "activity" && <ActivityTab businessId={id} />}
      {tab === "sales" && (
        <TransactionsTab
          businessId={id}
          canWrite={active && can(user?.role, "transaction.write")}
        />
      )}
      {tab === "products" && (
        <ProductsTab
          businessId={id}
          canWrite={active && can(user?.role, "masterdata.write")}
        />
      )}
      {tab === "customers" && (
        <CustomersTab
          businessId={id}
          canWrite={active && can(user?.role, "masterdata.write")}
        />
      )}
      {tab === "invoices" && (
        <InvoicesTab
          businessId={id}
          canWrite={active && can(user?.role, "invoice.write")}
        />
      )}
      {tab === "fbr" && <FbrTab businessId={id} />}
    </div>
  );
}
