import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VersioningService } from './versioning.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { RollbackDto } from './dto/rollback.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('versioning')
@ApiBearerAuth()
@Controller()
export class VersioningController {
  constructor(private readonly versioningService: VersioningService) {}

  // ─── Per-page version routes (/pages/:pageId/versions) ───────────────────

  @Get('pages/:pageId/versions')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'List version history for a page (ownership-checked; newest first)' })
  getVersions(@Param('pageId') pageId: string, @CurrentUser() user: AuthUser) {
    return this.versioningService.getVersions(pageId, user.role, user.companyId);
  }

  @Post('pages/:pageId/versions')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Manually create a version snapshot for a page (audit logged)' })
  createVersion(
    @Param('pageId') pageId: string,
    @Body() _dto: CreateVersionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versioningService.createVersion(pageId, user.id, user.role, user.companyId);
  }

  @Post('pages/:pageId/rollback')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Roll back page content to a prior version. Creates a new version from the target snapshot — history is never modified.',
  })
  rollback(
    @Param('pageId') pageId: string,
    @Body() dto: RollbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versioningService.rollback(pageId, dto.versionId, user.id, user.role, user.companyId);
  }

  @Post('pages/:pageId/restore')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Restore a page fully from a prior version snapshot, including SEO data. Creates a new version after restore.',
  })
  restore(
    @Param('pageId') pageId: string,
    @Body() dto: RollbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.versioningService.restore(pageId, dto.versionId, user.id, user.role, user.companyId);
  }

  // ─── Individual version routes (/versions/:id) ────────────────────────────

  @Get('versions/:id')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Get a single version with full snapshot (ownership-checked)' })
  getVersion(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.versioningService.getVersion(id, user.role, user.companyId);
  }

  @Delete('versions/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Permanently delete a version record — SUPER_ADMIN only; irreversible; audit logged' })
  deleteVersion(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.versioningService.deleteVersion(id, user.id, user.role);
  }
}
