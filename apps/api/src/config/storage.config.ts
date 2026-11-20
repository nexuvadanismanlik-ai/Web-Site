import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME ?? 'nexuva-os',
  publicUrl: process.env.R2_PUBLIC_URL,

  /**
   * This API's own public address.
   *
   * Needed only when files are held in the database: their address points back
   * here, and it has to be absolute because it is baked into a statically
   * exported website and into emails, neither of which can resolve a path
   * relative to the API.
   *
   * It used to fall back to the Render backend's address, which would have
   * kept minting links to a host that is being switched off. Now: the explicit
   * variable, else the Vercel project's production domain, else the local
   * development server.
   */
  apiPublicUrl: resolveApiPublicUrl(),
}));

function resolveApiPublicUrl(): string {
  const explicit = process.env.API_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}/${process.env.API_PREFIX ?? 'api/v1'}`;
  return `http://localhost:${process.env.PORT ?? '4000'}/${process.env.API_PREFIX ?? 'api/v1'}`;
}
