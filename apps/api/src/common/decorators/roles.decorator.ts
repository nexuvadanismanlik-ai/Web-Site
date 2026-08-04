import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@nexuva/types';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Any signed-in user, whatever their role — for routes scoped to the caller's
 * own data (their profile, their notifications).
 *
 * States what an undecorated handler used to mean by accident. RolesGuard now
 * refuses routes carrying neither this, an explicit @Roles, nor @Public, so a
 * forgotten decorator fails loudly instead of quietly admitting everyone.
 * VIEWER is the floor of ROLE_HIERARCHY, so this excludes nobody.
 */
export const AnyAuthenticated = () => Roles('VIEWER');
