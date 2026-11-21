import { Schema, model } from 'mongoose';

const productSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    description: { type: String, trim: true },
    hsCode: { type: String, trim: true },
    uom: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 }, // minor units
    taxRatePercent: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ businessId: 1, name: 1 });
productSchema.index({ businessId: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string' } } });

export const Product = model('Product', productSchema);