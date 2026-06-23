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
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SeoService } from './seo.service';
import { UpsertSeoDto } from './dto/upsert-seo.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('seo')
@ApiBearerAuth()
@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get()
  @Roles('CONTENT_EDITOR')
  @ApiOperation({
    summary:
      'List all SEO records visible to the caller (SUPER_ADMIN sees all; others see their company\'s pages)',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.seoService.findAll(user.role, user.companyId);
  }

  @Get('page/:pageId')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Get SEO settings for a page (ownership-checked via Page → Tenant → Company)' })
  findByPage(@Param('pageId') pageId: string, @CurrentUser() user: AuthUser) {
    return this.seoService.findByPage(pageId, user.role, user.companyId);
  }

  @Get('page/:pageId/public')
  @Public()
  @ApiOperation({
    summary:
      'Get SEO metadata for a published page — no auth required. Used by SSR middleware for <head> population.',
  })
  findByPagePublic(@Param('pageId') pageId: string) {
    return this.seoService.findByPagePublic(pageId);
  }

  @Put('page/:pageId')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Create or update SEO settings for a page (partial update; ownership-checked; audit logged)',
  })
  upsert(
    @Param('pageId') pageId: string,
    @Body() dto: UpsertSeoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.seoService.upsert(pageId, dto, user.id, user.role, user.companyId);
  }

  @Delete('page/:pageId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Remove SEO settings for a page (reset to no metadata; ownership-checked; audit logged)',
  })
  remove(@Param('pageId') pageId: string, @CurrentUser() user: AuthUser) {
    return this.seoService.remove(pageId, user.id, user.role, user.companyId);
  }
}
