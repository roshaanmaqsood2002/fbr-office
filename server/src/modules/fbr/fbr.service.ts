import { Types } from "mongoose";
import { BusinessDoc } from "../../models/Business";
import { BusinessAuthorization } from "../../models/BusinessAuthorization";
import { FbrIntegration } from "../../models/FbrIntegration";
import { FbrSubmission } from "../../models/FbrSubmission";
import { Invoice } from "../../models/Invoice";
import { AppError } from "../../utils/AppError";
import { audit, Actor } from "../../utils/audit";
import { decryptSecret, encryptSecret } from "../../utils/crypto";
import { assertTransition } from "../invoices/invoices.states";
import { runValidation } from "../invoices/invoice.service";
import { FbrEnvironment, getFbrClient } from "./fbr.client";
import { buildFbrPayload } from "./fbr.mapper";
import { SCENARIOS } from "./fbr.reference";

const scope = (b: BusinessDoc) => ({ firmId: b.firmId, businessId: b._id });

/* ---------- Connections (credentials never leave the server) ---------- */
export async function listIntegrations(b: BusinessDoc) {
  return FbrIntegration.find(scope(b))
    .select(
      "environment status tokenLast4 lastTestedAt lastTestMessage connectedAt",
    )
    .lean();
}

export async function connectIntegration(
  a: Actor,
  b: BusinessDoc,
  environment: FbrEnvironment,
  token: string,
) {
  const test = await getFbrClient().testConnection(environment, { token });
  if (!test.ok) throw new AppError(400, test.message); // a bad token never replaces a working one
  await FbrIntegration.findOneAndUpdate(
    { businessId: b._id, environment },
    {
      $set: {
        firmId: b.firmId,
        status: "connected",
        "credentials.token": encryptSecret(token),
        tokenLast4: token.slice(-4),
        lastTestedAt: new Date(),
        lastTestMessage: test.message,
        connectedBy: a.userId,
        connectedAt: new Date(),
      },
    },
    { upsert: true },
  );
  await audit(a, {
    action: "fbr.connected",
    entityType: "fbr_integration",
    entityId: b._id,
    businessId: b._id,
    summary: `Connected FBR (${environment}) for ${b.legalName}`,
  });
  return listIntegrations(b);
}

export async function testIntegration(
  a: Actor,
  b: BusinessDoc,
  environment: FbrEnvironment,
) {
  const integ = await FbrIntegration.findOne({
    businessId: b._id,
    environment,
  }).select("+credentials.token");
  if (!integ?.credentials?.token)
    throw new AppError(404, "FBR is not connected for this environment");
  const test = await getFbrClient().testConnection(environment, {
    token: decryptSecret(integ.credentials.token),
  });
  integ.status = test.ok ? "connected" : "error";
  integ.lastTestedAt = new Date();
  integ.lastTestMessage = test.message;
  await integ.save();
  await audit(a, {
    action: "fbr.tested",
    entityType: "fbr_integration",
    entityId: b._id,
    businessId: b._id,
    summary: `Tested FBR (${environment}): ${test.ok ? "ok" : "failed"}`,
  });
  return { ok: test.ok, message: test.message };
}

export async function disconnectIntegration(
  a: Actor,
  b: BusinessDoc,
  environment: FbrEnvironment,
) {
  const res = await FbrIntegration.updateOne(
    { businessId: b._id, environment },
    {
      $set: { status: "disconnected" },
      $unset: { "credentials.token": 1, tokenLast4: 1 },
    },
  );
  if (!res.matchedCount)
    throw new AppError(404, "FBR is not connected for this environment");
  await audit(a, {
    action: "fbr.disconnected",
    entityType: "fbr_integration",
    entityId: b._id,
    businessId: b._id,
    summary: `Disconnected FBR (${environment}) for ${b.legalName}`,
  });
}

