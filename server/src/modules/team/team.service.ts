import { Types } from "mongoose";
import { User, type Role } from "../../models/User";
import { Invitation, type InvitationRole } from "../../models/Invitation";
import { RefreshToken } from "../../models/RefreshToken";
import { AppError } from "../../utils/AppError";
import { generateRefreshToken, hashToken } from "../../utils/tokens";
import { env } from "../../config/env";
import { canAssign, canManage } from "./team.policy";

export interface Actor {
  userId: string;
  firmId: string;
  role: Role;
}

const INVITE_TTL_DAYS = 7;

export const listMembers = (firmId: string) =>
  User.find({ firmId })
    .select("name email role isActive createdAt")
    .sort({ createdAt: 1 })
    .lean();

export async function updateMember(
  actor: Actor,
  memberId: string,
  patch: { role?: Role; isActive?: boolean },
) {
  if (!Types.ObjectId.isValid(memberId))
    throw new AppError(404, "Member not found");
  if (memberId === actor.userId)
    throw new AppError(400, "You cannot change your own role or status");

  // Tenant-scoped lookup: a member of another firm simply doesn't exist for this actor
  const member = await User.findOne({ _id: memberId, firmId: actor.firmId });
  if (!member) throw new AppError(404, "Member not found");
  if (!canManage(actor.role, member.role))
    throw new AppError(403, "You cannot manage this member");
  if (patch.role && !canAssign(actor.role, patch.role))
    throw new AppError(403, "You cannot assign this role");

  if (patch.role) member.role = patch.role;
  if (patch.isActive !== undefined) member.isActive = patch.isActive;
  await member.save();

  if (patch.isActive === false)
    await RefreshToken.deleteMany({ userId: member._id }); // kill sessions

  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    isActive: member.isActive,
  };
}

export async function createInvitation(
  actor: Actor,
  input: { email: string; role: InvitationRole },
) {
  if (!canAssign(actor.role, input.role))
    throw new AppError(403, "You cannot invite someone with this role");
  if (await User.exists({ email: input.email }))
    throw new AppError(409, "This email is already registered");

  // Only one pending invite per firm + email: replace any older one
  await Invitation.deleteMany({
    firmId: actor.firmId,
    email: input.email,
    acceptedAt: null,
  });

  const rawToken = generateRefreshToken();
  const inv = await Invitation.create({
    firmId: actor.firmId,
    email: input.email,
    role: input.role,
    tokenHash: hashToken(rawToken),
    invitedBy: actor.userId,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
  });

  return {
    invitation: {
      id: inv._id.toString(),
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
    },
    inviteLink: `${env.CLIENT_ORIGIN}/accept-invite?token=${rawToken}`,
  };
}

export const listInvitations = (firmId: string) =>
  Invitation.find({ firmId, acceptedAt: null, expiresAt: { $gt: new Date() } })
    .select("email role expiresAt createdAt")
    .sort({ createdAt: -1 })
    .lean();

export async function revokeInvitation(firmId: string, id: string) {
  if (!Types.ObjectId.isValid(id))
    throw new AppError(404, "Invitation not found");
  const res = await Invitation.deleteOne({ _id: id, firmId, acceptedAt: null });
  if (!res.deletedCount) throw new AppError(404, "Invitation not found");
}
