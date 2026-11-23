import { env } from '../../config/env';
import { FbrPayload } from './fbr.mapper';

export type FbrEnvironment = 'sandbox' | 'production';
export interface FbrCredentials { token: string }
export interface FbrIssue { code?: string; field?: string; message: string }

export interface FbrResult {
  transport: 'ok' | 'error';
  retryable?: boolean; // true ONLY when the request provably never reached FBR
  outcomeUnknown?: boolean; // the request may have been processed: never resend automatically
  httpStatus?: number;
  accepted?: boolean;
  fbrInvoiceNumber?: string;
  errors?: FbrIssue[];
  message?: string;
  raw?: unknown;
}

export interface FbrClient {
  testConnection(environment: FbrEnvironment, creds: FbrCredentials): Promise<{ ok: boolean; message: string }>;
  submit(environment: FbrEnvironment, creds: FbrCredentials, payload: FbrPayload, idempotencyKey: string): Promise<FbrResult>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulator for development. Put a tag in the BUYER NAME: [reject] [flaky] [down] [auth]. Tokens starting "test_" connect. */
class MockFbrClient implements FbrClient {
  private tries = new Map<string, number>();

  async testConnection(_env: FbrEnvironment, { token }: FbrCredentials) {
    await sleep(200);
    return token.startsWith('test_')
      ? { ok: true, message: 'Connected (simulated FBR)' }
      : { ok: false, message: 'Invalid token. The simulator accepts tokens that start with "test_".' };
  }

  async submit(_env: FbrEnvironment, _creds: FbrCredentials, payload: FbrPayload, key: string): Promise<FbrResult> {
    await sleep(400);
    const name = payload.buyerBusinessName.toLowerCase();
    const n = (this.tries.get(key) ?? 0) + 1;
    this.tries.set(key, n);

    if (name.includes('[auth]')) return { transport: 'error', retryable: false, httpStatus: 401, message: 'Authentication failed (simulated)' };
    if (name.includes('[down]')) return { transport: 'error', retryable: true, httpStatus: 503, message: 'FBR service unavailable (simulated)' };
    if (name.includes('[flaky]') && n < 3) return { transport: 'error', retryable: true, httpStatus: 503, message: 'Service unavailable (simulated)' };
    if (name.includes('[reject]'))
      return {
        transport: 'ok', httpStatus: 200, accepted: false,
        errors: [{ code: '0052', field: 'items.1', message: 'Provide proper HS Code (simulated)' }],
        raw: { simulated: true },
      };
    return {
      transport: 'ok', httpStatus: 200, accepted: true,
      fbrInvoiceNumber: `${(payload.sellerNTNCNIC + '0000000').slice(0, 7)}DI${Date.now()}`,
      raw: { simulated: true },
    };
  }
}

/* ---------- Real PRAL Digital Invoicing API (spec v1.12) ---------- */
interface ItemStatus { itemSNo?: string; statusCode?: string; status?: string; invoiceNo?: string | null; errorCode?: string | null; error?: string | null }
interface PostResponse {
  invoiceNumber?: string;
  dated?: string;
  validationResponse?: { statusCode?: string; status?: string; errorCode?: string | null; error?: string | null; invoiceStatuses?: ItemStatus[] | null };
}

type CallResult =
  | { kind: 'response'; status: number; body: unknown; text: string }
  | { kind: 'network'; notSent: boolean; aborted: boolean; code?: string };

async function call(url: string, token: string, method: 'GET' | 'POST', body?: unknown): Promise<CallResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.FBR_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    return { kind: 'response', status: res.status, body: parsed, text: text.slice(0, 2000) };
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string } };
    const code = err.cause?.code;
    // Only these mean the request never left this machine, so a retry cannot duplicate an invoice
    const notSent = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code ?? '');
    return { kind: 'network', notSent, aborted: err.name === 'AbortError', code };
  } finally {
    clearTimeout(timer);
  }
}

