import { Types } from "mongoose";
import { AuditEvent } from "../models/AuditEvent";
import { Role } from "../models/User";

interface AuditActor {
  userId: string;
  firmId: string;
  role: Role | "system";
  name: string;
}

export async function audit(
  actor: AuditActor,
  e: {
    action: string;
    entityType: string;
    entityId: string | Types.ObjectId;
    businessId?: string | Types.ObjectId;
    summary: string;
    meta?: Record<string, unknown>;
  },
) {
  try {
    await AuditEvent.create({
      firmId: actor.firmId,
      businessId: e.businessId,
      actorId: actor.userId,
      actorName: actor.name,
      actorRole: actor.role,
      action: e.action,
      entityType: e.entityType,
      entityId: String(e.entityId),
      summary: e.summary,
      meta: e.meta,
    });
  } catch (err) {
    // The business action already succeeded; log loudly rather than make the user retry.
    // Once you run MongoDB as a replica set, wrap action + audit in one transaction instead.
    console.error("AUDIT WRITE FAILED", err);
  }
}

export type Actor = NonNullable<Express.Request["auth"]>;
