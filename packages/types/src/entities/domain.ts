import type { DomainType } from '../enums';

export interface Domain {
  id: string;
  tenantId: string;
  domainName: string;
  type: DomainType;
  isActive: boolean;
  redirectTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}
