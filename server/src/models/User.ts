
import { Schema, model, Types } from 'mongoose';

export const ROLES = ['owner', 'admin', 'staff', 'viewer'] as const;

export type Role = (typeof ROLES)[number];


export interface IUser {
  _id: Types.ObjectId;
  firmId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
}


const userSchema = new Schema<IUser>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'staff', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);
