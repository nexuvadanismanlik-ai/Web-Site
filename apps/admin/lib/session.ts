import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * The signed-in admin, resolved once per request.
 *
 * `getServerSession` is not a cheap lookup. Every call decrypts the session
 * cookie, and — because NextAuth runs the `jwt` callback each time — every call
 * made while the access token is near expiry fires its own HTTP refresh, which
 * on the API side queries the live refresh tokens and argon2-verifies them one
 * by one. Argon2 is deliberately slow; that is the point of it.
 *
 * The panel was calling it about twenty-one times to render one dashboard: once
 * in the layout, once in each of the eight server actions the page awaits, and
 * once more inside every apiFetch those actions make. Under a Promise.all that
 * looks like eight parallel fetches and behaves like a queue, because the work
 * is CPU-bound and Node has one thread — which is exactly what the timings
 * said: the dashboard cost the *sum* of its calls, not the slowest of them.
 *
 * React's `cache` scopes the result to a single request, so a render resolves
 * the session once and at most one refresh is ever in flight. Nothing about the
 * session's freshness changes: the cache lives and dies with the request.
 */
export const getSession = cache(async () => getServerSession(authOptions));

/**
 * The backend access token for the current request.
 *
 * Shares the cached session above, so asking for it in ten places costs what
 * asking once costs.
 */
export const getAccessToken = cache(async (): Promise<string | null> => {
  const session = (await getSession()) as { accessToken?: string } | null;
  return session?.accessToken ?? null;
});
