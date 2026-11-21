import { Schema, model } from 'mongoose';

const lineSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    hsCode: { type: String, trim: true },
    uom: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true }, // minor units
    taxRatePercent: { type: Number, required: true },
    net: { type: Number, required: true },
    tax: { type: Number, required: true },
    gross: { type: Number, required: true },
  },
  { _id: false },
);

const transactionSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    source: { type: String, enum: ['manual', 'csv'], required: true },
    externalReference: { type: String, required: true, trim: true },
    importBatchId: { type: Schema.Types.ObjectId },
    transactionDate: { type: Date, required: true },
    customerName: { type: String, required: true, trim: true },
    customerNtn: { type: String, trim: true },
    lines: { type: [lineSchema], validate: (v: unknown[]) => v.length > 0 },
    totals: {
      net: { type: Number, required: true },
      tax: { type: Number, required: true },
      gross: { type: Number, required: true },
    },
    status: { type: String, enum: ['unbilled', 'invoiced', 'void'], default: 'unbilled' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    voidReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Duplicate prevention: the same source reference can only exist once per client
transactionSchema.index({ businessId: 1, source: 1, externalReference: 1 }, { unique: true });
transactionSchema.index({ businessId: 1, transactionDate: -1 });
transactionSchema.index({ invoiceId: 1 });

export const Transaction = model('Transaction', transactionSchema);