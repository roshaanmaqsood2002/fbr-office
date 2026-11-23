import { Types } from 'mongoose';
import { BusinessDoc } from '../../models/Business';
import { BusinessAuthorization } from '../../models/BusinessAuthorization';
import { Customer } from '../../models/Customer';
import { Firm } from '../../models/Firm';
import { Invoice, InvoiceStatus } from '../../models/Invoice';
import { nextSeq } from '../../models/Counter';
import { Product } from '../../models/Product';
import { Transaction } from '../../models/Transaction';
import { AppError } from '../../utils/AppError';
import { audit, Actor } from '../../utils/audit';
import { escapeRegex } from '../../utils/query';
import { buildLines } from '../transactions/transaction.service';
import { assertTransition } from './invoices.states';
import { validateInvoice } from './invoice.validation';
import { CreateInvoiceInput, UpdateInvoiceInput } from './invoice.schema';

const scope = (b: BusinessDoc) => ({ firmId: b.firmId, businessId: b._id });

async function getInvoice(b: BusinessDoc, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Invoice not found');
  const inv = await Invoice.findOne({ _id: id, ...scope(b) });
  if (!inv) throw new AppError(404, 'Invoice not found');
  return inv;
}

async function resolveBuyer(b: BusinessDoc, buyer: { customerId?: string; [k: string]: unknown }) {
  if (buyer.customerId) {
    const exists = await Customer.exists({ _id: buyer.customerId, ...scope(b) }); // link only, snapshot = what was submitted
    if (!exists) throw new AppError(404, 'Customer not found');
  }
  return buyer;
}

async function verifyProducts(b: BusinessDoc, lines: { productId?: string }[]) {
  const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))] as string[];
  if (ids.length && (await Product.countDocuments({ _id: { $in: ids }, ...scope(b) })) !== ids.length)
    throw new AppError(404, 'One or more products were not found');
}

const releaseSales = (b: BusinessDoc, invoiceId: Types.ObjectId) =>
  Transaction.updateMany({ ...scope(b), invoiceId }, { status: 'unbilled', $unset: { invoiceId: 1 } });

export async function runValidation(b: BusinessDoc, inv: object) {
  const hasActiveAuthorization = !!(await BusinessAuthorization.exists({ businessId: b._id, status: 'active' }));
  return validateInvoice(inv as Parameters<typeof validateInvoice>[0], { business: b, hasActiveAuthorization });
}

// Single atomic status change: only succeeds if the invoice is still in one of the `from` states
async function move(b: BusinessDoc, id: string, from: InvoiceStatus[], to: InvoiceStatus, set: Record<string, unknown> = {}) {
  from.forEach((f) => assertTransition(f, to));
  const inv = await Invoice.findOneAndUpdate(
    { _id: id, ...scope(b), status: { $in: from } },
    { $set: { status: to, ...set } },
    { returnDocument: 'after' },
  );
  if (!inv) throw new AppError(409, `This invoice cannot be moved to ${to} from its current status`);
  return inv;
}

