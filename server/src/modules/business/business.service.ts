import { Types } from 'mongoose';
import { Business, BusinessDoc, BUSINESS_STATUSES } from '../../models/Business';
import { BusinessAuthorization } from '../../models/BusinessAuthorization';
import { AuditEvent } from '../../models/AuditEvent';
import { User } from '../../models/User';
import { AppError } from '../../utils/AppError';
import { audit } from '../../utils/audit';
import { scopeFilter } from '../../middlewares/business';

type Actor = NonNullable<Express.Request['auth']>;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dupNtn = (err: unknown) => {
  if ((err as { code?: number })?.code === 11000)
    throw new AppError(409, 'A client with this NTN already exists in your firm');
  throw err;
};

export async function listBusinesses(
  a: Actor,
  q: { search?: string; status?: string; page: number; limit: number },
) {
  const filter: Record<string, unknown> = { ...scopeFilter(a) };
  filter.status = (BUSINESS_STATUSES as readonly string[]).includes(q.status ?? '')
    ? q.status
    : { $ne: 'archived' };
  if (q.search) {
    const re = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ legalName: re }, { tradeName: re }, { ntn: re }];
  }
  const [items, total] = await Promise.all([
    Business.find(filter)
      .select('legalName tradeName businessType ntn strn status')
      .sort({ legalName: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Business.countDocuments(filter),
  ]);
  return { items, total, page: q.page, limit: q.limit };
}

export async function createBusiness(a: Actor, input: Record<string, unknown>) {
  try {
    const b = await Business.create({
      ...input,
      firmId: a.firmId, // always from the token, never from the body
      assignedUsers: [a.userId],
      createdBy: a.userId,
    });
    await audit(a, {
      action: 'business.created', entityType: 'business', entityId: b._id, businessId: b._id,
      summary: `Created client ${b.legalName} (NTN ${b.ntn})`,
    });
    return b;
  } catch (err) {
    return dupNtn(err);
  }
}

export async function getBusinessDetail(business: BusinessDoc) {
  const activeAuthorization = await BusinessAuthorization.findOne({
    businessId: business._id,
    status: 'active',
  }).lean();
  return { business: business.toObject(), activeAuthorization };
}

export async function updateBusiness(a: Actor, business: BusinessDoc, patch: Record<string, unknown>) {
  const fields: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) {
      business.set(k, v);
      fields.push(k);
    }
  }
  if (!fields.length) throw new AppError(400, 'Nothing to update');
  try {
    await business.save();
  } catch (err) {
    return dupNtn(err);
  }
  await audit(a, {
    action: 'business.updated', entityType: 'business', entityId: business._id, businessId: business._id,
    summary: `Updated ${fields.join(', ')} on ${business.legalName}`, meta: { fields },
  });
  return business;
}

export async function assignUsers(a: Actor, business: BusinessDoc, userIds: string[]) {
  const unique = [...new Set(userIds)];
  const users = await User.find({ _id: { $in: unique }, firmId: a.firmId, isActive: true }).select('_id').lean();
  if (users.length !== unique.length) throw new AppError(400, 'One or more users are invalid');
  business.set('assignedUsers', users.map((u) => u._id));
  await business.save();
  await audit(a, {
    action: 'business.assignments_changed', entityType: 'business', entityId: business._id,
    businessId: business._id, summary: `Set ${unique.length} assigned user(s) on ${business.legalName}`,
  });
  return business.assignedUsers;
}

export const listAuthorizations = (business: BusinessDoc) =>
  BusinessAuthorization.find({ businessId: business._id }).sort({ createdAt: -1 }).lean();

export async function createAuthorization(
  a: Actor,
  business: BusinessDoc,
  input: { representativeName: string; scope: string; authorizedOn: Date; evidenceRef?: string },
) {
  try {
    const doc = await BusinessAuthorization.create({
      ...input, firmId: a.firmId, businessId: business._id, createdBy: a.userId,
    });
    await audit(a, {
      action: 'authorization.created', entityType: 'authorization', entityId: doc._id, businessId: business._id,
      summary: `Recorded authorization from ${input.representativeName} for ${business.legalName}`,
    });
    return doc;
  } catch (err) {
    if ((err as { code?: number })?.code === 11000)
      throw new AppError(409, 'An active authorization already exists. Revoke it first.');
    throw err;
  }
}

export async function revokeAuthorization(a: Actor, business: BusinessDoc, id: string, reason: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Authorization not found');
  const doc = await BusinessAuthorization.findOneAndUpdate(
    { _id: id, businessId: business._id, firmId: a.firmId, status: 'active' },
    { status: 'revoked', revokedAt: new Date(), revokedBy: a.userId, revokeReason: reason },
    { returnDocument: 'after' },
  );
  if (!doc) throw new AppError(404, 'Active authorization not found');
  await audit(a, {
    action: 'authorization.revoked', entityType: 'authorization', entityId: doc._id, businessId: business._id,
    summary: `Revoked authorization for ${business.legalName}`, meta: { reason },
  });
  return doc;
}

export async function listAudit(a: Actor, business: BusinessDoc, page: number, limit: number) {
  const filter = { firmId: a.firmId, businessId: business._id };
  const [items, total] = await Promise.all([
    AuditEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditEvent.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}