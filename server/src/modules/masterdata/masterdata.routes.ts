import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { requirePermission } from '../../middlewares/rbac';
import { requireActiveBusiness } from '../../middlewares/business';
import { paging, str } from '../../utils/query';
import * as s from './masterdata.service';
import { customerSchema, productSchema, updateCustomerSchema, updateProductSchema } from './masterdata.schema';

const listQuery = (q: Record<string, unknown>) => ({
  search: str(q.search),
  includeInactive: q.includeInactive === 'true',
  ...paging(q),
});

export const productRouter = Router({ mergeParams: true });
productRouter.get('/', requirePermission('masterdata.read'),
  asyncHandler(async (req, res) => { res.json(await s.listProducts(req.business!, listQuery(req.query))); }));
productRouter.post('/', requirePermission('masterdata.write'), requireActiveBusiness, validate(productSchema),
  asyncHandler(async (req, res) => { res.status(201).json({ product: await s.createProduct(req.auth!, req.business!, req.body) }); }));
productRouter.patch('/:id', requirePermission('masterdata.write'), requireActiveBusiness, validate(updateProductSchema),
  asyncHandler(async (req, res) => { res.json({ product: await s.updateProduct(req.auth!, req.business!, String(req.params.id), req.body) }); }));

export const customerRouter = Router({ mergeParams: true });
customerRouter.get('/', requirePermission('masterdata.read'),
  asyncHandler(async (req, res) => { res.json(await s.listCustomers(req.business!, listQuery(req.query))); }));
customerRouter.post('/', requirePermission('masterdata.write'), requireActiveBusiness, validate(customerSchema),
  asyncHandler(async (req, res) => { res.status(201).json({ customer: await s.createCustomer(req.auth!, req.business!, req.body) }); }));
customerRouter.patch('/:id', requirePermission('masterdata.write'), requireActiveBusiness, validate(updateCustomerSchema),
  asyncHandler(async (req, res) => { res.json({ customer: await s.updateCustomer(req.auth!, req.business!, String(req.params.id), req.body) }); }));