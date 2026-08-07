import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { adminPath } from './routes';
import { sessionSecret } from './session-secret';
import { unwrap } from './envelope';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

interface BackendLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
}

/**
 * Reads the `exp` claim so the session knows when its access token dies.
 * Falls back to ten minutes out if the token cannot be parsed, which makes the
 * next request refresh rather than fail.
 */
function accessTokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return Date.now() + 10 * 60_000;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : Date.now() + 10 * 60_000;
  } catch {
    return Date.now() + 10 * 60_000;
  }
}

/** Refreshed this long before expiry, so a request never races the deadline. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * How long a session refresh may take before it is abandoned.
 *
 * Deliberately short. This runs inside the jwt callback, which NextAuth
 * invokes on every getServerSession — so it is in the path of every page the
 * panel renders, and anything slow here is a slow panel. A warm refresh
 * measures about 1.5 seconds.
 */
const REFRESH_TIMEOUT_MS = 10_000;

/**
 * How long a sign-in may take.
 *
 * Long, because it genuinely can be: the API suspends when idle and a wake-up
 * costs about seventy seconds — measured, not guessed — and a sign-in that
 * gave up before then would make a cold service look like a wrong password.
 *
 * But bounded, and tried once. The old code allowed seventy-five seconds and
 * then retried, so a sign-in against an unreachable service could hold the
 * form for two and a half minutes. Nobody waits that long without concluding
 * the thing is broken.
 */
const SIGN_IN_TIMEOUT_MS = 80_000;

/**
 * Exchanges the refresh token for a new pair.
 *
 * The backend's access tokens last 15 minutes while this session lasts for
 * weeks; without this the panel started returning Unauthorized a quarter of an
 * hour after signing in, which is exactly what happened in production.
 */
async function refreshAccessToken(token: Record<string, unknown>): Promise<Record<string, unknown>> {
  const refreshToken = token['refreshToken'];
  if (typeof refreshToken !== 'string') {
    return { ...token, error: 'NoRefreshToken' };
  }

  try {
    // Bounded, and this is the important part.
    //
    // NextAuth runs the jwt callback on every getServerSession, so this fetch
    // sits in the path of every page the panel renders. It had no timeout at
    // all: Node's default lets a request hang for five minutes, so opening the
    // panel while the API was asleep produced a blank screen for minutes with
    // nothing to click and nothing to read. That is the "sonsuz yükleniyor".
    //
    // Ten seconds is long for a warm service — measured, this endpoint answers
    // in about 1.5s — and far too short for a cold start, which is deliberate.
    // A page load must not wait out a wake-up; failing here leaves the existing
    // token in place and the next request tries again.
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });

    if (!res.ok) return { ...token, error: 'RefreshFailed' };

    const data = unwrap<{ accessToken: string; refreshToken: string }>(await res.json());
    return {
      ...token,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpires: accessTokenExpiry(data.accessToken),
      error: undefined,
    };
  } catch {
    // Network failure, most likely the API waking up. Left unchanged so the
    // next request retries instead of dropping the session.
    return token;
  }
}

/**
 * Credentials are verified by the Nexuva API, not by this app: the panel holds
 * no user store of its own. The backend's access token is carried on the
 * NextAuth JWT so server actions can call the API on the user's behalf.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: adminPath('/login') },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        // One attempt, generously bounded. The API suspends when idle and a
        // wake-up costs about seventy seconds, so the budget has to cover that
        // or a cold service reads as a wrong password. It must not be doubled
        // by a retry: that turned an unreachable API into a two-and-a-half
        // minute wait on a form that showed nothing but a spinner.
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email.trim().toLowerCase(),
              password: credentials.password,
            }),
            signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS),
          });

          // 401 is the only answer that means the credentials are wrong.
          // Everything else is the service having a problem, and saying
          // "check your password" to somebody whose password is fine is how
          // an evening gets lost. The thrown message reaches the form.
          if (res.status === 401) return null;
          if (res.status === 429) throw new Error('TooManyAttempts');
          if (!res.ok) throw new Error('ApiError');

          const data = unwrap<BackendLoginResponse>(await res.json());
          const name = [data.user.firstName, data.user.lastName].filter(Boolean).join(' ');

          return {
            id: data.user.id,
            email: data.user.email,
            name: name || data.user.email,
            role: data.user.role,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          };
        } catch (err) {
          // Rethrown as a code the form can turn into a sentence. A timeout is
          // a sleeping service; anything else at this level never reached it.
          if (err instanceof Error && (err.message === 'TooManyAttempts' || err.message === 'ApiError')) {
            throw err;
          }
          const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
          throw new Error(timedOut ? 'ApiTimeout' : 'ApiUnreachable');
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Sign-in: seed the token from the backend's response.
      if (user) {
        const u = user as unknown as {
          role?: string;
          accessToken?: string;
          refreshToken?: string;
        };
        return {
          ...token,
          role: u.role,
          accessToken: u.accessToken,
          refreshToken: u.refreshToken,
          accessTokenExpires: u.accessToken ? accessTokenExpiry(u.accessToken) : 0,
        };
      }

      const expires = token['accessTokenExpires'];
      const stillValid =
        typeof expires === 'number' && Date.now() < expires - REFRESH_MARGIN_MS;
      if (stillValid) return token;

      return refreshAccessToken(token as Record<string, unknown>);
    },
    session({ session, token }) {
      // Widened to optional fields; assigned via index access so
      // exactOptionalPropertyTypes does not reject a possibly-undefined value.
      const s = session as typeof session & Record<string, unknown>;
      s['accessToken'] = token['accessToken'];
      s['role'] = token['role'];
      // Surfaced so the UI can tell a dead session from a failed request.
      s['error'] = token['error'];
      return s;
    },
  },
  secret: sessionSecret(),
};
