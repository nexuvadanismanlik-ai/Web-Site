import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { WebsiteTenantService } from '../website/website-tenant.service';
import { AnalyticsService } from './analytics.service';

export class CollectViewDto {
  @IsString() @MaxLength(200) path!: string;
  @IsOptional() @IsString() @MaxLength(300) referrer?: string;
  @IsOptional() @IsInt() @Min(0) @Max(86_400) durationSeconds?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) scrollDepth?: number;

  // Kept verbatim and length-capped rather than validated against a list: a
  // campaign name is whatever the advertiser typed.
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(160) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(160) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(160) utmTerm?: string;
}

export class CollectEventDto {
  @IsIn(['cta_click', 'form_start', 'form_submit'])
  name!: string;

  @IsString() @MaxLength(200) path!: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly tenants: WebsiteTenantService,
  ) {}

  /**
   * Receives a page view from the website.
   *
   * Public and unauthenticated, because the sender is a visitor's browser. It
   * answers 204 whatever happens: a measurement failure must never show up on
   * somebody's screen, and a tracker that reports errors to visitors is worse
   * than no tracker.
   */
  @Post('collect')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a page view. Public; sent by the website.' })
  @ApiQuery({ name: 'tenant', required: false })
  async collect(
    @Body() dto: CollectViewDto,
    @Req() req: FastifyRequest,
    @Query('tenant') tenant?: string,
  ): Promise<void> {
    try {
      const tenantId = await this.tenants.resolveTenantId(tenant);
      await this.analytics.recordView({
        tenantId,
        path: dto.path,
        ...(dto.referrer ? { referrer: dto.referrer } : {}),
        ip: req.ip ?? '',
        userAgent: readHeader(req, 'user-agent'),
        country: readHeader(req, 'cf-ipcountry'),
        ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
        ...(dto.scrollDepth !== undefined ? { scrollDepth: dto.scrollDepth } : {}),
        utm: {
          ...(dto.utmSource ? { source: dto.utmSource } : {}),
          ...(dto.utmMedium ? { medium: dto.utmMedium } : {}),
          ...(dto.utmCampaign ? { campaign: dto.utmCampaign } : {}),
          ...(dto.utmContent ? { content: dto.utmContent } : {}),
          ...(dto.utmTerm ? { term: dto.utmTerm } : {}),
        },
      });
    } catch {
      // Swallowed on purpose. See the note above.
    }
  }

  @Post('event')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record an interaction. Public; sent by the website.' })
  @ApiQuery({ name: 'tenant', required: false })
  async event(
    @Body() dto: CollectEventDto,
    @Req() req: FastifyRequest,
    @Query('tenant') tenant?: string,
  ): Promise<void> {
    try {
      const tenantId = await this.tenants.resolveTenantId(tenant);
      await this.analytics.recordEvent({
        tenantId,
        name: dto.name,
        path: dto.path,
        ...(dto.label ? { label: dto.label } : {}),
        ip: req.ip ?? '',
        userAgent: readHeader(req, 'user-agent'),
      });
    } catch {
      // Swallowed on purpose.
    }
  }

  /**
   * Deletes the measurement a verification run left behind.
   *
   * ADMIN, and refuses any campaign name that is not marked as test data — see
   * the service. Real analytics history is not deletable through the API at
   * all, which is the point.
   */
  @Delete('test-data')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove page views created by a verification run' })
  @ApiQuery({ name: 'campaign', required: true, description: 'Must start with zz-test-' })
  @ApiQuery({ name: 'tenant', required: false })
  async purgeTestData(
    @Query('campaign') campaign: string,
    @Query('tenant') tenant?: string,
  ) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    const deleted = await this.analytics.purgeTestViews(tenantId, campaign ?? '');
    return { deleted };
  }

  @Get('summary')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Traffic, sources, pages and conversions' })
  @ApiQuery({ name: 'tenant', required: false })
  async summary(@Query('tenant') tenant?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    return this.analytics.summary(tenantId);
  }
}

function readHeader(req: FastifyRequest, name: string): string {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}
