import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { validate } from '../../middlewares/validate';
import { requirePermission } from '../../middlewares/rbac';
import { requireActiveBusiness } from '../../middlewares/business';
import { paging, str } from '../../utils/query';
import * as s from './transaction.service';
import { createTransactionSchema, voidSchema } from './transaction.schema';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

export const transactionRouter = Router({ mergeParams: true });

transactionRouter.get('/', requirePermission('transaction.read'), asyncHandler(async (req, res) => {
  res.json(await s.listTransactions(req.business!, { search: str(req.query.search), status: str(req.query.status), ...paging(req.query) }));
}));

transactionRouter.post('/', requirePermission('transaction.write'), requireActiveBusiness, validate(createTransactionSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ transaction: await s.createTransaction(req.auth!, req.business!, req.body) });
  }));

transactionRouter.post('/:id/void', requirePermission('transaction.write'), requireActiveBusiness, validate(voidSchema),
  asyncHandler(async (req, res) => {
    res.json({ transaction: await s.voidTransaction(req.auth!, req.business!, String(req.params.id), req.body.reason) });
  }));

// ?commit=true to write; without it you get a validation preview only
transactionRouter.post('/import', requirePermission('transaction.write'), requireActiveBusiness, upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'Attach a CSV file');
    if (!/\.csv$/i.test(req.file.originalname)) throw new AppError(400, 'Only .csv files are supported');
    res.json(await s.importCsv(req.auth!, req.business!, req.file.buffer.toString('utf8'), req.query.commit === 'true'));
  }));