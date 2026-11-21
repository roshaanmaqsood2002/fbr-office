import { z } from 'zod';

const assignableRole = z.enum(['admin', 'staff', 'viewer']);

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: assignableRole,
});

export const updateMemberSchema = z
  .object({ role: assignableRole.optional(), isActive: z.boolean().optional() })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, 'Nothing to update');