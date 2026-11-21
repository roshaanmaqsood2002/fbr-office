import { env } from '../../config/env';
import { FbrPayload } from './fbr.mapper';

export type FbrEnvironment = 'sandbox' | 'production';
export interface FbrCredentials { token: string }
export interface FbrIssue { code?: string; field?: string; message: string }

export interface FbrResult {
  transport: 'ok' | 'error'; // did we get a usable answer from FBR?
  retryable?: boolean; // only meaningful for transport errors
  httpStatus?: number;
  accepted?: boolean; // FBR's business verdict, only when transport is ok
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

/**
 * Simulated FBR for development. Put a tag in the BUYER NAME:
 *   [reject] -> FBR rejects the invoice (business rejection, no retry)
 *   [flaky]  -> times out twice, then succeeds (exercises retries)
 *   [down]   -> always unavailable (retries, then "Action required")
 *   [auth]   -> authentication failure (no retry)
 * No tag -> accepted. Tokens that start with "test_" connect successfully.
 */
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
    const name = payload.buyer.name.toLowerCase();
    const n = (this.tries.get(key) ?? 0) + 1;
    this.tries.set(key, n);

    if (name.includes('[auth]')) return { transport: 'error', retryable: false, httpStatus: 401, message: 'Authentication failed (simulated)' };
    if (name.includes('[down]')) return { transport: 'error', retryable: true, httpStatus: 503, message: 'FBR service unavailable (simulated)' };
    if (name.includes('[flaky]') && n < 3) return { transport: 'error', retryable: true, httpStatus: 504, message: 'Gateway timeout (simulated)' };
    if (name.includes('[reject]'))
      return {
        transport: 'ok', httpStatus: 200, accepted: false,
        errors: [{ code: '0052', field: 'buyer.ntn', message: 'Buyer NTN was not found in the register (simulated)' }],
        raw: { simulated: true, verdict: 'rejected' },
      };
    return {
      transport: 'ok', httpStatus: 200, accepted: true,
      fbrInvoiceNumber: `SIM-${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`,
      raw: { simulated: true, verdict: 'accepted' },
    };
  }
}

/**
 * TODO(spec): implement against the official FBR API once you have it:
 *   - base URLs (env.FBR_API_BASE_SANDBOX / env.FBR_API_BASE_PRODUCTION)
 *   - auth header, request/response schema, error codes
 *   - which responses are retryable (network errors, 5xx) vs final (4xx, business rejections)
 * Until then it fails safely and never sends anything.
 */
class HttpFbrClient implements FbrClient {
  async testConnection() {
    return { ok: false, message: 'The HTTP adapter is not implemented yet. Set FBR_ADAPTER=mock or add the FBR spec.' };
  }
  async submit(): Promise<FbrResult> {
    return { transport: 'error', retryable: false, message: 'The HTTP adapter is not implemented yet' };
  }
}

let client: FbrClient | undefined;
export const getFbrClient = (): FbrClient => (client ??= env.FBR_ADAPTER === 'http' ? new HttpFbrClient() : new MockFbrClient());