import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { requirePermission } from '../../middlewares/rbac';
import { requireActiveBusiness } from '../../middlewares/business';
import { Firm } from '../../models/Firm';
import { paging, str } from '../../utils/query';
import * as s from './invoice.service';
import { streamInvoicePdf } from './invoice.pdf';
import { createInvoiceSchema, reasonSchema, updateInvoiceSchema } from './invoice.schema';

export const invoiceRouter = Router({ mergeParams: true });
const id = (req: { params: Record<string, unknown> }) => String(req.params.id);

invoiceRouter.get('/', requirePermission('invoice.read'), asyncHandler(async (req, res) => {
  res.json(await s.listInvoices(req.business!, { search: str(req.query.search), status: str(req.query.status), ...paging(req.query) }));
}));

invoiceRouter.post('/', requirePermission('invoice.write'), requireActiveBusiness, validate(createInvoiceSchema),
  asyncHandler(async (req, res) => { res.status(201).json({ invoice: await s.createInvoice(req.auth!, req.business!, req.body) }); }));

invoiceRouter.get('/:id', requirePermission('invoice.read'),
  asyncHandler(async (req, res) => { res.json({ invoice: await s.getInvoiceDetail(req.business!, id(req)) }); }));

invoiceRouter.patch('/:id', requirePermission('invoice.write'), requireActiveBusiness, validate(updateInvoiceSchema),
  asyncHandler(async (req, res) => { res.json({ invoice: await s.updateDraft(req.auth!, req.business!, id(req), req.body) }); }));

invoiceRouter.delete('/:id', requirePermission('invoice.write'),
  asyncHandler(async (req, res) => { await s.deleteDraft(req.auth!, req.business!, id(req)); res.json({ message: 'Draft deleted' }); }));

invoiceRouter.post('/:id/validate', requirePermission('invoice.read'),
  asyncHandler(async (req, res) => { res.json(await s.validateOne(req.business!, id(req))); }));

invoiceRouter.post('/:id/finalize', requirePermission('invoice.write'), requireActiveBusiness,
  asyncHandler(async (req, res) => { res.json(await s.finalize(req.auth!, req.business!, id(req))); }));

invoiceRouter.post('/:id/approve', requirePermission('invoice.approve'), requireActiveBusiness,
  asyncHandler(async (req, res) => { res.json({ invoice: await s.approve(req.auth!, req.business!, id(req)) }); }));

invoiceRouter.post('/:id/return', requirePermission('invoice.approve'), validate(reasonSchema),
  asyncHandler(async (req, res) => { res.json({ invoice: await s.returnForChanges(req.auth!, req.business!, id(req), req.body.reason) }); }));

invoiceRouter.post('/:id/withdraw', requirePermission('invoice.write'),
  asyncHandler(async (req, res) => { res.json({ invoice: await s.withdraw(req.auth!, req.business!, id(req)) }); }));

invoiceRouter.post('/:id/cancel', requirePermission('invoice.write'), validate(reasonSchema),
  asyncHandler(async (req, res) => { res.json({ invoice: await s.cancel(req.auth!, req.business!, id(req), req.body.reason) }); }));

invoiceRouter.get('/:id/pdf', requirePermission('invoice.read'), asyncHandler(async (req, res) => {
  const b = req.business!;
  const inv = await s.getInvoiceDetail(b, id(req));
  const firm = await Firm.findById(b.firmId).select('name').lean();
  streamInvoicePdf(res, inv as never, { name: b.legalName, ntn: b.ntn, strn: b.strn, firmName: firm?.name ?? '' });
}));