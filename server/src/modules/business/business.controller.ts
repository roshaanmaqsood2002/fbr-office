import { asyncHandler } from '../../utils/asyncHandler';
import * as s from './business.service';

const paging = (q: Record<string, unknown>, max = 50) => ({
  page: Math.max(1, Number(q.page) || 1),
  limit: Math.min(max, Math.max(1, Number(q.limit) || 20)),
});

export const list = asyncHandler(async (req, res) => {
  res.json(
    await s.listBusinesses(req.auth!, {
      search: req.query.search ? String(req.query.search).slice(0, 80) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      ...paging(req.query),
    }),
  );
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ business: await s.createBusiness(req.auth!, req.body) });
});

export const detail = asyncHandler(async (req, res) => {
  res.json(await s.getBusinessDetail(req.business!));
});

export const update = asyncHandler(async (req, res) => {
  res.json({ business: await s.updateBusiness(req.auth!, req.business!, req.body) });
});

export const assign = asyncHandler(async (req, res) => {
  res.json({ assignedUsers: await s.assignUsers(req.auth!, req.business!, req.body.userIds) });
});

export const authorizations = asyncHandler(async (req, res) => {
  res.json({ authorizations: await s.listAuthorizations(req.business!) });
});

export const addAuthorization = asyncHandler(async (req, res) => {
  res.status(201).json({ authorization: await s.createAuthorization(req.auth!, req.business!, req.body) });
});

export const revokeAuthorization = asyncHandler(async (req, res) => {
  res.json({
    authorization: await s.revokeAuthorization(req.auth!, req.business!, String(req.params.authId), req.body.reason),
  });
});

export const auditLog = asyncHandler(async (req, res) => {
  const { page, limit } = paging(req.query, 100);
  res.json(await s.listAudit(req.auth!, req.business!, page, limit));
});