function parsePost(body: unknown, status: number): FbrResult {
  const res = body as PostResponse | null;
  const vr = res?.validationResponse;
  if (!vr) return { transport: 'error', retryable: false, outcomeUnknown: true, httpStatus: status, message: 'FBR returned an unexpected response.', raw: body };

  const errors: FbrIssue[] = [];
  if (vr.statusCode && vr.statusCode !== '00') errors.push({ code: vr.errorCode ?? undefined, message: vr.error || 'Invoice is invalid' });
  for (const it of vr.invoiceStatuses ?? []) {
    if (it.statusCode && it.statusCode !== '00') errors.push({ code: it.errorCode ?? undefined, field: `items.${it.itemSNo ?? '?'}`, message: it.error || 'Item is invalid' });
  }
  // A response can say statusCode "00" yet status "invalid", so check the text too
  if ((vr.status ?? '').toLowerCase() === 'invalid' && errors.length === 0) errors.push({ message: vr.error || 'Invoice is invalid' });

  if (errors.length > 0) return { transport: 'ok', httpStatus: status, accepted: false, errors, raw: body };
  if (!res?.invoiceNumber) return { transport: 'error', retryable: false, outcomeUnknown: true, httpStatus: status, message: 'FBR marked the invoice valid but returned no invoice number.', raw: body };
  return { transport: 'ok', httpStatus: status, accepted: true, fbrInvoiceNumber: res.invoiceNumber, raw: body };
}

class HttpFbrClient implements FbrClient {
  async testConnection(_env: FbrEnvironment, { token }: FbrCredentials) {
    // No dedicated "ping" exists, so we call a harmless reference endpoint that needs a valid token
    const r = await call(`${env.FBR_GATEWAY_URL}/pdi/v1/provinces`, token, 'GET');
    if (r.kind === 'network') return { ok: false, message: `Could not reach FBR (${r.code ?? 'network error'}). Check the server's internet access and IP whitelisting.` };
    if (r.status === 401) return { ok: false, message: 'FBR rejected this token (401 Unauthorized).' };
    if (r.status === 200) return { ok: true, message: 'Connected to FBR.' };
    return { ok: false, message: `Unexpected response from FBR (HTTP ${r.status}).` };
  }

  async submit(environment: FbrEnvironment, { token }: FbrCredentials, payload: FbrPayload): Promise<FbrResult> {
    const suffix = environment === 'sandbox' ? env.FBR_SANDBOX_SUFFIX : '';
    const r = await call(`${env.FBR_GATEWAY_URL}/di_data/v1/di/postinvoicedata${suffix}`, token, 'POST', payload);

    if (r.kind === 'network') {
      if (r.notSent) return { transport: 'error', retryable: true, message: `Could not reach FBR (${r.code}). Will retry.` };
      return { transport: 'error', retryable: false, outcomeUnknown: true, message: r.aborted ? 'FBR did not answer in time.' : `The connection to FBR was lost (${r.code ?? 'network error'}).` };
    }
    if (r.status === 401) return { transport: 'error', retryable: false, httpStatus: 401, message: 'FBR rejected the token (401 Unauthorized). Reconnect FBR with a valid token.' };
    if ([429, 502, 503].includes(r.status)) return { transport: 'error', retryable: true, httpStatus: r.status, message: `FBR is temporarily unavailable (HTTP ${r.status}).` };
    if (r.status === 200) return parsePost(r.body, r.status);
    return {
      transport: 'error', retryable: false, outcomeUnknown: r.status >= 500, httpStatus: r.status,
      message: `FBR returned HTTP ${r.status}.`, raw: r.body ?? r.text,
    };
  }
}

let client: FbrClient | undefined;
export const getFbrClient = (): FbrClient => (client ??= env.FBR_ADAPTER === 'http' ? new HttpFbrClient() : new MockFbrClient());