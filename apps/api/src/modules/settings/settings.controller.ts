import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ─── Public route (no auth) ───────────────────────────────────────────────

  @Get('public/:tenantId')
  @Public()
  @ApiOperation({
    summary:
      'Get public settings for a tenant (no auth required). ' +
      'Returns only key + value for settings flagged isPublic=true. ' +
      'Private settings and deleted settings are never returned.',
  })
  getPublic(@Param('tenantId') tenantId: string) {
    return this.settingsService.getPublicSettings(tenantId);
  }

  // ─── Admin routes (require auth + ADMIN role) ─────────────────────────────

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'List settings. ADMIN sees only their company\'s tenant settings; SUPER_ADMIN sees all.',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.settingsService.findAll(user.role, user.companyId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a single setting (ownership-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.settingsService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Create a setting. Global settings (no tenantId) require SUPER_ADMIN. ' +
      'Value must match the declared type.',
  })
  create(@Body() dto: CreateSettingDto, @CurrentUser() user: AuthUser) {
    return this.settingsService.create(dto, user.id, user.role, user.companyId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Update a setting\'s value, type, description or public flag (ownership-checked; audit logged)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Soft delete a setting — SUPER_ADMIN only; audit logged',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.settingsService.remove(id, user.id, user.role, user.companyId);
  }
}
