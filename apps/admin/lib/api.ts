import type { ApiErrorCode } from '@nexuva/types';
import { getAccessToken } from './session';
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
const WAKE_TIMEOUT_MS = 75_000;

/**
 * How long a request is given once the service is known to be awake.
 *
 * A warm call to this API answers in under 400ms; measured, the slowest
 * endpoint the panel uses has a median of 412ms. So eight seconds is not a
 * tight budget — it is "something is wrong" territory, and failing there is
 * better than holding the screen for over a minute on a request that is not
 * coming back.
 */
const WARM_TIMEOUT_MS = 8_000;

/**
 * Whether the service has answered recently enough to assume it is still up.
 *
 * Render suspends the API when it is idle, and waking it costs about 70
 * seconds — measured, not estimated. That has to be waited out, or the panel
 * turns a cold start into a failed page. But it must be waited out *once*: the
 * old code gave every request 75 seconds and retried it, so a single call
 * could hold a page for two and a half minutes long after the reason had
 * passed.
 */
let lastSuccessAt = 0;
const ASSUME_WARM_FOR_MS = 5 * 60_000;

async function fetchWithWakeRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    // Generous on the first attempt after a quiet spell — that is the one that
    // might be paying for a cold start. Short once we know the service is up,
    // and short on the retry either way: by then the wake-up has happened.
    const warm = Date.now() - lastSuccessAt < ASSUME_WARM_FOR_MS;
    const budget = attempt === 0 && !warm ? WAKE_TIMEOUT_MS : WARM_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      lastSuccessAt = Date.now();
      return res;
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
async function requireAccessToken(): Promise<string> {
  const token = await getAccessToken();
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
  //
  // FormData is the exception: its content type carries a generated boundary,
  // so it has to be left for fetch to set. Declaring JSON over it makes the
  // multipart parser find no file.
  const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData;
  if (rest.body !== undefined && rest.body !== null && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) headers['Authorization'] = `Bearer ${await requireAccessToken()}`;

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
