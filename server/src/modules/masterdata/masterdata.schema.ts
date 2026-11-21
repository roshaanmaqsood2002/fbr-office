import { z } from 'zod';
import { hsCodeField, ntnField, percentField } from '../../utils/validators';

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  sku: z.string().trim().max(40).optional(),
  description: z.string().trim().max(500).optional(),
  hsCode: hsCodeField.optional(),
  uom: z.string().trim().min(1, 'Unit of measure is required').max(60),
  unitPrice: z.number().int().min(0),
  taxRatePercent: percentField,
});
export const updateProductSchema = productSchema.partial().extend({ isActive: z.boolean().optional() });

const customerBase = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  registrationType: z.enum(['registered', 'unregistered']),
  ntn: ntnField.optional(),
  address: z.string().trim().max(300).optional(),
  province: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Invalid email').optional(),
});
export const customerSchema = customerBase.refine(
  (v) => v.registrationType !== 'registered' || !!v.ntn,
  { message: 'Registered buyers need an NTN', path: ['ntn'] },
);
export const updateCustomerSchema = customerBase.partial().extend({ isActive: z.boolean().optional() });