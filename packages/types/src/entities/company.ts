import type { CompanyType } from '../enums';

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  type: CompanyType;
  legalName: string | null;
  taxId: string | null;
  description: string | null;
  parentId: string | null;
  parent: Company | null;
  subsidiaries: Company[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
