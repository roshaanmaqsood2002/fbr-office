import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const BUSINESS_TYPES = ['individual', 'aop', 'company', 'other'] as const;
export const BUSINESS_STATUSES = ['active', 'suspended', 'archived'] as const;

const businessSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    legalName: { type: String, required: true, trim: true },
    tradeName: { type: String, trim: true },
    businessType: { type: String, enum: BUSINESS_TYPES, required: true },
    ntn: { type: String, required: true, trim: true },
    strn: { type: String, trim: true },
    address: { line1: String, city: String, province: String, postalCode: String },
    contacts: [
      {
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },
        designation: { type: String, trim: true },
      },
    ],
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: BUSINESS_STATUSES, default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

businessSchema.index({ firmId: 1, ntn: 1 }, { unique: true }); // duplicate check within a firm
businessSchema.index({ firmId: 1, assignedUsers: 1 });

export type BusinessDoc = HydratedDocument<InferSchemaType<typeof businessSchema>>;
export const Business = model('Business', businessSchema);