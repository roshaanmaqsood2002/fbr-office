import { Router } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler';
import { Business } from '../../models/Business';
import { BusinessAuthorization } from '../../models/BusinessAuthorization';
import { Transaction } from '../../models/Transaction';
import { Invoice } from '../../models/Invoice';
import { AuditEvent } from '../../models/AuditEvent';
import { scopeFilter } from '../../middlewares/business';
import { can } from '../../config/permissions';

export const dashboardRouter = Router();

dashboardRouter.get('/', asyncHandler(async (req, res) => {
  const a = req.auth!;
  const firmId = new Types.ObjectId(a.firmId); // aggregate() does not cast strings, so convert once

  // Only the clients this user is allowed to see (assignment-scoped for staff and viewers)
  const businesses = await Business.find(scopeFilter(a)).select('legalName status').lean();
  const ids = businesses.map((b) => b._id);
  const names = new Map(businesses.map((b) => [b._id.toString(), b.legalName]));
  const activeBusinesses = businesses.filter((b) => b.status === 'active');
  const match = { firmId, businessId: { $in: ids } };

  const [authIds, unbilled, byStatus, recent, awaiting, activity] = await Promise.all([
    BusinessAuthorization.distinct('businessId', { ...match, status: 'active' }),
    Transaction.aggregate([
      { $match: { ...match, status: 'unbilled' } },
      { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: '$totals.gross' } } },
    ]),
    Invoice.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.find(match)
      .select('invoiceNumber status issueDate buyer.name totals.gross businessId')
      .sort({ createdAt: -1 }).limit(8).lean(),
    can(a.role, 'invoice.approve')
      ? Invoice.find({ ...match, status: 'awaiting_approval' })
          .select('invoiceNumber buyer.name totals.gross businessId')
          .sort({ finalizedAt: 1 }).limit(5).lean()
      : Promise.resolve([]),
    can(a.role, 'audit.read')
      ? AuditEvent.find({ firmId }).sort({ createdAt: -1 }).limit(8)
          .select('summary actorName actorRole createdAt').lean()
      : Promise.resolve(null),
  ]);

  const withAuth = new Set(authIds.map(String));
  const missingAuth = activeBusinesses.filter((b) => !withAuth.has(b._id.toString()));
  const invoicesByStatus = Object.fromEntries(byStatus.map((s) => [s._id as string, s.count as number]));

  const toRow = (i: (typeof recent)[number]) => ({
    _id: i._id, businessId: i.businessId, businessName: names.get(i.businessId.toString()) ?? '',
    invoiceNumber: i.invoiceNumber, status: 'status' in i ? i.status : undefined,
    issueDate: 'issueDate' in i ? i.issueDate : undefined, buyerName: i.buyer?.name, gross: i.totals?.gross ?? 0,
  });

  res.json({
    kpis: {
      activeClients: activeBusinesses.length,
      clientsMissingAuthorization: missingAuth.length,
      unbilledCount: unbilled[0]?.count ?? 0,
      unbilledGross: unbilled[0]?.gross ?? 0,
      awaitingApproval: invoicesByStatus.awaiting_approval ?? 0,
      readyToSubmit: invoicesByStatus.ready_to_submit ?? 0,
    },
    invoicesByStatus,
    attention: {
      missingAuthorization: missingAuth.slice(0, 5).map((b) => ({ _id: b._id, legalName: b.legalName })),
      awaitingApproval: awaiting.map(toRow),
    },
    recentInvoices: recent.map(toRow),
    recentActivity: activity,
  });
}));