import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Param,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { StorageService } from './storage.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

interface AuthUser {
  id: string;
  role: UserRole;
  companyId: string | null;
}

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

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
  async upload(
    @Req() req: FastifyRequest,
    @Query('tenantId') tenantId: string,
    @Query('folder') folder = 'uploads',
    @CurrentUser() user: AuthUser,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId query parameter is required');

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

    return { success: true, data: file };
  }

  /**
   * List active (non-deleted) files for a tenant.
   * Results are paginated and ownership-checked.
   * Also returns total active storage usage for the tenant.
   */
  @Get('files')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'List files for a tenant (paginated, ownership-checked)' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  async listFiles(
    @Query('tenantId') tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId query parameter is required');

    const limit = Math.min(Math.max(parseInt(limitStr ?? '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const result = await this.storageService.listFiles({
      tenantId,
      actorRole: user.role,
      actorCompanyId: user.companyId,
      limit,
      offset,
    });

    return {
      success: true,
      data: {
        files: result.files,
        pagination: { total: result.total, limit, offset },
        usage: {
          totalBytes: result.usage,
          totalMB: Math.round((result.usage / 1024 / 1024) * 100) / 100,
        },
      },
    };
  }

  /**
   * Soft-delete a file and remove it from R2.
   * Requires ADMIN role. Emits a DELETE_FILE audit event.
   */
  @Delete('files/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete a file and remove it from R2' })
  async deleteFile(
    @Param('id') fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.storageService.deleteFile({
      fileId,
      actorId: user.id,
      actorRole: user.role,
      actorCompanyId: user.companyId,
    });

    return { success: true, message: 'File deleted' };
  }
}
