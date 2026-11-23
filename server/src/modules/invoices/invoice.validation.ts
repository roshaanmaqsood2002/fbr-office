import { calcLine } from '../../utils/money';
import { PROVINCES, canonicalProvince } from '../fbr/fbr.reference';

export interface Issue { field: string; message: string }

interface InvoiceLike {
  buyer: { name?: string | null; registrationType?: string | null; ntn?: string | null; address?: string | null; province?: string | null };
  lines: { description: string; hsCode?: string | null; uom?: string | null; quantity: number; unitPrice: number; taxRatePercent: number; net: number; tax: number; gross: number }[];
  totals: { net: number; tax: number; gross: number };
  issueDate: Date;
}

interface Ctx {
  business: { status: string; ntn?: string | null; strn?: string | null; address?: { line1?: string | null; province?: string | null } | null };
  hasActiveAuthorization: boolean;
}

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const VALID_REG_LENGTHS = [7, 9, 13]; // NTN is 7 or 9 digits, CNIC is 13

export function validateInvoice(inv: InvoiceLike, ctx: Ctx) {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  if (ctx.business.status !== 'active') errors.push({ field: 'business', message: 'This client is not active' });
  if (!ctx.hasActiveAuthorization) errors.push({ field: 'authorization', message: 'No active authorization on file for this client' });
  if (!ctx.business.strn) warnings.push({ field: 'business', message: 'The client has no STRN recorded' });

  // Seller (the client business)
  if (!ctx.business.ntn) errors.push({ field: 'business.ntn', message: 'The client has no NTN' });
  else if (!VALID_REG_LENGTHS.includes(digits(ctx.business.ntn).length)) errors.push({ field: 'business.ntn', message: 'The client NTN/CNIC must have 7, 9 or 13 digits' });
  if (!ctx.business.address?.line1) errors.push({ field: 'business.address', message: 'The client address is required by FBR' });
  if (!PROVINCES.includes(canonicalProvince(ctx.business.address?.province))) errors.push({ field: 'business.province', message: 'Select the client province' });

  // Buyer
  if (!inv.buyer?.name) errors.push({ field: 'buyer.name', message: 'Buyer name is required' });
  if (inv.buyer?.registrationType === 'registered' && !inv.buyer.ntn) errors.push({ field: 'buyer.ntn', message: 'A registered buyer needs an NTN' });
  if (inv.buyer?.ntn && !VALID_REG_LENGTHS.includes(digits(inv.buyer.ntn).length)) errors.push({ field: 'buyer.ntn', message: 'The buyer NTN/CNIC must have 7, 9 or 13 digits' });
  if (!inv.buyer?.address) errors.push({ field: 'buyer.address', message: 'Buyer address is required by FBR' });
  if (!PROVINCES.includes(canonicalProvince(inv.buyer?.province))) errors.push({ field: 'buyer.province', message: 'Select the buyer province' });
  if (digits(inv.buyer?.ntn) && digits(inv.buyer?.ntn) === digits(ctx.business.ntn)) errors.push({ field: 'buyer.ntn', message: 'Buyer and seller cannot be the same (FBR rejects self-invoicing)' });

  // Lines
  if (inv.lines.length === 0) errors.push({ field: 'lines', message: 'Add at least one line' });
  inv.lines.forEach((l, i) => {
    const n = i + 1;
    if (!l.hsCode) errors.push({ field: `lines.${i}.hsCode`, message: `Line ${n}: HS code is required` });
    if (!l.uom) errors.push({ field: `lines.${i}.uom`, message: `Line ${n}: unit of measure is required` });
    if (!(l.quantity > 0)) errors.push({ field: `lines.${i}.quantity`, message: `Line ${n}: quantity must be above 0` });
    if (l.taxRatePercent === 0) warnings.push({ field: `lines.${i}.tax`, message: `Line ${n}: tax rate is 0%` });
    const c = calcLine(l.quantity, l.unitPrice, l.taxRatePercent);
    if (c.net !== l.net || c.tax !== l.tax || c.gross !== l.gross)
      errors.push({ field: `lines.${i}.total`, message: `Line ${n}: amounts do not match quantity, price and tax` });
  });

  const sum = inv.lines.reduce((t, l) => ({ net: t.net + l.net, tax: t.tax + l.tax, gross: t.gross + l.gross }), { net: 0, tax: 0, gross: 0 });
  if (sum.net !== inv.totals.net || sum.tax !== inv.totals.tax || sum.gross !== inv.totals.gross)
    errors.push({ field: 'totals', message: 'Invoice totals do not match the lines' });

  const now = new Date();
  if (inv.issueDate.getTime() > now.getTime() + 86_400_000) errors.push({ field: 'issueDate', message: 'Issue date cannot be in the future' });
  else if (now.getTime() - inv.issueDate.getTime() > 30 * 86_400_000) warnings.push({ field: 'issueDate', message: 'Issue date is more than 30 days ago' });

  return { errors, warnings };
}