import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@nexuva/types';
import { hasRoleOrHigher } from '@nexuva/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Fails closed. This used to return true, so a handler that was simply
    // missing its decorator became reachable by every authenticated user, and
    // nothing anywhere said so. Now the omission is refused and named.
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} declares no access level. ` +
          'Add @Roles(...), @AnyAuthenticated() or @Public().',
      );
      throw new ForbiddenException('Access denied');
    }

    const { user } = context.switchToHttp().getRequest<{ user: { role: UserRole } }>();

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const hasAccess = requiredRoles.some((role) => hasRoleOrHigher(user.role, role));

    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
