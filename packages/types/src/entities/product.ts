import type { ProductStatus } from '../enums';

export interface Product {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
