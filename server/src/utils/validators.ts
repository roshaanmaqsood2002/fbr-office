import { z } from 'zod';

// Loose on purpose: tighten once the official FBR spec confirms formats
export const ntnField = z.string().trim().regex(/^[0-9-]{7,15}$/, 'Enter a valid NTN / CNIC');
export const hsCodeField = z.string().trim().regex(/^[0-9.]{4,12}$/, 'Enter a valid HS code');
export const percentField = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, 'Max 2 decimals');