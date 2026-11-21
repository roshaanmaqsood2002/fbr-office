import bcrypt from 'bcryptjs';
import { Firm } from '../../models/Firm';
import { User, IUser } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { generateRefreshToken, hashToken, signAccessToken } from '../../utils/tokens';
import { Invitation } from '../../models/Invitation';

async function toSessionUser(user: IUser) {
  const firm = await Firm.findById(user.firmId).select('name').lean();
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    firmId: user.firmId.toString(),
    firmName: firm?.name ?? '',
  };
}

async function createSession(user: IUser) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    firmId: user.firmId.toString(),
    role: user.role,
  });
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  return { accessToken, refreshToken, user: await toSessionUser(user) };
}

export async function signup(input: { firmName: string; name: string; email: string; password: string }) {
  if (await User.exists({ email: input.email })) throw new AppError(409, 'Email is already registered');

  const firm = await Firm.create({ name: input.firmName });
  try {
    const user = await User.create({
      firmId: firm._id,
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: 'owner',
    });
    return createSession(user.toObject());
  } catch (err) {
    await Firm.findByIdAndDelete(firm._id); // don't leave an orphan firm
    throw err;
  }
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email }).select('+passwordHash').lean();
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw new AppError(401, 'Invalid email or password');
  if (!user.isActive) throw new AppError(403, 'Your account has been deactivated');
  return createSession(user);
}

export async function refresh(rawToken: string | undefined) {
  if (!rawToken) throw new AppError(401, 'No session');
  const stored = await RefreshToken.findOneAndDelete({ tokenHash: hashToken(rawToken) }); // rotation
  if (!stored || stored.expiresAt < new Date()) throw new AppError(401, 'Session expired');
  const user = await User.findById(stored.userId).lean();
  if (!user || !user.isActive) throw new AppError(401, 'Session expired');
  return createSession(user);
}

export async function logout(rawToken: string | undefined) {
  if (rawToken) await RefreshToken.deleteOne({ tokenHash: hashToken(rawToken) });
}

export async function getMe(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user || !user.isActive) throw new AppError(401, 'Session expired');
  return toSessionUser(user);
}

// Atomically claims a pending invite so it can only be used once
async function claimInvitation(rawToken: string) {
  const inv = await Invitation.findOneAndUpdate(
    { tokenHash: hashToken(rawToken), acceptedAt: null, expiresAt: { $gt: new Date() } },
    { acceptedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!inv) throw new AppError(400, 'This invitation is invalid or has expired');
  return inv;
}

export async function getInvitationPreview(rawToken: string) {
  const inv = await Invitation.findOne({
    tokenHash: hashToken(rawToken),
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!inv) throw new AppError(400, 'This invitation is invalid or has expired');
  const firm = await Firm.findById(inv.firmId).select('name').lean();
  return { email: inv.email, role: inv.role, firmName: firm?.name ?? '' };
}

export async function acceptInvite(input: { token: string; name: string; password: string }) {
  const inv = await claimInvitation(input.token);
  try {
    if (await User.exists({ email: inv.email })) throw new AppError(409, 'Email is already registered');
    const user = await User.create({
      firmId: inv.firmId,
      name: input.name,
      email: inv.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: inv.role,
    });
    return createSession(user.toObject());
  } catch (err) {
    await Invitation.findByIdAndUpdate(inv._id, { acceptedAt: null }); // release the invite on failure
    throw err;
  }
}