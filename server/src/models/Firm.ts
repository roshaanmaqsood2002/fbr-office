import { Schema, model } from "mongoose";

const firmSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ntn: { type: String, trim: true }, // filled in later during onboarding
    settings: {
      requireInvoiceApproval: { type: Boolean, default: true },
    },
  },

  { timestamps: true },
);

export const Firm = model("Firm", firmSchema);
