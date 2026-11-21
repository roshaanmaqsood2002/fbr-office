import { Schema, model } from 'mongoose';

const refreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // auto-cleanup
});

export const RefreshToken = model('RefreshToken', refreshTokenSchema);