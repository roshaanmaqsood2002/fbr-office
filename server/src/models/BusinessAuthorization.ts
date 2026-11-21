import { Schema, model } from 'mongoose';

const authorizationSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    representativeName: { type: String, required: true, trim: true },
    scope: { type: String, required: true, trim: true },
    authorizedOn: { type: Date, required: true },
    evidenceRef: { type: String, trim: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    revokedAt: Date,
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    revokeReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// At most one ACTIVE authorization per business
authorizationSchema.index({ businessId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

export const BusinessAuthorization = model('BusinessAuthorization', authorizationSchema);