import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';

interface Row { _id: string; legalName: string; tradeName?: string; businessType: string; ntn: string; status: string }

export default function Businesses() {
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; total: number; limit: number }>({ items: [], total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/businesses', { params: { search: search || undefined, status: status || undefined, page } });
        setData(data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, status, page]);

  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-fbr-green-lighter">
            Your portfolio
          </div>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">Clients</h1>
          <p className="mt-2 text-sm text-fbr-text-light">Businesses your firm files invoices for.</p>
        </div>
        {can(user?.role, 'business.create') && (
          <Link
            to="/businesses/new"
            state={{ backgroundLocation: location }}
            className="fbr-btn sm:w-auto"
          >
            <span className="mr-2 text-lg leading-none">+</span> Add client
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-fbr-border bg-white p-3 shadow-sm sm:p-4">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search client by name or NTN</span>
          <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fbr-text-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input className="fbr-input pl-10" placeholder="Search by name or NTN" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </label>
        <label>
          <span className="sr-only">Filter clients by status</span>
          <select className="fbr-input w-full sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Active and suspended</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
          </select>
        </label>
        <div className="w-full px-1 text-xs text-fbr-text-light sm:ml-auto sm:w-auto">
          {data.total} {data.total === 1 ? 'client' : 'clients'}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-fbr-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-fbr-border px-5 py-4">
          <div>
            <h2 className="font-semibold">Client directory</h2>
            <p className="mt-0.5 text-xs text-fbr-text-light">Select a client to open their workspace.</p>
          </div>
          {loading && <span className="text-xs font-medium text-fbr-green-lighter">Updating…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fbr-bg text-xs uppercase tracking-wide text-fbr-text-light">
              <tr>
                <th className="px-5 py-3.5">Legal name</th>
                <th className="px-5 py-3.5">NTN</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b._id} className="border-t border-fbr-border/80 transition hover:bg-fbr-bg/70">
                  <td className="px-5 py-4">
                    <Link to={`/businesses/${b._id}`} className="font-semibold text-fbr-green hover:text-fbr-green-light">{b.legalName}</Link>
                    {b.tradeName && <div className="mt-0.5 text-xs text-fbr-text-light">{b.tradeName}</div>}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-fbr-text-light">{b.ntn}</td>
                  <td className="px-5 py-4 capitalize">{b.businessType}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${b.status === 'active' ? 'bg-fbr-success/10 text-fbr-success' : 'bg-fbr-bg-dark text-fbr-text-light'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'active' ? 'bg-fbr-success' : 'bg-fbr-text-light/60'}`} />
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-fbr-bg text-fbr-green">
                      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-4-4" />
                      </svg>
                    </div>
                    <div className="mt-3 font-medium">No clients found</div>
                    <p className="mt-1 text-sm text-fbr-text-light">Try a different search or update the status filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-fbr-text-light">
        <span>Page {page} of {pages}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-fbr-border bg-white px-3 py-2 font-medium hover:border-fbr-green-lighter disabled:opacity-40">Previous</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-fbr-border bg-white px-3 py-2 font-medium hover:border-fbr-green-lighter disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}