import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '4000', 10),
  prefix: process.env.API_PREFIX ?? 'api/v1',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001',
  // Tenant whose website content is served when a request does not name one.
  // Single-site deployments never need to pass a tenant.
  websiteTenantSlug: process.env.WEBSITE_TENANT_SLUG ?? 'nexuva',
}));
