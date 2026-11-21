import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requirePermission } from '../../middlewares/rbac';
import { loadBusiness } from '../../middlewares/business';
import * as v from './business.schema';
import * as c from './business.controller';
import { customerRouter, productRouter } from '../masterdata/masterdata.routes';
import { transactionRouter } from '../transactions/transaction.routes';
import { invoiceRouter } from '../invoices/invoice.routes';
import { fbrRouter } from '../fbr/fbr.routes';

export const businessRouter = Router();

businessRouter.get('/', requirePermission('business.read'), c.list);
businessRouter.post('/', requirePermission('business.create'), validate(v.createBusinessSchema), c.create);

// Everything below is scoped to one client; loadBusiness enforces firm + assignment access
const scoped = Router({ mergeParams: true });
scoped.use(loadBusiness);

scoped.get('/', requirePermission('business.read'), c.detail);
scoped.patch('/', requirePermission('business.update'), validate(v.updateBusinessSchema), c.update);
scoped.put('/assignments', requirePermission('business.assign'), validate(v.assignSchema), c.assign);
scoped.get('/authorizations', requirePermission('business.read'), c.authorizations);
scoped.post('/authorizations', requirePermission('authorization.manage'), validate(v.authorizationSchema), c.addAuthorization);
scoped.post('/authorizations/:authId/revoke', requirePermission('authorization.manage'), validate(v.revokeSchema), c.revokeAuthorization);
scoped.get('/audit', requirePermission('audit.read'), c.auditLog);
scoped.use('/products', productRouter);
scoped.use('/customers', customerRouter);
scoped.use('/transactions', transactionRouter);
scoped.use('/invoices', invoiceRouter);
scoped.use('/fbr', fbrRouter);

businessRouter.use('/:businessId', scoped);