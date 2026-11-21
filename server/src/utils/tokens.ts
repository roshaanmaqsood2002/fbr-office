import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { Role } from '../models/User';

export interface AccessPayload {
  sub: string; // userId
  firmId: string;
  role: Role;
}

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60 });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;

export const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');