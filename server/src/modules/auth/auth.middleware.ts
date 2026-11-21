import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { AppError } from '../../common/errors';
import type { Permission } from '../../common/permissions';
import { loadContext, toAuthContext, verifyAccessToken } from './auth.service';

/** Verifies the Bearer token and loads the caller's firm membership into req.auth. */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();

  const { userId, firmId } = verifyAccessToken(header.slice(7));
  const ctx = await loadContext(userId, firmId);
  if (!ctx) throw AppError.unauthorized('Account or firm is no longer active');

  req.auth = toAuthContext(ctx.membership);
  next();
});

/** Requires ALL listed permissions. Always checked server-side, after authenticate. */
export const requirePermission =
  (...needed: Permission[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    const missing = needed.filter((p) => !req.auth!.permissions.includes(p));
    if (missing.length) return next(AppError.forbidden());
    next();
  };
