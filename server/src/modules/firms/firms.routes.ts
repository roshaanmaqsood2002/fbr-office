import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { requirePermission } from '../../middlewares/rbac';
import { Firm } from '../../models/Firm';
import { audit } from '../../utils/audit';

export const firmRouter = Router();

firmRouter.get('/settings', asyncHandler(async (req, res) => {
  const firm = await Firm.findById(req.auth!.firmId).select('settings').lean();
  res.json({ settings: { requireInvoiceApproval: firm?.settings?.requireInvoiceApproval ?? true } });
}));

firmRouter.patch('/settings', requirePermission('firm.settings'),
  validate(z.object({ requireInvoiceApproval: z.boolean() })),
  asyncHandler(async (req, res) => {
    await Firm.updateOne({ _id: req.auth!.firmId }, { $set: { 'settings.requireInvoiceApproval': req.body.requireInvoiceApproval } });
    await audit(req.auth!, {
      action: 'firm.settings_changed', entityType: 'firm', entityId: req.auth!.firmId,
      summary: `Invoice approval ${req.body.requireInvoiceApproval ? 'turned on' : 'turned off'}`,
    });
    res.json({ settings: { requireInvoiceApproval: req.body.requireInvoiceApproval } });
  }));