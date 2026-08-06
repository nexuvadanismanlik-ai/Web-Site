import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { WebsiteTenantService } from '../website/website-tenant.service';
import { EmailService, formatFrom } from './email.service';
import { MailSettingsService } from './mail-settings.service';
import {
  MailTemplateService,
  TEMPLATE_VARIABLES,
  fillTemplate,
  renderEmailHtml,
} from './mail-template.service';
import { PrismaService } from '../../prisma/prisma.service';

export class SaveMailSettingsDto {
  @IsIn(['resend', 'smtp', 'sendgrid'])
  provider!: string;

  @IsEmail()
  fromEmail!: string;

  @IsString()
  @MaxLength(80)
  fromName!: string;

  @IsOptional() @IsString() @MaxLength(160) replyTo?: string;
  @IsOptional() @IsString() @MaxLength(500) notifyTo?: string;

  /** Empty means "keep the stored one" — the panel never receives it back. */
  @IsOptional() @IsString() @MaxLength(300) apiKey?: string;

  @IsOptional() @IsString() @MaxLength(200) smtpHost?: string;
  @IsOptional() @IsInt() @Min(1) smtpPort?: number;
  @IsOptional() @IsString() @MaxLength(200) smtpUser?: string;
  @IsOptional() @IsString() @MaxLength(300) smtpPassword?: string;
  @IsOptional() @IsBoolean() smtpSecure?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class SendTestDto {
  @IsEmail()
  to!: string;

  /** Which template to send. Omitted sends a plain check message. */
  @IsOptional() @IsString() @MaxLength(60) templateKey?: string;
}

/** Stand-in values, so a preview and a test look like a real message. */
const SAMPLE = {
  ad: 'Ayşe Yılmaz',
  firma: 'Örnek Teknoloji A.Ş.',
  eposta: 'ayse@ornek.com',
  telefon: '+90 555 000 00 00',
  hizmet: 'SEO',
  butce: '25.000 - 50.000 TL',
  talep_no: '1042',
  mesaj: 'Merhaba, web sitemizin arama sonuçlarındaki görünürlüğünü artırmak istiyoruz.',
};

@ApiTags('mail')
@ApiBearerAuth()
@Controller('mail')
export class MailController {
  constructor(
    private readonly settings: MailSettingsService,
    private readonly templates: MailTemplateService,
    private readonly email: EmailService,
    private readonly tenants: WebsiteTenantService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mail configuration, with secrets masked' })
  @ApiQuery({ name: 'tenant', required: false })
  async readSettings(@Query('tenant') tenant?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    return this.settings.readForPanel(tenantId);
  }

  @Put('settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Save mail configuration' })
  @ApiQuery({ name: 'tenant', required: false })
  async saveSettings(@Body() dto: SaveMailSettingsDto, @Query('tenant') tenant?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    return this.settings.save(tenantId, dto);
  }

  /**
   * Sends a real message to a real address.
   *
   * The only way to know a mail configuration works. A provider that accepts
   * the credentials can still refuse to send — an unverified sender domain is
   * the usual reason — and that only shows up on an actual send.
   */
  @Post('test')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Send a test message and report what the provider said' })
  @ApiQuery({ name: 'tenant', required: false })
  async sendTest(@Body() dto: SendTestDto, @Query('tenant') tenant?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    const rendered = await this.render(tenantId, dto.templateKey);

    const outcome = await this.email.trySend({
      tenantId,
      to: dto.to,
      subject: dto.templateKey ? rendered.subject : `Test — ${rendered.brandName}`,
      html: rendered.html,
      templateKey: dto.templateKey ?? 'test',
    });

    await this.settings.recordTest(tenantId, outcome.ok, outcome.detail);
    return outcome;
  }

  @Get('templates')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editable message templates and the variables they accept' })
  @ApiQuery({ name: 'tenant', required: false })
  async listTemplates(@Query('tenant') tenant?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    const templates = await this.templates.list(tenantId);
    return { templates, variables: TEMPLATE_VARIABLES };
  }

  @Put('templates/:key')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Edit one template' })
  @ApiQuery({ name: 'tenant', required: false })
  async updateTemplate(
    @Param('key') key: string,
    @Body() dto: UpdateTemplateDto,
    @Query('tenant') tenant?: string,
  ) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    return this.templates.update(tenantId, key, dto);
  }

  /** The finished message, with sample values, exactly as it would arrive. */
  @Get('templates/:key/preview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Render a template with sample values' })
  @ApiQuery({ name: 'tenant', required: false })
  async previewTemplate(@Param('key') key: string, @Query('tenant') tenant?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    const rendered = await this.render(tenantId, key);
    return { subject: rendered.subject, html: rendered.html };
  }

  @Get('logs')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Recent delivery attempts' })
  @ApiQuery({ name: 'tenant', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async logs(@Query('tenant') tenant?: string, @Query('limit') limitRaw?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenant);
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 200);

    const [items, failed] = await Promise.all([
      this.prisma.mailLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.mailLog.count({ where: { tenantId, status: 'FAILED' } }),
    ]);

    return { items, failed };
  }

  /**
   * Builds a message the way a send would, including the branded shell.
   *
   * Shared by the preview and the test so that what is previewed is what is
   * sent — a preview rendered by different code is a preview of nothing.
   */
  private async render(tenantId: string, templateKey?: string) {
    const [brandRow, seoRow] = await Promise.all([
      this.prisma.websiteSection.findUnique({
        where: { tenantId_key: { tenantId, key: 'brand' } },
        select: { data: true },
      }),
      this.prisma.websiteSection.findUnique({
        where: { tenantId_key: { tenantId, key: 'seo' } },
        select: { data: true },
      }),
    ]);

    const brand = (brandRow?.data ?? {}) as {
      siteName?: string;
      primaryColor?: string;
      logoUrl?: string;
    };
    const seo = (seoRow?.data ?? {}) as { canonical?: string };

    const brandName = brand.siteName || 'Nexuva';
    const values = { ...SAMPLE, firma_adi: brandName, site_adresi: seo.canonical ?? '' };

    let subject = `Test — ${brandName}`;
    let body =
      'Bu bir test mesajıdır. Bunu okuyabiliyorsanız mail ayarlarınız çalışıyor demektir.';

    if (templateKey) {
      const template = await this.templates.findByKey(tenantId, templateKey);
      subject = fillTemplate(template.subject, values);
      body = fillTemplate(template.body, values);
    }

    return {
      brandName,
      subject,
      html: renderEmailHtml({
        body,
        brandName,
        brandColor: brand.primaryColor || '#6366f1',
        logoUrl: brand.logoUrl ?? null,
        siteUrl: seo.canonical ?? null,
      }),
    };
  }
}

// Re-exported so the contact flow can address the sender the same way.
export { formatFrom };
