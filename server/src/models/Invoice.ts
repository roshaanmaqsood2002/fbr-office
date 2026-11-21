import { Schema, model } from "mongoose";

export const INVOICE_STATUSES = [
  "draft",
  "awaiting_approval",
  "ready_to_submit",
  "submitted",
  "accepted",
  "rejected",
  "action_required",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const buyerSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    name: { type: String, required: true, trim: true },
    registrationType: {
      type: String,
      enum: ["registered", "unregistered"],
      required: true,
    },
    ntn: { type: String, trim: true },
    address: { type: String, trim: true },
    province: { type: String, trim: true },
  },
  { _id: false },
);

const lineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    sourceTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
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

const invoiceSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    invoiceNumber: { type: String }, // assigned on first finalize, never reused
    status: { type: String, enum: INVOICE_STATUSES, default: "draft" },
    issueDate: { type: Date, required: true },
    dueDate: Date,
    notes: { type: String, trim: true },
    buyer: { type: buyerSchema, required: true },
    lines: { type: [lineSchema], validate: (v: unknown[]) => v.length > 0 },
    totals: {
      net: { type: Number, required: true },
      tax: { type: Number, required: true },
      gross: { type: Number, required: true },
    },
    sourceTransactionIds: [{ type: Schema.Types.ObjectId }],
    finalizedAt: Date,
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    returnReason: String,
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: String,
    fbrInvoiceNumber: String,
    fbrSubmittedAt: Date,
    fbrAcceptedAt: Date,
    fbrLastError: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

invoiceSchema.index(
  { businessId: 1, invoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { invoiceNumber: { $type: "string" } },
  },
);
invoiceSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const Invoice = model("Invoice", invoiceSchema);
