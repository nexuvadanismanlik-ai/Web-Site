import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SiteContentService } from './site-content.service';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { COLLECTION_SLUGS, SECTION_KEYS } from './collections';

@ApiTags('website-content')
@Controller('website')
export class SiteContentController {
  constructor(private readonly siteContent: SiteContentService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Get('content')
  @Public()
  @ApiOperation({
    summary:
      'Full site content document consumed by the public website at build time. ' +
      'No auth required; returns only active, non-deleted content.',
  })
  @ApiQuery({ name: 'tenant', required: false, description: 'Tenant slug (defaults to WEBSITE_TENANT_SLUG)' })
  getContent(@Query('tenant') tenant?: string) {
    return this.siteContent.getSiteContent(tenant);
  }

  // ─── Sections (singleton JSON blocks) ─────────────────────────────────────

  @Get('sections')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: `List all content sections. Keys: ${SECTION_KEYS.join(', ')}` })
  listSections(@Query('tenant') tenant?: string) {
    return this.siteContent.listSections(tenant);
  }

  @Get('sections/:key')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one content section' })
  getSection(@Param('key') key: string, @Query('tenant') tenant?: string) {
    return this.siteContent.getSection(key, tenant);
  }

  @Put('sections/:key')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace a section payload (created when absent)' })
  upsertSection(
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
    @Query('tenant') tenant?: string,
  ) {
    return this.siteContent.upsertSection(key, body, tenant);
  }

  // ─── Collections (ordered lists) ──────────────────────────────────────────

  @Get('collections/:slug')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: `List collection items. Slugs: ${COLLECTION_SLUGS.join(', ')}` })
  listItems(@Param('slug') slug: string, @Query('tenant') tenant?: string) {
    return this.siteContent.listItems(slug, tenant);
  }

  @Post('collections/:slug')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a collection item (appended to the end)' })
  createItem(
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
    @Query('tenant') tenant?: string,
  ) {
    return this.siteContent.createItem(slug, body, tenant);
  }

  @Put('collections/:slug')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Replace an entire collection with the posted array. Positions follow ' +
      'array order. Used by the admin editors, which save whole lists.',
  })
  replaceCollection(
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>[],
    @Query('tenant') tenant?: string,
  ) {
    return this.siteContent.replaceCollection(slug, body, tenant);
  }

  // Declared before :id so "reorder" is not captured as an item id.
  @Patch('collections/:slug/reorder')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder a collection; position follows array index' })
  reorder(
    @Param('slug') slug: string,
    @Body() dto: ReorderItemsDto,
    @Query('tenant') tenant?: string,
  ) {
    return this.siteContent.reorderItems(slug, dto.ids, tenant);
  }

  @Patch('collections/:slug/:id')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a collection item (partial)' })
  updateItem(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Query('tenant') tenant?: string,
  ) {
    return this.siteContent.updateItem(slug, id, body, tenant);
  }

  @Delete('collections/:slug/:id')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a collection item (soft delete where supported)' })
  removeItem(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.siteContent.removeItem(slug, id, tenant);
  }
}
