import { RequestHandler } from 'express';
import { Role } from '../models/User';
import { AppError } from '../utils/AppError';
import { Permission, can } from '../config/permissions';

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(new AppError(401, 'Authentication required'));
    if (!roles.includes(req.auth.role)) return next(new AppError(403, 'You do not have permission'));
    next();
  };

  export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(new AppError(401, 'Authentication required'));
    if (!can(req.auth.role, permission)) return next(new AppError(403, 'You do not have permission'));
    next();
  };  