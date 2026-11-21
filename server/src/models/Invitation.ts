
import { Schema, model, Types } from 'mongoose';
import type { Role } from './User';

export type InvitationRole = Exclude<Role, 'owner'>;

export interface IInvitation {
  firmId: Types.ObjectId;
  email: string;
  role: InvitationRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedAt: Date | null;
}

const invitationSchema = new Schema<IInvitation>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'viewer'],
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

invitationSchema.index({ firmId: 1, email: 1 });

export const Invitation = model<IInvitation>(
  'Invitation',
  invitationSchema,
);
