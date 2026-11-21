import { Schema, model } from 'mongoose';

const auditSchema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, index: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorName: String,
    actorRole: String,
    action: { type: String, required: true }, // e.g. business.created
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    summary: { type: String, required: true },
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ firmId: 1, businessId: 1, createdAt: -1 });

// App-level guard: audit events can only be inserted. For real enforcement,
// also run the app with a DB user that has no update/delete rights on this collection.
auditSchema.pre(/^(update|delete|findOneAnd|replaceOne)/, function () {
  throw new Error('Audit events are append-only');
});

export const AuditEvent = model('AuditEvent', auditSchema);