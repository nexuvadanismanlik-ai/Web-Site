import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BrandingService } from './branding.service';
import { UpsertBrandingDto } from './dto/upsert-branding.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('branding')
@ApiBearerAuth()
@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  @Roles('PRODUCT_MANAGER')
  @ApiOperation({
    summary:
      'List all branding records visible to the caller (SUPER_ADMIN sees all; others see their company\'s tenants)',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.brandingService.findAll(user.role, user.companyId);
  }

  @Get('tenant/:tenantId')
  @Roles('PRODUCT_MANAGER')
  @ApiOperation({ summary: 'Get branding config for a tenant (ownership-checked)' })
  findByTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.brandingService.findByTenant(tenantId, user.role, user.companyId);
  }

  @Put('tenant/:tenantId')
  @Roles('PRODUCT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Create or update branding for a tenant (ownership-checked; only supplied fields updated; audit logged)',
  })
  upsert(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertBrandingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brandingService.upsert(tenantId, dto, user.id, user.role, user.companyId);
  }

  @Delete('tenant/:tenantId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reset tenant branding to platform defaults — removes the branding record (ownership-checked; audit logged)',
  })
  reset(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.brandingService.reset(tenantId, user.id, user.role, user.companyId);
  }
}
