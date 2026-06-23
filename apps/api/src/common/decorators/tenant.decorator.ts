import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TenantContext } from '@nexuva/types';

export const TENANT_CONTEXT_KEY = 'tenantContext';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ tenantContext?: TenantContext }>();
    return request.tenantContext;
  },
);
