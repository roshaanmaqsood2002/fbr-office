export default function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between text-sm text-fbr-text-light">
      <span>{total} record(s)</span>
      <div className="flex items-center gap-3">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="disabled:opacity-40">Previous</button>
        <span>Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}