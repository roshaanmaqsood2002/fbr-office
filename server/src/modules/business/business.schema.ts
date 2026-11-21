import { z } from 'zod';
import { Types } from 'mongoose';
import { BUSINESS_STATUSES, BUSINESS_TYPES } from '../../models/Business';

// Loose on purpose: tighten once the official FBR spec (Phase 0) confirms formats
const ntn = z.string().trim().regex(/^[0-9-]{7,15}$/, 'Enter a valid NTN / CNIC');

const contact = z.object({
  name: z.string().trim().min(1, 'Contact name is required'),
  email: z.string().trim().email('Invalid contact email').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  designation: z.string().trim().max(60).optional(),
});

const baseBusiness = z.object({
  legalName: z.string().trim().min(2, 'Legal name is required'),
  tradeName: z.string().trim().max(120).optional(),
  businessType: z.enum(BUSINESS_TYPES),
  ntn,
  strn: z.string().trim().max(30).optional(),
  address: z
    .object({
      line1: z.string().trim().max(200),
      city: z.string().trim().max(80),
      province: z.string().trim().max(80),
      postalCode: z.string().trim().max(20),
    })
    .partial()
    .optional(),
  contacts: z.array(contact).max(10).optional(),
});

export const createBusinessSchema = baseBusiness;
export const updateBusinessSchema = baseBusiness
  .partial()
  .extend({ status: z.enum(BUSINESS_STATUSES).optional() });

export const assignSchema = z.object({
  userIds: z.array(z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid user id')).max(200),
});

export const authorizationSchema = z.object({
  representativeName: z.string().trim().min(2, 'Representative name is required'),
  scope: z.string().trim().min(3, 'Describe the authorized scope'),
  authorizedOn: z.coerce.date(),
  evidenceRef: z.string().trim().max(200).optional(),
});

export const revokeSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason') });    