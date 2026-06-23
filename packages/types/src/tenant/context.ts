import type { TenantContext } from '../entities/tenant';

export type { TenantContext };

export interface TenantResolutionResult {
  found: boolean;
  context: TenantContext | null;
}
