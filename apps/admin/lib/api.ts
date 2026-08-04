import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    // Admin views must always reflect the current database state.
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body?.message) {
        detail = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // Response had no JSON body; the status text is the best available detail.
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
