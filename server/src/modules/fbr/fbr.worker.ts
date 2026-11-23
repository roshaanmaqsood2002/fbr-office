import { env } from '../../config/env';
import { Business } from '../../models/Business';
import { BusinessAuthorization } from '../../models/BusinessAuthorization';
import { FbrIntegration } from '../../models/FbrIntegration';
import { FbrSubmission } from '../../models/FbrSubmission';
import { Invoice, InvoiceStatus } from '../../models/Invoice';
import { audit } from '../../utils/audit';
import { decryptSecret } from '../../utils/crypto';
import { assertTransition } from '../invoices/invoices.states';
import { FbrResult, getFbrClient } from './fbr.client';
import { FbrPayload } from './fbr.mapper';

const STALE_LOCK_MS = 5 * 60_000;
const UNKNOWN_HINT = ' The outcome is unknown: check the FBR portal for this invoice before submitting again, to avoid a duplicate.';

const claimNext = () =>
  FbrSubmission.findOneAndUpdate(
    { status: 'queued', nextRunAt: { $lte: new Date() } },
    { $set: { status: 'processing', lockedAt: new Date() } },
    { sort: { nextRunAt: 1 }, returnDocument: 'after' },
  );
type Job = NonNullable<Awaited<ReturnType<typeof claimNext>>>;

const truncate = (v: unknown) => { try { return JSON.stringify(v ?? null).slice(0, 4000); } catch { return ''; } };
const backoffMs = (attempt: number) => Math.min(15 * 60_000, env.FBR_RETRY_BASE_SECONDS * 1000 * 2 ** (attempt - 1));
const actorFor = (job: Job) => ({ userId: job.submittedBy.toString(), firmId: job.firmId.toString(), role: 'system' as const, name: 'FBR queue' });

async function setInvoice(job: Job, to: InvoiceStatus, set: Record<string, unknown>) {
  assertTransition('submitted', to);
  await Invoice.updateOne({ _id: job.invoiceId, firmId: job.firmId, businessId: job.businessId, status: 'submitted' }, { $set: { status: to, ...set } });
}

type Outcome = 'blocked' | 'permanent_error' | 'transient_error' | 'unknown_outcome';

async function failJob(job: Job, outcome: Outcome, message: string, startedAt: Date, extra: { httpStatus?: number; raw?: unknown } = {}) {
  await FbrSubmission.updateOne(
    { _id: job._id },
    {
      $push: { attempts: { at: startedAt, finishedAt: new Date(), outcome, httpStatus: extra.httpStatus, message, raw: truncate(extra.raw) } },
      $set: { status: 'failed', active: false, lastError: message, completedAt: new Date(), lockedAt: null },
    },
  );
  await setInvoice(job, 'action_required', { fbrLastError: message });
  await audit(actorFor(job), { action: 'fbr.failed', entityType: 'invoice', entityId: job.invoiceId, businessId: job.businessId, summary: `FBR submission of ${job.invoiceNumber} needs attention: ${message}` });
}

// A job still "processing" means the worker stopped mid-request. We cannot know whether FBR received it and the
// API has no idempotency key, so it is never resent automatically.
async function failStaleJobs() {
  const stale = await FbrSubmission.find({ status: 'processing', lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } });
  for (const job of stale) await failJob(job, 'unknown_outcome', `The server stopped while sending this invoice to FBR.${UNKNOWN_HINT}`, new Date());
}

