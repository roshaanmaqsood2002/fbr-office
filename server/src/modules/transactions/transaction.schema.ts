import { z } from 'zod';
import { hsCodeField, ntnField, percentField } from '../../utils/validators';

export const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  hsCode: hsCodeField.optional(),
  uom: z.string().trim().min(1).max(60),
  quantity: z
    .number().positive().max(1e9)
    .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9, 'Max 3 decimals'),
  unitPrice: z.number().int().min(0),
  taxRatePercent: percentField,
});

export type LineInput = z.infer<typeof lineSchema>;

export const createTransactionSchema = z.object({
  reference: z.string().trim().min(1).max(60),
  transactionDate: z.coerce.date(),
  customerName: z.string().trim().min(2).max(120),
  customerNtn: ntnField.optional(),
  lines: z.array(lineSchema).min(1).max(200),
});

export const voidSchema = z.object({ reason: z.string().trim().min(3).max(200) });