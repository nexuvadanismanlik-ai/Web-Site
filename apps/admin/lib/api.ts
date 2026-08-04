import { getServerSession } from 'next-auth';
import type { ApiErrorCode } from '@nexuva/types';
import { authOptions } from './auth';
import { unwrap } from './envelope';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Stable reason from the API. Branch on this, not on the message text. */
    readonly code?: ApiErrorCode,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The API may be on a plan that suspends it when idle, in which case the first
 * request after a quiet spell pays the wake-up cost — around a minute. A short
 * default timeout would turn that into a failed page load, so requests are given
 * room and retried once: a cold start looks exactly like a network error, and
 * by the second attempt the service is usually up.
 */
const REQUEST_TIMEOUT_MS = 75_000;

async function fetchWithWakeRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new ApiError(
    `API'ye ulaşılamadı (${url}). Servis uyanıyor olabilir, birkaç saniye sonra tekrar deneyin. ` +
      `(${lastError instanceof Error ? lastError.message : String(lastError)})`,
    503,
  );
}

/** Access token issued by the backend at login, carried on the NextAuth JWT. */
async function getAccessToken(): Promise<string> {
  const session = (await getServerSession(authOptions)) as
    | { accessToken?: string }
    | null;
  const token = session?.accessToken;
  if (!token) {
    throw new ApiError('Not authenticated — sign in again', 401);
  }
  return token;
}

/**
 * Server-side call to the Nexuva API, authenticated as the signed-in admin.
 * Only usable from server components and server actions — it reads the session
 * from cookies and must never run in the browser.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...rest } = init;
  const headers: Record<string, string> = {
    ...((rest.headers as Record<string, string>) ?? {}),
  };

  // Only declare a JSON body when there is one. Fastify rejects a request that
  // announces application/json and then sends nothing, which surfaced as a 500
  // on the bodyless POST /website/publish.
  if (rest.body !== undefined && rest.body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) headers['Authorization'] = `Bearer ${await getAccessToken()}`;

  const res = await fetchWithWakeRetry(`${API_BASE}${path}`, {
    ...rest,
    headers,
    // Admin views must always reflect the current database state.
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = res.statusText;
    let code: ApiErrorCode | undefined;
    try {
      const body = (await res.json()) as {
        message?: string | string[];
        errorCode?: ApiErrorCode;
      };
      if (body?.message) {
        detail = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
      code = body?.errorCode;
    } catch {
      // Response had no JSON body; the status text is the best available detail.
    }
    throw new ApiError(detail, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return unwrap<T>(await res.json());
}