async function processJob(job: Job) {
  const attemptNo = job.attempts.length + 1;
  const startedAt = new Date();
  const record = (outcome: string, extra: { httpStatus?: number; message?: string; raw?: unknown }, set: Record<string, unknown>) =>
    FbrSubmission.updateOne(
      { _id: job._id },
      { $push: { attempts: { at: startedAt, finishedAt: new Date(), outcome, httpStatus: extra.httpStatus, message: extra.message, raw: truncate(extra.raw) } }, $set: { lockedAt: null, ...set } },
    );

  // Re-checked on EVERY attempt, so a revoked authorization or disconnected FBR stops submissions immediately
  const [business, authorized, integ] = await Promise.all([
    Business.findOne({ _id: job.businessId, firmId: job.firmId }).select('status').lean(),
    BusinessAuthorization.exists({ businessId: job.businessId, status: 'active' }),
    FbrIntegration.findOne({ businessId: job.businessId, environment: job.environment }).select('+credentials.token'),
  ]);
  const blocker = !business || business.status !== 'active' ? 'The client is no longer active'
    : !authorized ? 'The client authorization was revoked'
    : !integ || integ.status !== 'connected' || !integ.credentials?.token ? 'The FBR connection is not available'
    : null;
  if (blocker) return failJob(job, 'blocked', blocker, startedAt);

  let result: FbrResult;
  try {
    result = await getFbrClient().submit(job.environment, { token: decryptSecret(integ!.credentials!.token!) }, job.requestSnapshot as FbrPayload, job._id.toString());
  } catch (e) {
    // We do not know how far the request got
    result = { transport: 'error', retryable: false, outcomeUnknown: true, message: (e as Error).message };
  }

  if (result.transport === 'ok' && result.accepted) {
    await record('accepted', result, { status: 'accepted', active: true, fbrStatus: 'accepted', fbrInvoiceNumber: result.fbrInvoiceNumber, completedAt: new Date() });
    await setInvoice(job, 'accepted', { fbrInvoiceNumber: result.fbrInvoiceNumber, fbrAcceptedAt: new Date(), fbrLastError: null });
    await audit(actorFor(job), { action: 'fbr.accepted', entityType: 'invoice', entityId: job.invoiceId, businessId: job.businessId, summary: `FBR accepted ${job.invoiceNumber} (${result.fbrInvoiceNumber})` });
    return;
  }

  if (result.transport === 'ok') {
    // FBR's business verdict is "no": never retried
    const message = (result.errors ?? []).slice(0, 3).map((e) => (e.code ? `[${e.code}] ${e.message}` : e.message)).join('; ') || 'Rejected by FBR';
    await record('rejected', { ...result, message }, { status: 'rejected', active: false, fbrStatus: 'rejected', errors: result.errors ?? [], lastError: message, completedAt: new Date() });
    await setInvoice(job, 'rejected', { fbrLastError: message });
    await audit(actorFor(job), { action: 'fbr.rejected', entityType: 'invoice', entityId: job.invoiceId, businessId: job.businessId, summary: `FBR rejected ${job.invoiceNumber}: ${message}` });
    return;
  }

  const message = result.message ?? 'Could not reach FBR';
  if (result.outcomeUnknown) return failJob(job, 'unknown_outcome', `${message}${UNKNOWN_HINT}`, startedAt, result);

  if (result.retryable && attemptNo < env.FBR_MAX_ATTEMPTS) {
    await record('transient_error', result, { status: 'queued', nextRunAt: new Date(Date.now() + backoffMs(attemptNo)), lastError: message });
    return;
  }
  if (result.httpStatus === 401) {
    await FbrIntegration.updateOne({ businessId: job.businessId, environment: job.environment }, { $set: { status: 'error', lastTestMessage: message } });
  }
  return failJob(job, result.retryable ? 'transient_error' : 'permanent_error', result.retryable ? `${message} (gave up after ${attemptNo} attempts)` : message, startedAt, result);
}

export function startSubmissionWorker() {
  let stopped = false;
  let timer: NodeJS.Timeout;

  const tick = async () => {
    try {
      await failStaleJobs();
      for (let i = 0; i < 10; i++) { // bounded batch per tick
        const job = await claimNext();
        if (!job) break;
        await processJob(job).catch((err) => console.error('FBR job failed unexpectedly', job._id.toString(), err));
      }
    } catch (err) {
      console.error('FBR worker error', err);
    }
    if (!stopped) timer = setTimeout(tick, env.FBR_QUEUE_POLL_MS);
  };

  timer = setTimeout(tick, 1000);
  console.log(`FBR submission worker started (adapter: ${env.FBR_ADAPTER})`);
  return () => { stopped = true; clearTimeout(timer); };
}