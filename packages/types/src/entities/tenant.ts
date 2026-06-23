import type { TenantType } from '../enums';
import type { Branding } from './branding';
import type { Domain } from './domain';

export interface Tenant {
  id: string;
  slug: string;
  type: TenantType;
  name: string;
  description: string | null;
  isActive: boolean;
  domains: Domain[];
  branding: Branding | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TenantContext {
  tenantId: string;
  slug: string;
  type: TenantType;
  name: string;
  primaryDomain: string;
  branding: Branding | null;
  locale: string;
  featureFlags: Record<string, boolean>;
  /** Populated only for REDIRECT-type domains. Middleware issues 301 and stops. */
  redirectTo?: string;
}
