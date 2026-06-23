export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  event: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
