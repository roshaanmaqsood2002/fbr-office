import Papa from 'papaparse';
import { Types } from 'mongoose';
import { BusinessDoc } from '../../models/Business';
import { Transaction } from '../../models/Transaction';
import { AppError } from '../../utils/AppError';
import { audit, Actor } from '../../utils/audit';
import { escapeRegex } from '../../utils/query';
import { LineInput } from './transaction.schema';
import { calcLine, parseDecimal, parseMoneyToMinor } from '../../utils/money';

export function buildLines<T extends LineInput>(input: T[]) {
  const lines = input.map((l) => ({ ...l, ...calcLine(l.quantity, l.unitPrice, l.taxRatePercent) }));
  const totals = lines.reduce(
    (t, l) => ({ net: t.net + l.net, tax: t.tax + l.tax, gross: t.gross + l.gross }),
    { net: 0, tax: 0, gross: 0 },
  );
  return { lines, totals };
}

export async function listTransactions(
  b: BusinessDoc,
  q: { search?: string; status?: string; page: number; limit: number },
) {
  const filter: Record<string, unknown> = { firmId: b.firmId, businessId: b._id };
  if (['unbilled', 'invoiced', 'void'].includes(q.status ?? '')) filter.status = q.status;
  if (q.search) {
    const re = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ externalReference: re }, { customerName: re }, { customerNtn: re }];
  }
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ transactionDate: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Transaction.countDocuments(filter),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export async function createTransaction(
  a: Actor,
  b: BusinessDoc,
  input: { reference: string; transactionDate: Date; customerName: string; customerNtn?: string; lines: LineInput[] },
) {
  const { lines, totals } = buildLines(input.lines);
  try {
    const t = await Transaction.create({
      firmId: b.firmId, businessId: b._id, source: 'manual', externalReference: input.reference,
      transactionDate: input.transactionDate, customerName: input.customerName, customerNtn: input.customerNtn,
      lines, totals, createdBy: a.userId,
    });
    await audit(a, {
      action: 'transaction.created', entityType: 'transaction', entityId: t._id, businessId: b._id,
      summary: `Added sale ${t.externalReference}`,
    });
    return t;
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) throw new AppError(409, 'A sale with this reference already exists');
    throw err;
  }
}

export async function voidTransaction(a: Actor, b: BusinessDoc, id: string, reason: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Sale not found');
  const t = await Transaction.findOneAndUpdate(
    { _id: id, firmId: b.firmId, businessId: b._id, status: 'unbilled' },
    { status: 'void', voidReason: reason },
    { returnDocument: 'after' },
  );
  if (!t) throw new AppError(404, 'Only unbilled sales can be voided');
  await audit(a, {
    action: 'transaction.voided', entityType: 'transaction', entityId: t._id, businessId: b._id,
    summary: `Voided sale ${t.externalReference}`, meta: { reason },
  });
  return t;
}

/* ---------- CSV import ---------- */
const REQUIRED = ['reference', 'date', 'customer_name', 'description', 'quantity', 'unit_price', 'tax_rate'];
const MAX_ROWS = 5000;

interface Group {
  dateStr: string;
  customerName: string;
  customerNtn?: string;
  lines: LineInput[];
}

export async function importCsv(a: Actor, b: BusinessDoc, csvText: string, commit: boolean) {
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const missing = REQUIRED.filter((h) => !(parsed.meta.fields ?? []).includes(h));
  if (missing.length) throw new AppError(400, `Missing columns: ${missing.join(', ')}`);
  if (parsed.data.length === 0) throw new AppError(400, 'The file has no data rows');
  if (parsed.data.length > MAX_ROWS) throw new AppError(400, `Too many rows (max ${MAX_ROWS})`);

  const errors: { row: number; message: string }[] = [];
  parsed.errors.forEach((e) => errors.push({ row: (e.row ?? 0) + 2, message: e.message }));

  const groups = new Map<string, Group>();
  parsed.data.forEach((r, idx) => {
    const row = idx + 2; // header is row 1
    try {
      const ref = (r.reference ?? '').trim();
      if (!ref || ref.length > 60) throw new Error('reference is required (max 60 characters)');

      const dateStr = (r.date ?? '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(Date.parse(dateStr))) throw new Error('date must be YYYY-MM-DD');

      const customerName = (r.customer_name ?? '').trim();
      if (customerName.length < 2) throw new Error('customer_name is required');

      const customerNtn = (r.customer_ntn ?? '').trim() || undefined;
      if (customerNtn && !/^[0-9-]{7,15}$/.test(customerNtn)) throw new Error('customer_ntn is not a valid NTN / CNIC');

      const description = (r.description ?? '').trim();
      if (!description) throw new Error('description is required');

      const hsCode = (r.hs_code ?? '').trim() || undefined;
      if (hsCode && !/^[0-9.]{4,12}$/.test(hsCode)) throw new Error('hs_code is not valid');

      const quantity = parseDecimal(r.quantity ?? '', 3);
      if (quantity <= 0) throw new Error('quantity must be greater than 0');
      const unitPrice = parseMoneyToMinor(r.unit_price ?? '');
      const taxRatePercent = parseDecimal(r.tax_rate ?? '', 2);
      if (taxRatePercent > 100) throw new Error('tax_rate must be between 0 and 100');

      const g = groups.get(ref);
      if (g && (g.dateStr !== dateStr || g.customerName !== customerName))
        throw new Error(`rows for reference ${ref} must share the same date and customer`);

      const line: LineInput = { description, hsCode, uom: (r.uom ?? '').trim() || 'Unit', quantity, unitPrice, taxRatePercent };
      if (g) g.lines.push(line);
      else groups.set(ref, { dateStr, customerName, customerNtn, lines: [line] });
    } catch (e) {
      errors.push({ row, message: (e as Error).message });
    }
  });

  // Skip references that were already imported (re-uploading the same file is safe)
  const refs = [...groups.keys()];
  const existing = new Set(
    (await Transaction.find({ businessId: b._id, source: 'csv', externalReference: { $in: refs } })
      .select('externalReference').lean()).map((t) => t.externalReference),
  );

  const batchId = new Types.ObjectId();
  const docs = refs
    .filter((ref) => !existing.has(ref))
    .map((ref) => {
      const g = groups.get(ref)!;
      const { lines, totals } = buildLines(g.lines);
      return {
        firmId: b.firmId, businessId: b._id, source: 'csv' as const, externalReference: ref, importBatchId: batchId,
        transactionDate: new Date(g.dateStr), customerName: g.customerName, customerNtn: g.customerNtn,
        lines, totals, createdBy: a.userId,
      };
    });

  const report = {
    rows: parsed.data.length,
    transactions: groups.size,
    toCreate: docs.length,
    duplicates: [...existing].slice(0, 50),
    duplicateCount: existing.size,
    errors: errors.slice(0, 50),
    errorCount: errors.length,
  };

  // All-or-nothing: with any error nothing is written
  if (!commit || errors.length > 0 || docs.length === 0) return { committed: false, ...report };

  try {
    await Transaction.insertMany(docs, { ordered: false });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000)
      throw new AppError(409, 'Some references were imported at the same time. Please retry.');
    throw err;
  }
  await audit(a, {
    action: 'transactions.imported', entityType: 'import', entityId: batchId, businessId: b._id,
    summary: `Imported ${docs.length} sale(s) from CSV (${existing.size} duplicate(s) skipped)`,
    meta: { batchId: batchId.toString(), created: docs.length, duplicates: existing.size },
  });
  return { committed: true, batchId: batchId.toString(), ...report };
}
