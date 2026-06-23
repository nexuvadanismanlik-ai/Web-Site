export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  isPublic: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
