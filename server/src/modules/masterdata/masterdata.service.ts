import { Types } from 'mongoose';
import { BusinessDoc } from '../../models/Business';
import { Product } from '../../models/Product';
import { Customer } from '../../models/Customer';
import { AppError } from '../../utils/AppError';
import { audit, Actor } from '../../utils/audit';
import { escapeRegex } from '../../utils/query';

interface ListQuery { search?: string; includeInactive: boolean; page: number; limit: number }

const dup = (what: string) => (err: unknown) => {
  if ((err as { code?: number })?.code === 11000) throw new AppError(409, `${what} already exists for this client`);
  throw err;
};

function baseFilter(b: BusinessDoc, q: ListQuery, fields: string[]) {
  const filter: Record<string, unknown> = { firmId: b.firmId, businessId: b._id };
  if (!q.includeInactive) filter.isActive = true;
  if (q.search) {
    const re = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = fields.map((f) => ({ [f]: re }));
  }
  return filter;
}

/* ---------- Products ---------- */
export async function listProducts(b: BusinessDoc, q: ListQuery) {
  const filter = baseFilter(b, q, ['name', 'sku', 'hsCode']);
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export async function createProduct(a: Actor, b: BusinessDoc, input: Record<string, unknown>) {
  try {
    const p = await Product.create({ ...input, firmId: b.firmId, businessId: b._id });
    await audit(a, { action: 'product.created', entityType: 'product', entityId: p._id, businessId: b._id, summary: `Added product ${p.name}` });
    return p;
  } catch (err) {
    return dup('A product with this SKU')(err);
  }
}

export async function updateProduct(a: Actor, b: BusinessDoc, id: string, patch: Record<string, unknown>) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Product not found');
  const p = await Product.findOne({ _id: id, firmId: b.firmId, businessId: b._id });
  if (!p) throw new AppError(404, 'Product not found');
  p.set(patch);
  try {
    await p.save();
  } catch (err) {
    return dup('A product with this SKU')(err);
  }
  await audit(a, {
    action: 'product.updated', entityType: 'product', entityId: p._id, businessId: b._id,
    summary: `Updated product ${p.name}`, meta: { fields: Object.keys(patch) },
  });
  return p;
}

/* ---------- Customers ---------- */
export async function listCustomers(b: BusinessDoc, q: ListQuery) {
  const filter = baseFilter(b, q, ['name', 'ntn']);
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Customer.countDocuments(filter),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export async function createCustomer(a: Actor, b: BusinessDoc, input: Record<string, unknown>) {
  try {
    const c = await Customer.create({ ...input, firmId: b.firmId, businessId: b._id });
    await audit(a, { action: 'customer.created', entityType: 'customer', entityId: c._id, businessId: b._id, summary: `Added customer ${c.name}` });
    return c;
  } catch (err) {
    return dup('A customer with this NTN')(err);
  }
}

export async function updateCustomer(a: Actor, b: BusinessDoc, id: string, patch: Record<string, unknown>) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Customer not found');
  const c = await Customer.findOne({ _id: id, firmId: b.firmId, businessId: b._id });
  if (!c) throw new AppError(404, 'Customer not found');
  c.set(patch);
  if (c.registrationType === 'registered' && !c.ntn) throw new AppError(400, 'Registered buyers need an NTN');
  try {
    await c.save();
  } catch (err) {
    return dup('A customer with this NTN')(err);
  }
  await audit(a, {
    action: 'customer.updated', entityType: 'customer', entityId: c._id, businessId: b._id,
    summary: `Updated customer ${c.name}`, meta: { fields: Object.keys(patch) },
  });
  return c;
}