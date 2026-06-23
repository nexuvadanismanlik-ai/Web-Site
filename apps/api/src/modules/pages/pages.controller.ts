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
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('pages')
@ApiBearerAuth()
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'List pages for a tenant (ownership-checked)' })
  findByTenant(@Query('tenantId') tenantId: string, @CurrentUser() user: AuthUser) {
    return this.pagesService.findByTenant(tenantId, user.role, user.companyId);
  }

  @Get('public/:tenantId/:locale/:slug')
  @Public()
  @ApiOperation({ summary: 'Get published page for public rendering (no auth)' })
  findPublic(
    @Param('tenantId') tenantId: string,
    @Param('slug') slug: string,
    @Param('locale') locale: string,
  ) {
    return this.pagesService.findBySlug(tenantId, slug, locale);
  }

  @Get(':id')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Get page with blocks, SEO and recent versions (ownership-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pagesService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Create page (starts as DRAFT; caller must own the tenant; audit logged)' })
  create(@Body() dto: CreatePageDto, @CurrentUser() user: AuthUser) {
    return this.pagesService.create(dto, user.id, user.role, user.companyId);
  }

  @Patch(':id')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Update page title (snapshots current state as a version first; audit logged)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pagesService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Post(':id/publish')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish page (DRAFT → PUBLISHED; snapshots state; audit logged)' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pagesService.publish(id, user.id, user.role, user.companyId);
  }

  @Post(':id/unpublish')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish page (PUBLISHED → DRAFT; snapshots state; audit logged)' })
  unpublish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pagesService.unpublish(id, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft delete page (ownership-checked; audit logged)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pagesService.softDelete(id, user.id, user.role, user.companyId);
  }
}
