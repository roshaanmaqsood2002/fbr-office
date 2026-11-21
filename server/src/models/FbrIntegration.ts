import { Schema, model } from 'mongoose';

const integrationSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    environment: { type: String, enum: ['sandbox', 'production'], required: true },
    status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
    // Encrypted at rest and never selected by default, so it cannot leak through a normal query
    credentials: { token: { type: String, select: false } },
    tokenLast4: String,
    lastTestedAt: Date,
    lastTestMessage: String,
    connectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    connectedAt: Date,
  },
  { timestamps: true },
);

integrationSchema.index({ businessId: 1, environment: 1 }, { unique: true });

export const FbrIntegration = model('FbrIntegration', integrationSchema);