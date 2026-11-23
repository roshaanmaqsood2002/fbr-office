import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { requirePermission } from '../../middlewares/rbac';
import { requireActiveBusiness } from '../../middlewares/business';
import { paging } from '../../utils/query';
import * as s from './fbr.service';

export const fbrRouter = Router({ mergeParams: true });

const environment = z.enum(['sandbox', 'production']);
const tokenBody = z.object({ token: z.string().trim().min(8, 'Token looks too short').max(2000) });
const submitBody = z.object({ environment, scenarioId: z.string().optional() });
const envParam = (v: unknown) => environment.parse(v);


fbrRouter.get('/integrations', requirePermission('fbr.read'), asyncHandler(async (req, res) => {
  res.json({ adapter: env.FBR_ADAPTER, integrations: await s.listIntegrations(req.business!) });
}));

fbrRouter.put('/integrations/:environment', requirePermission('fbr.manage'), validate(tokenBody), asyncHandler(async (req, res) => {
  res.json({ integrations: await s.connectIntegration(req.auth!, req.business!, envParam(req.params.environment), req.body.token) });
}));

fbrRouter.post('/integrations/:environment/test', requirePermission('fbr.manage'), asyncHandler(async (req, res) => {
  res.json(await s.testIntegration(req.auth!, req.business!, envParam(req.params.environment)));
}));

fbrRouter.delete('/integrations/:environment', requirePermission('fbr.manage'), asyncHandler(async (req, res) => {
  await s.disconnectIntegration(req.auth!, req.business!, envParam(req.params.environment));
  res.json({ message: 'Disconnected' });
}));

fbrRouter.get('/submissions', requirePermission('fbr.read'), asyncHandler(async (req, res) => {
  res.json(await s.listSubmissions(req.business!, { group: String(req.query.group ?? 'pending'), ...paging(req.query) }));
}));

fbrRouter.post('/invoices/:invoiceId/submit', requirePermission('fbr.submit'), requireActiveBusiness, validate(submitBody), asyncHandler(async (req, res) => {
  const sub = await s.submitInvoice(req.auth!, req.business!, String(req.params.invoiceId), req.body.environment, req.body.scenarioId);
  res.status(202).json({ submissionId: sub._id });
}));

fbrRouter.post('/invoices/:invoiceId/reopen', requirePermission('fbr.submit'), requireActiveBusiness, asyncHandler(async (req, res) => {
  res.json({ invoice: await s.reopen(req.auth!, req.business!, String(req.params.invoiceId)) });
}));

fbrRouter.post('/invoices/:invoiceId/revise', requirePermission('invoice.write'), requireActiveBusiness, asyncHandler(async (req, res) => {
  res.json({ invoice: await s.revise(req.auth!, req.business!, String(req.params.invoiceId)) });
}));