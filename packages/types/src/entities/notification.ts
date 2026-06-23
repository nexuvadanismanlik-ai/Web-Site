import type { NotificationType } from '../enums';

export interface Notification {
  id: string;
  userId: string;
  tenantId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}
