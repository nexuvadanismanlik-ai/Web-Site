import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'admin@nexuva.com';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'nexuva123';
const ADMIN_NAME = process.env['ADMIN_NAME'] ?? 'Nexuva Admin';

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
        if (!credentials) return null;
        const emailOk = credentials.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const passOk = credentials.password === ADMIN_PASSWORD;
        if (emailOk && passOk) {
          return { id: '1', email: ADMIN_EMAIL, name: ADMIN_NAME };
        }
        return null;
      },
    }),
  ],
  secret:
    process.env.NEXTAUTH_SECRET ?? 'nexuva-admin-dev-secret-please-change-0123456789abcdef',
};
