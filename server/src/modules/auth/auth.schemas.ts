import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');

export const signupSchema = z.object({
  firmName: z.string().trim().min(2, 'Firm name is required'),
  name: z.string().trim().min(2, 'Your name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20, 'Invalid invitation'),
  name: z.string().trim().min(2, 'Your name is required'),
  password: passwordSchema,
});