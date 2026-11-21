import { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { Business } from '../models/Business';
import { AppError } from '../utils/AppError';
import { isFirmWide } from '../config/permissions';
import { Role } from '../models/User';

// Firm-wide roles see every client of their firm; others only clients they are assigned to
export const scopeFilter = (a: { userId: string; firmId: string; role: Role }) => ({
  firmId: a.firmId,
  ...(isFirmWide(a.role) ? {} : { assignedUsers: a.userId }),
});

export const loadBusiness: RequestHandler = async (req, _res, next) => {
  try {
    const id = String(req.params.businessId);
    if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Client not found');
    const business = await Business.findOne({ _id: id, ...scopeFilter(req.auth!) });
    if (!business) throw new AppError(404, 'Client not found'); // 404, never 403: don't leak existence
    req.business = business;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireActiveBusiness: RequestHandler = (req, _res, next) =>
  req.business?.status === 'active'
    ? next()
    : next(new AppError(409, 'This client is not active. Reactivate it to make changes.'));