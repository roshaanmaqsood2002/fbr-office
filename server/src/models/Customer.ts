import { Schema, model } from 'mongoose';

const customerSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true },
    registrationType: { type: String, enum: ['registered', 'unregistered'], required: true },
    ntn: { type: String, trim: true },
    address: { type: String, trim: true },
    province: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customerSchema.index({ businessId: 1, name: 1 });
customerSchema.index({ businessId: 1, ntn: 1 }, { unique: true, partialFilterExpression: { ntn: { $type: 'string' } } });

export const Customer = model('Customer', customerSchema);