import { z } from 'zod';
import { Types } from 'mongoose';
import { ntnField } from '../../utils/validators';
import { lineSchema } from '../transactions/transaction.schema';
import { SALE_TYPES } from '../fbr/fbr.reference';

const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid id');

export const invoiceLineSchema = lineSchema.extend({
  productId: objectId.optional(),
  sourceTransactionId: objectId.optional(),
});

const buyerSchema = z.object({
  customerId: objectId.optional(),
  name: z.string().trim().min(2, 'Buyer name is required').max(120),
  registrationType: z.enum(['registered', 'unregistered']),
  ntn: ntnField.optional(),
  address: z.string().trim().max(300).optional(),
  province: z.string().trim().max(80).optional(),
});

export const createInvoiceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('from_sales'),
    transactionIds: z.array(objectId).min(1).max(100),
    issueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({
    mode: z.literal('manual'),
    buyer: buyerSchema,
    lines: z.array(invoiceLineSchema).min(1).max(200),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
]);

export const updateInvoiceSchema = z
  .object({
    buyer: buyerSchema.optional(),
    lines: z.array(invoiceLineSchema).min(1).max(200).optional(),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    saleType: z.enum(SALE_TYPES).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason').max(200) });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;