import type { Line } from '../lib/invoice';
import { calcLine, formatMoney, fromMinor, toMinor } from '../lib/money';

export interface Row {
  description: string; hsCode: string; uom: string; quantity: string; unitPrice: string; taxRatePercent: string;
  productId?: string; sourceTransactionId?: string;
}
export interface ProductOption { _id: string; name: string; hsCode?: string; uom: string; unitPrice: number; taxRatePercent: number }

export const emptyRow = (): Row => ({ description: '', hsCode: '', uom: 'Unit', quantity: '1', unitPrice: '', taxRatePercent: '18' });

export const linesToRows = (lines: Line[]): Row[] =>
  lines.map((l) => ({
    description: l.description, hsCode: l.hsCode ?? '', uom: l.uom, quantity: String(l.quantity),
    unitPrice: fromMinor(l.unitPrice), taxRatePercent: String(l.taxRatePercent),
    productId: l.productId, sourceTransactionId: l.sourceTransactionId,
  }));

export function rowsToPayload(rows: Row[]): { lines?: Line[]; error?: string } {
  const lines: Line[] = [];
  for (const [i, r] of rows.entries()) {
    const n = i + 1;
    const qty = Number(r.quantity);
    const price = toMinor(r.unitPrice);
    const rate = Number(r.taxRatePercent);
    if (!r.description.trim()) return { error: `Line ${n}: description is required` };
    if (!(qty > 0) || !/^\d+(\.\d{1,3})?$/.test(r.quantity.trim())) return { error: `Line ${n}: quantity must be a positive number (max 3 decimals)` };
    if (price === null) return { error: `Line ${n}: enter a valid price, e.g. 1250.50` };
    if (Number.isNaN(rate) || rate < 0 || rate > 100) return { error: `Line ${n}: tax rate must be 0 to 100` };
    lines.push({
      description: r.description.trim(), uom: r.uom.trim() || 'Unit', quantity: qty, unitPrice: price, taxRatePercent: rate,
      ...(r.hsCode.trim() && { hsCode: r.hsCode.trim() }),
      ...(r.productId && { productId: r.productId }),
      ...(r.sourceTransactionId && { sourceTransactionId: r.sourceTransactionId }),
    });
  }
  return { lines };
}

export default function LinesEditor({ rows, onChange, products }: { rows: Row[]; onChange: (r: Row[]) => void; products: ProductOption[] }) {
  const setRow = (i: number, patch: Partial<Row>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const fromProduct = (i: number, pid: string) => {
    const p = products.find((x) => x._id === pid);
    if (p) setRow(i, { productId: p._id, description: p.name, hsCode: p.hsCode ?? '', uom: p.uom, unitPrice: fromMinor(p.unitPrice), taxRatePercent: String(p.taxRatePercent) });
  };

  const total = rows.reduce((t, r) => {
    const price = toMinor(r.unitPrice);
    const qty = Number(r.quantity);
    return price === null || !(qty > 0) ? t : t + calcLine(qty, price, Number(r.taxRatePercent) || 0).gross;
  }, 0);

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-fbr-border bg-white p-3 sm:grid-cols-6">
          <select className="fbr-input sm:col-span-2" value={r.productId ?? ''} onChange={(e) => fromProduct(i, e.target.value)}>
            <option value="">Fill from product…</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <input className="fbr-input sm:col-span-4" placeholder="Description *" value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} />
          <input className="fbr-input" placeholder="HS code *" value={r.hsCode} onChange={(e) => setRow(i, { hsCode: e.target.value })} />
          <input className="fbr-input" placeholder="UOM" value={r.uom} onChange={(e) => setRow(i, { uom: e.target.value })} />
          <input className="fbr-input" placeholder="Qty" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} />
          <input className="fbr-input" placeholder="Price (Rs)" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: e.target.value })} />
          <input className="fbr-input" placeholder="Tax %" value={r.taxRatePercent} onChange={(e) => setRow(i, { taxRatePercent: e.target.value })} />
          <button type="button" className="text-sm text-fbr-error hover:underline disabled:opacity-40" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>Remove line</button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" className="text-sm text-fbr-green-light hover:text-fbr-gold-dark" onClick={() => onChange([...rows, emptyRow()])}>+ Add line</button>
        <span className="text-sm">Total (incl. tax): <b>{formatMoney(total)}</b></span>
      </div>
    </div>
  );
}