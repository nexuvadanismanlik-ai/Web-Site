import type { UserRole } from '@nexuva/types';

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PRODUCT_MANAGER: 'PRODUCT_MANAGER',
  CONTENT_EDITOR: 'CONTENT_EDITOR',
  VIEWER: 'VIEWER',
} as const satisfies Record<UserRole, UserRole>;

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  PRODUCT_MANAGER: 60,
  CONTENT_EDITOR: 40,
  VIEWER: 20,
};

export function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
