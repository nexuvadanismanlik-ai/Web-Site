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
   * Falls back to the deployed backend so a fresh install serves working links
   * without one more variable to set; override it the moment the API moves.
   */
  apiPublicUrl: (
    process.env.API_PUBLIC_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
  ).replace(/\/+$/, ''),
}));