/* ---------- Submit ---------- */
export async function submitInvoice(
  a: Actor,
  b: BusinessDoc,
  invoiceId: string,
  environment: FbrEnvironment,
  scenarioId?: string,
) {
  if (!Types.ObjectId.isValid(invoiceId))
    throw new AppError(404, "Invoice not found");
  const inv = await Invoice.findOne({ _id: invoiceId, ...scope(b) });
  if (!inv) throw new AppError(404, "Invoice not found");
  if (inv.status !== "ready_to_submit")
    throw new AppError(
      409,
      "Only invoices that are ready to submit can be sent",
    );
  if (b.status !== "active")
    throw new AppError(409, "This client is not active");
  if (
    !(await BusinessAuthorization.exists({
      businessId: b._id,
      status: "active",
    }))
  )
    throw new AppError(409, "No active authorization on file for this client");
  const integ = await FbrIntegration.findOne({ businessId: b._id, environment })
    .select("status")
    .lean();
  if (integ?.status !== "connected")
    throw new AppError(409, `FBR is not connected for ${environment}`);

  const { errors, warnings } = await runValidation(b, inv.toObject());
  if (errors.length)
    throw new AppError(
      422,
      "This invoice has errors that must be fixed first",
      "VALIDATION_FAILED",
      { errors, warnings },
    );
  if (!inv.totals) throw new AppError(422, "Invoice totals are missing");

  if (environment === 'sandbox' && !SCENARIOS.some((s) => s.id === scenarioId))
    throw new AppError(400, 'Choose the sandbox test scenario this invoice represents');

  // 1) Create the submission first: the unique index is what prevents double submission
  let sub;
  try {
    sub = await FbrSubmission.create({
      ...scope(b),
      invoiceId: inv._id,
      environment,
      status: "queued",
      active: true,
      requestSnapshot: buildFbrPayload(inv.toObject() as never, b as never, {
        environment,
        scenarioId,
      }),
      scenarioId: environment === "sandbox" ? scenarioId : undefined,
      buyerName: inv.buyer.name,
      gross: inv.totals.gross,
      submittedBy: a.userId,
    });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000)
      throw new AppError(409, "This invoice has already been submitted");
    throw err;
  }

  // 2) Then move the invoice atomically; if someone beat us to it, undo
  assertTransition("ready_to_submit", "submitted");
  const moved = await Invoice.findOneAndUpdate(
    { _id: inv._id, ...scope(b), status: "ready_to_submit" },
    {
      $set: {
        status: "submitted",
        fbrSubmittedAt: new Date(),
        fbrLastError: null,
      },
    },
  );
  if (!moved) {
    await FbrSubmission.deleteOne({ _id: sub._id });
    throw new AppError(
      409,
      "This invoice changed while submitting. Refresh and try again.",
    );
  }

  await audit(a, {
    action: "fbr.submitted",
    entityType: "invoice",
    entityId: inv._id,
    businessId: b._id,
    summary: `Submitted ${inv.invoiceNumber} to FBR (${environment})`,
  });
  return sub;
}

/* ---------- Recover from rejected / action required ---------- */
async function moveInvoice(
  a: Actor,
  b: BusinessDoc,
  id: string,
  from: ("rejected" | "action_required")[],
  to: "draft" | "ready_to_submit",
  action: string,
  summary: string,
) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "Invoice not found");
  from.forEach((f) => assertTransition(f, to));
  const inv = await Invoice.findOneAndUpdate(
    { _id: id, ...scope(b), status: { $in: from } },
    { $set: { status: to, fbrLastError: null } },
    { returnDocument: 'after' },
  );
  if (!inv)
    throw new AppError(
      409,
      "This invoice cannot be moved from its current status",
    );
  await audit(a, {
    action,
    entityType: "invoice",
    entityId: inv._id,
    businessId: b._id,
    summary: `${summary} (${inv.invoiceNumber})`,
  });
  return inv;
}

// action_required -> ready_to_submit (e.g. after a connection problem is fixed): then submit again
export const reopen = (a: Actor, b: BusinessDoc, id: string) =>
  moveInvoice(
    a,
    b,
    id,
    ["action_required"],
    "ready_to_submit",
    "invoice.reopened",
    "Reopened for submission",
  );

// rejected / action_required -> draft: fix the data, then finalize and approve again
export const revise = (a: Actor, b: BusinessDoc, id: string) =>
  moveInvoice(
    a,
    b,
    id,
    ["rejected", "action_required"],
    "draft",
    "invoice.revised",
    "Moved back to draft after FBR",
  );

/* ---------- Reconciliation ---------- */
type SubmissionStatus =
  | "queued"
  | "processing"
  | "accepted"
  | "rejected"
  | "failed";
type SubmissionGroup = "pending" | "accepted" | "rejected" | "attention";

const GROUPS: Record<SubmissionGroup, SubmissionStatus[]> = {
  pending: ["queued", "processing"],
  accepted: ["accepted"],
  rejected: ["rejected"],
  attention: ["failed"],
};

export async function listSubmissions(
  b: BusinessDoc,
  q: { group: string; page: number; limit: number },
) {
  const statuses = GROUPS[q.group as SubmissionGroup] ?? GROUPS.pending;
  const filter = { ...scope(b), status: { $in: statuses } };
  const [items, total, counts] = await Promise.all([
    FbrSubmission.find(filter)
      .select("-requestSnapshot")
      .sort({ updatedAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    FbrSubmission.countDocuments(filter),
    FbrSubmission.aggregate([
      { $match: scope(b) },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);
  const byStatus = Object.fromEntries(
    counts.map((c) => [c._id as string, c.n as number]),
  );
  const sum = (g: SubmissionGroup) =>
    GROUPS[g].reduce((t, s) => t + (byStatus[s] ?? 0), 0);
  return {
    items,
    total,
    page: q.page,
    limit: q.limit,
    counts: {
      pending: sum("pending"),
      accepted: sum("accepted"),
      rejected: sum("rejected"),
      attention: sum("attention"),
    },
  };
}