/* ---------- Read ---------- */
export async function listInvoices(b: BusinessDoc, q: { search?: string; status?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = { ...scope(b) };
  if (q.status) filter.status = q.status;
  if (q.search) {
    const re = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ invoiceNumber: re }, { 'buyer.name': re }];
  }
  const [items, total] = await Promise.all([
    Invoice.find(filter).select('-lines').sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Invoice.countDocuments(filter),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export const getInvoiceDetail = async (b: BusinessDoc, id: string) => (await getInvoice(b, id)).toObject();

export async function validateOne(b: BusinessDoc, id: string) {
  return runValidation(b, (await getInvoice(b, id)).toObject());
}

/* ---------- Create ---------- */
export async function createInvoice(a: Actor, b: BusinessDoc, input: CreateInvoiceInput) {
  const invoiceId = new Types.ObjectId();
  const issueDate = input.issueDate ?? new Date();

  if (input.mode === 'manual') {
    await verifyProducts(b, input.lines);
    const { lines, totals } = buildLines(input.lines);
    const inv = await Invoice.create({
      _id: invoiceId, ...scope(b), issueDate, dueDate: input.dueDate, notes: input.notes,
      buyer: await resolveBuyer(b, input.buyer), lines, totals, createdBy: a.userId,
    });
    await audit(a, { action: 'invoice.created', entityType: 'invoice', entityId: inv._id, businessId: b._id, summary: `Created draft invoice for ${inv.buyer.name}` });
    return inv;
  }

  // from_sales
  const ids = [...new Set(input.transactionIds)];
  const txs = await Transaction.find({ _id: { $in: ids }, ...scope(b) }).sort({ transactionDate: 1 });
  if (txs.length !== ids.length) throw new AppError(404, 'One or more sales were not found');
  if (txs.some((t) => t.status !== 'unbilled')) throw new AppError(409, 'Only unbilled sales can be invoiced');
  const key = (t: (typeof txs)[number]) => `${t.customerName}|${t.customerNtn ?? ''}`;
  if (new Set(txs.map(key)).size > 1) throw new AppError(400, 'All selected sales must belong to the same customer');

  // Claim the sales atomically so two people can't invoice the same sale
  const claim = await Transaction.updateMany({ _id: { $in: ids }, ...scope(b), status: 'unbilled' }, { status: 'invoiced', invoiceId });
  if (claim.modifiedCount !== ids.length) {
    await releaseSales(b, invoiceId);
    throw new AppError(409, 'Some of these sales were just invoiced by someone else. Refresh and try again.');
  }

  try {
    const first = txs[0];
    const customer = first.customerNtn ? await Customer.findOne({ ...scope(b), ntn: first.customerNtn }).lean() : null;
    const rawLines = txs.flatMap((t) =>
      t.lines.map((l) => ({
        sourceTransactionId: t._id.toString(), description: l.description, hsCode: l.hsCode ?? undefined,
        uom: l.uom, quantity: l.quantity, unitPrice: l.unitPrice, taxRatePercent: l.taxRatePercent,
      })),
    );
    const { lines, totals } = buildLines(rawLines);
    const inv = await Invoice.create({
      _id: invoiceId, ...scope(b), issueDate, notes: input.notes,
      buyer: {
        customerId: customer?._id, name: first.customerName,
        registrationType: customer?.registrationType ?? (first.customerNtn ? 'registered' : 'unregistered'),
        ntn: first.customerNtn, address: customer?.address, province: customer?.province,
      },
      lines, totals, sourceTransactionIds: ids, createdBy: a.userId,
    });
    await audit(a, {
      action: 'invoice.created', entityType: 'invoice', entityId: inv._id, businessId: b._id,
      summary: `Created draft invoice for ${inv.buyer.name} from ${ids.length} sale(s)`,
    });
    return inv;
  } catch (err) {
    await releaseSales(b, invoiceId);
    throw err;
  }
}

/* ---------- Edit / delete (drafts only) ---------- */
export async function updateDraft(a: Actor, b: BusinessDoc, id: string, patch: UpdateInvoiceInput) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Invoice not found');
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  
if (patch.saleType) $set.saleType = patch.saleType;
  if (patch.buyer) $set.buyer = await resolveBuyer(b, patch.buyer);
  if (patch.lines) {
    await verifyProducts(b, patch.lines);
    const { lines, totals } = buildLines(patch.lines);
    $set.lines = lines;
    $set.totals = totals;
  }
  if (patch.issueDate) $set.issueDate = patch.issueDate;
  if (patch.notes !== undefined) $set.notes = patch.notes;
  if (patch.dueDate === null) $unset.dueDate = 1;
  else if (patch.dueDate) $set.dueDate = patch.dueDate;

  const inv = await Invoice.findOneAndUpdate(
    { _id: id, ...scope(b), status: 'draft' }, // the filter is the lock: only drafts are editable
    { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) },
    { returnDocument: 'after' },
  );
  if (!inv) throw new AppError(409, 'Only draft invoices can be edited');
  await audit(a, {
    action: 'invoice.updated', entityType: 'invoice', entityId: inv._id, businessId: b._id,
    summary: `Edited draft ${inv.invoiceNumber ?? 'invoice'} for ${inv.buyer.name}`, meta: { fields: Object.keys(patch) },
  });
  return inv;
}

