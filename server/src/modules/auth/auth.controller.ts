import { CookieOptions, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './auth.service';
import { env, isProd } from '../../config/env';

const COOKIE = 'refreshToken';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
};

function sendSession(res: Response, s: { accessToken: string; refreshToken: string; user: unknown }, status = 200) {
  res.cookie(COOKIE, s.refreshToken, cookieOptions);
  res.status(status).json({ accessToken: s.accessToken, user: s.user });
}

export const signup = asyncHandler(async (req, res) => sendSession(res, await service.signup(req.body), 201));

export const login = asyncHandler(async (req, res) =>
  sendSession(res, await service.login(req.body.email, req.body.password)),
);

export const refresh = asyncHandler(async (req: Request, res) => {
  try {
    sendSession(res, await service.refresh(req.cookies[COOKIE]));
  } catch (err) {
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await service.logout(req.cookies[COOKIE]);
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await service.getMe(req.auth!.userId) });
});

export const invitationPreview = asyncHandler(async (req, res) => {
  res.json(await service.getInvitationPreview(String(req.params.token)));
});

export const acceptInvite = asyncHandler(async (req, res) =>
  sendSession(res, await service.acceptInvite(req.body), 201),
);