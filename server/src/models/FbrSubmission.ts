import { Schema, model } from 'mongoose';

const attemptSchema = new Schema(
  {
    at: Date,
    finishedAt: Date,
    outcome: { type: String, enum: ['accepted', 'rejected', 'transient_error', 'permanent_error', 'blocked'] },
    httpStatus: Number,
    message: String,
    raw: String, // truncated response for troubleshooting
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    environment: { type: String, enum: ['sandbox', 'production'], required: true },
    status: { type: String, enum: ['queued', 'processing', 'accepted', 'rejected', 'failed'], default: 'queued' },
    fbrStatus: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }, // FBR's verdict
    // True while queued, processing or accepted: at most one such submission per invoice
    active: { type: Boolean, default: true },
    nextRunAt: { type: Date, default: Date.now },
    lockedAt: Date,
    attempts: { type: [attemptSchema], default: [] },
    fbrInvoiceNumber: String,
    errors: [{ _id: false, code: String, field: String, message: String }],
    lastError: String,
    requestSnapshot: { type: Schema.Types.Mixed, required: true }, // frozen payload: retries send identical data
    invoiceNumber: String,
    buyerName: String,
    gross: Number,
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: Date,
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

// Idempotency guard: a second open/accepted submission for the same invoice is rejected by the database
submissionSchema.index({ invoiceId: 1 }, { unique: true, partialFilterExpression: { active: true } });
submissionSchema.index({ status: 1, nextRunAt: 1 });
submissionSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const FbrSubmission = model('FbrSubmission', submissionSchema);