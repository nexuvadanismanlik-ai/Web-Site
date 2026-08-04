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
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
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

        // The API may suspend when idle; the first sign-in after a quiet spell
        // pays a wake-up of roughly a minute. Given room and one retry, so a
        // cold service reads as a slow login rather than a wrong password.
        const attempt = async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 75_000);
          try {
            return await fetch(`${API_BASE}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: credentials.email.trim().toLowerCase(),
                password: credentials.password,
              }),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timer);
          }
        };

        try {
          let res: Response;
          try {
            res = await attempt();
          } catch {
            res = await attempt();
          }

          if (!res.ok) return null;

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
        } catch {
          // Network failure reaching the API — treated as a failed login so the
          // form shows the standard error rather than a stack trace.
          return null;
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
