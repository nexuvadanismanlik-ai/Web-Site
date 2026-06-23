import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { ToggleFlagDto } from './dto/toggle-flag.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  // ─── Admin routes (require auth + ADMIN role) ─────────────────────────────

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'List feature flags. ADMIN sees only their company\'s flags; SUPER_ADMIN sees all (including global).',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.featureFlagsService.findAll(user.role, user.companyId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a single feature flag (ownership-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.featureFlagsService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a feature flag. Global flags (no tenantId) require SUPER_ADMIN.' })
  create(@Body() dto: CreateFeatureFlagDto, @CurrentUser() user: AuthUser) {
    return this.featureFlagsService.create(dto, user.id, user.role, user.companyId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update flag name, description or config (ownership-checked; audit logged)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.featureFlagsService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable a feature flag (idempotent; ownership-checked; audit logged)' })
  toggle(
    @Param('id') id: string,
    @Body() dto: ToggleFlagDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.featureFlagsService.toggle(id, dto.isEnabled, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete a feature flag — SUPER_ADMIN only; disables flag before deletion; audit logged' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.featureFlagsService.softDelete(id, user.id, user.role, user.companyId);
  }

  // ─── System / public check route ──────────────────────────────────────────

  @Get('check/:tenantId/:key')
  @Public()
  @ApiOperation({
    summary:
      'Check whether a feature is enabled for a tenant (public; no config exposed). ' +
      'Tenant-specific flag takes precedence over global flag.',
  })
  async isEnabled(
    @Param('tenantId') tenantId: string,
    @Param('key') key: string,
  ): Promise<{ enabled: boolean }> {
    const enabled = await this.featureFlagsService.isFeatureEnabled(tenantId, key);
    return { enabled };
  }
}
