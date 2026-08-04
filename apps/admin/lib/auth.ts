import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
 * Credentials are verified by the Nexuva API, not by this app: the panel holds
 * no user store of its own. The backend's access token is carried on the
 * NextAuth JWT so server actions can call the API on the user's behalf.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email.trim().toLowerCase(),
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = (await res.json()) as BackendLoginResponse;
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
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          role?: string;
          accessToken?: string;
          refreshToken?: string;
        };
        token['role'] = u.role;
        token['accessToken'] = u.accessToken;
        token['refreshToken'] = u.refreshToken;
      }
      return token;
    },
    session({ session, token }) {
      // Widened to optional fields; assigned via index access so
      // exactOptionalPropertyTypes does not reject a possibly-undefined value.
      const s = session as typeof session & Record<string, unknown>;
      s['accessToken'] = token['accessToken'];
      s['role'] = token['role'];
      return s;
    },
  },
  secret:
    process.env.NEXTAUTH_SECRET ?? 'nexuva-admin-dev-secret-please-change-0123456789abcdef',
};
