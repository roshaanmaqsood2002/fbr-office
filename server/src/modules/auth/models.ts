import { Schema, model, InferSchemaType } from 'mongoose';
import { ROLES } from '../../common/permissions';

// ---------- User ----------
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true },
);
export type UserDoc = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);

// ---------- Law firm (tenant) ----------
const lawFirmSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true },
);
export const LawFirmModel = model('LawFirm', lawFirmSchema);

// ---------- Membership (user <-> firm, with role) ----------
const membershipSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'LawFirm', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
    // Optional client-level assignment. Empty = all businesses in the firm.
    businessAssignments: [{ type: Schema.Types.ObjectId, ref: 'Business' }],
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true },
);
membershipSchema.index({ firmId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1 });
export const MembershipModel = model('Membership', membershipSchema);

// ---------- Refresh token (rotation + reuse detection) ----------
const refreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  firmId: { type: Schema.Types.ObjectId, ref: 'LawFirm', required: true },
  tokenHash: { type: String, required: true, unique: true },
  familyId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
// MongoDB removes expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
