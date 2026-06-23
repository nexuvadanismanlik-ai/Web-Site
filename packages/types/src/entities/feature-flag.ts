export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tenantId: string | null;
  isEnabled: boolean;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
