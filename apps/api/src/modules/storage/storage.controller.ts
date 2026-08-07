import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Param,
  Patch,
  Body,
  BadRequestException,
  ConflictException,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { StorageService } from './storage.service';
import { MediaUsageService } from './media-usage.service';
import { WebsiteTenantService } from '../website/website-tenant.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NoEnvelope, ResponseMessage } from '../../common/decorators/response.decorator';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { UserRole } from '@nexuva/types';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);

// Allowlist prevents path traversal via folder name
const ALLOWED_FOLDERS = new Set(['images', 'documents', 'logos', 'uploads', 'attachments']);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** What may be changed about a stored file. Both are labels, not addresses. */
export class UpdateFileDto {
  @IsOptional() @IsString() @MaxLength(200) filename?: string;
  @IsOptional() @IsString() @MaxLength(40) folder?: string;
}

interface AuthUser {
  id: string;
  role: UserRole;
  companyId: string | null;
}

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly mediaUsage: MediaUsageService,
    private readonly tenants: WebsiteTenantService,
  ) {}

  /**
   * Upload a file to Cloudflare R2 for a specific tenant.
   * Validates tenant ownership, MIME type, and file size before persisting.
   * Creates a DB record (StorageFile) and emits a CREATE_FILE audit event.
   */
  @Post('upload')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Upload a file to R2 storage for a tenant' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'tenantId', required: true, description: 'Target tenant ID' })
  @ApiQuery({ name: 'folder', required: false, example: 'images', description: 'Storage folder (images | documents | logos | uploads | attachments)' })
  @ApiQuery({ name: 'tenant', required: false, description: 'Tenant slug, as an alternative to tenantId' })
  async upload(
    @Req() req: FastifyRequest,
    @Query('folder') folder = 'uploads',
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantIdParam?: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    const tenantId = await this.resolveTenant(tenantIdParam, tenantSlug);

    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new BadRequestException(
        `Invalid folder "${folder}". Allowed values: ${[...ALLOWED_FOLDERS].join(', ')}`,
      );
    }

    if (!req.isMultipart()) {
      throw new BadRequestException('Request must use Content-Type: multipart/form-data');
    }

    const part = await req.file();
    if (!part) throw new BadRequestException('No file part found in the request');

    const { mimetype, filename } = part;

    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
      throw new BadRequestException(
        `MIME type "${mimetype}" is not allowed. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of part.file) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`,
        );
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    const file = await this.storageService.uploadFile({
      tenantId,
      uploadedById: user.id,
      actorRole: user.role,
      actorCompanyId: user.companyId,
      folder,
      buffer,
      mimeType: mimetype,
      filename,
    });

    return file;
  }

  /**
   * Serves a file whose bytes live in the database.
   *
   * Public, and it has to be: these are logos, favicons and share images that
   * appear on a public website and in link previews. A browser fetching them
   * carries no token, and neither does Facebook's crawler.
   *
   * Only files stored in the database are served here — when object storage is
   * configured the address points at the CDN instead and this route is never
   * reached.
   */
  @Get('file/:id')
  @Public()
  @NoEnvelope()
  @ApiOperation({ summary: 'Serve a database-held file. Public.' })
  async serveFile(@Param('id') id: string, @Res() reply: FastifyReply) {
    const file = await this.storageService.readBlob(id);
    void reply
      .header('Content-Type', file.mimeType)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`)
      // Immutable: the address contains a record id that is never reused, so a
      // cached copy can never be the wrong file. Uploading a replacement
      // produces a new id and therefore a new address.
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(file.data);
  }

  /**
   * List active (non-deleted) files for a tenant, paginated and
   * ownership-checked, with the tenant's total usage.
   */
  @Get('files')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'List files for a tenant (paginated, ownership-checked)' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'usage', required: false, description: 'true to include where each file is used (costs extra queries)' })
  @ApiQuery({ name: 'tenant', required: false, description: 'Tenant slug, as an alternative to tenantId' })
  async listFiles(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantIdParam?: string,
    @Query('tenant') tenantSlug?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('usage') usage?: string,
  ) {
    const tenantId = await this.resolveTenant(tenantIdParam, tenantSlug);

    const limit = Math.min(Math.max(parseInt(limitStr ?? '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const result = await this.storageService.listFiles({
      tenantId,
      actorRole: user.role,
      actorCompanyId: user.companyId,
      limit,
      offset,
    });

    // Where each file is used, resolved for the page rather than per file: the
    // library needs it to warn before a delete, and asking one file at a time
    // turned a fifty-file page into a hundred queries.
    //
    // Opt-in, because it costs six queries and only one caller wants it. The
    // dashboard and the media pickers ask for this list to show a file count or
    // a grid of thumbnails; making all of them pay for a usage scan they never
    // render was the kind of waste that only shows up on the slowest screen.
    const usedAt =
      usage === 'true'
        ? await this.mediaUsage.findUsage(
            tenantId,
            result.files.map((file) => file.url).filter((url): url is string => Boolean(url)),
          )
        : null;

    return {
      files: result.files.map((file) => ({
        ...file,
        ...(usedAt ? { usedAt: file.url ? usedAt[file.url] ?? [] : [] } : {}),
      })),
      pagination: { total: result.total, limit, offset },
      usage: {
        totalBytes: result.usage,
        totalMB: Math.round((result.usage / 1024 / 1024) * 100) / 100,
      },
    };
  }

  /**
   * Renames a file, or moves it to another folder.
   *
   * Safe by construction: the address a file is served from contains its
   * record id, not its name, so neither operation can break a page that uses
   * it. That is what makes tidying up a library of `IMG_4471.jpg` something
   * somebody can do without holding their breath.
   */
  @Patch('files/:id')
  @Roles('CONTENT_EDITOR')
  @ResponseMessage('Dosya güncellendi')
  @ApiOperation({ summary: 'Rename a file or move it to another folder' })
  async updateFile(
    @Param('id') fileId: string,
    @Body() dto: UpdateFileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storageService.updateFile({
      fileId,
      actorRole: user.role,
      actorCompanyId: user.companyId,
      ...(dto.filename !== undefined ? { filename: dto.filename } : {}),
      ...(dto.folder !== undefined ? { folder: dto.folder } : {}),
    });
  }

  /**
   * Swaps one file for another everywhere it appears.
   *
   * Not an overwrite. Files are served with an immutable cache header, which
   * is right — an address contains a record id that is never reused — and it
   * means changing the bytes under an existing address would leave browsers
   * showing last month's logo for a year. So the new picture is a new file,
   * and every reference to the old one is moved across.
   *
   * The alternative was asking somebody to remember every screen a logo
   * appears on and change each by hand, which is how a site ends up with two
   * versions of its own logo.
   */
  @Post('files/:id/replace')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Upload a replacement and repoint every use of the old file' })
  @ApiConsumes('multipart/form-data')
  async replaceFile(
    @Param('id') fileId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.storageService.getFile(fileId, user.role, user.companyId);

    if (!req.isMultipart()) {
      throw new BadRequestException('Request must use Content-Type: multipart/form-data');
    }
    const part = await req.file();
    if (!part) throw new BadRequestException('No file part found in the request');

    if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
      throw new BadRequestException(
        `MIME type "${part.mimetype}" is not allowed. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of part.file) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`,
        );
      }
      chunks.push(chunk);
    }

    const replacement = await this.storageService.uploadFile({
      tenantId: existing.tenantId,
      uploadedById: user.id,
      actorRole: user.role,
      actorCompanyId: user.companyId,
      folder: existing.folder,
      buffer: Buffer.concat(chunks),
      mimeType: part.mimetype,
      filename: part.filename,
    });

    // Only after the new file exists. Rewriting first would leave every page
    // pointing at nothing if the upload then failed.
    const rewritten = existing.url
      ? await this.mediaUsage.rewriteUrl(existing.tenantId, existing.url, replacement.url)
      : 0;

    return {
      file: replacement,
      replaced: rewritten,
      message:
        rewritten > 0
          ? `Görsel değiştirildi ve ${rewritten} yerde güncellendi. Yayınlamayı unutma.`
          : 'Görsel yüklendi. Eski dosya hiçbir yerde kullanılmıyordu.',
    };
  }

  /**
   * Soft-delete a file and remove it from R2.
   * Requires ADMIN role. Emits a DELETE_FILE audit event.
   */
  @Delete('files/:id')
  @Roles('ADMIN')
  @ResponseMessage('File deleted')
  @ApiOperation({ summary: 'Soft-delete a file and remove it from R2' })
  async deleteFile(
    @Param('id') fileId: string,
    @CurrentUser() user: AuthUser,
    @Query('force') force?: string,
  ) {
    // A file that is on the site is not deleted by accident. The panel asks
    // first and sends force=true when somebody has read the list of places it
    // will disappear from; refusing here means a script or a stray request
    // cannot take the logo off the header either.
    if (force !== 'true') {
      const file = await this.storageService.getFile(fileId, user.role, user.companyId);
      const usage = file.url
        ? (await this.mediaUsage.findUsage(file.tenantId, [file.url]))[file.url] ?? []
        : [];

      if (usage.length > 0) {
        throw new ConflictException({
          message: `Bu dosya ${usage.length} yerde kullanılıyor. Silmeden önce oradan kaldır.`,
          usedAt: usage,
        });
      }
    }

    await this.storageService.deleteFile({
      fileId,
      actorId: user.id,
      actorRole: user.role,
      actorCompanyId: user.companyId,
    });

    return { id: fileId };
  }

  /**
   * Takes either a tenant id or a tenant slug.
   *
   * The website endpoints address a tenant by slug and this one by id, so the
   * admin panel — which knows the slug and not the id — could not call it at
   * all. Accepting both is what the media library needs to reach storage;
   * existing callers passing tenantId are unaffected.
   */
  private async resolveTenant(tenantId?: string, slug?: string): Promise<string> {
    if (tenantId) return tenantId;
    if (slug !== undefined) return this.tenants.resolveTenantId(slug);
    throw new BadRequestException('Either tenantId or tenant must be supplied');
  }
}