export async function deleteDraft(a: Actor, b: BusinessDoc, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Invoice not found');
  const res = await Invoice.findOneAndDelete({ _id: id, ...scope(b), status: 'draft', invoiceNumber: null });
  if (!res) throw new AppError(409, 'Only never-numbered drafts can be deleted. Cancel the invoice instead.');
  await releaseSales(b, res._id);
  await audit(a, { action: 'invoice.deleted', entityType: 'invoice', entityId: res._id, businessId: b._id, summary: `Deleted draft invoice for ${res.buyer.name}` });
}

/* ---------- Workflow ---------- */
const fail = (errors: unknown[], warnings: unknown[]) =>
  new AppError(422, 'This invoice has errors that must be fixed first', 'VALIDATION_FAILED', { errors, warnings });

export async function finalize(a: Actor, b: BusinessDoc, id: string) {
  const inv = await getInvoice(b, id);
  if (inv.status !== 'draft') throw new AppError(409, 'Only drafts can be finalized');

  const { errors, warnings } = await runValidation(b, inv.toObject());
  if (errors.length) throw fail(errors, warnings);

  const firm = await Firm.findById(a.firmId).select('settings').lean();
  const needsApproval = firm?.settings?.requireInvoiceApproval ?? true;

  // Number is assigned once; a rare double-click race may burn one number, never duplicate one
  const invoiceNumber = inv.invoiceNumber ?? `INV-${String(await nextSeq(`${b._id}:invoice`)).padStart(6, '0')}`;
  const to: InvoiceStatus = needsApproval ? 'awaiting_approval' : 'ready_to_submit';
  const updated = await move(b, id, ['draft'], to, { invoiceNumber, finalizedAt: new Date(), finalizedBy: a.userId, returnReason: null });

  await audit(a, {
    action: needsApproval ? 'invoice.sent_for_approval' : 'invoice.ready_to_submit', entityType: 'invoice', entityId: updated._id, businessId: b._id,
    summary: `${invoiceNumber} ${needsApproval ? 'sent for approval' : 'finalized and ready to submit'}`,
  });
  return { invoice: updated, warnings };
}

export async function approve(a: Actor, b: BusinessDoc, id: string) {
  const inv = await getInvoice(b, id);
  if (inv.status !== 'awaiting_approval') throw new AppError(409, 'This invoice is not awaiting approval');
  const { errors, warnings } = await runValidation(b, inv.toObject());
  if (errors.length) throw fail(errors, warnings);

  const updated = await move(b, id, ['awaiting_approval'], 'ready_to_submit', { approvedAt: new Date(), approvedBy: a.userId });
  await audit(a, { action: 'invoice.approved', entityType: 'invoice', entityId: updated._id, businessId: b._id, summary: `Approved ${updated.invoiceNumber}` });
  return updated;
}

export async function returnForChanges(a: Actor, b: BusinessDoc, id: string, reason: string) {
  const updated = await move(b, id, ['awaiting_approval'], 'draft', { returnReason: reason });
  await audit(a, { action: 'invoice.returned', entityType: 'invoice', entityId: updated._id, businessId: b._id, summary: `Returned ${updated.invoiceNumber} for changes`, meta: { reason } });
  return updated;
}

export async function withdraw(a: Actor, b: BusinessDoc, id: string) {
  const updated = await move(b, id, ['ready_to_submit'], 'draft', { approvedAt: null, approvedBy: null });
  await audit(a, { action: 'invoice.withdrawn', entityType: 'invoice', entityId: updated._id, businessId: b._id, summary: `Withdrew ${updated.invoiceNumber} back to draft` });
  return updated;
}

export async function cancel(a: Actor, b: BusinessDoc, id: string, reason: string) {
  const updated = await move(b, id, ['draft', 'awaiting_approval', 'ready_to_submit'], 'cancelled', {
    cancelledAt: new Date(), cancelledBy: a.userId, cancelReason: reason,
  });
  await releaseSales(b, updated._id); // sales go back to unbilled; the invoice number stays used
  await audit(a, { action: 'invoice.cancelled', entityType: 'invoice', entityId: updated._id, businessId: b._id, summary: `Cancelled ${updated.invoiceNumber ?? 'draft invoice'}`, meta: { reason } });
  return updated;
}