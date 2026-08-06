import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UserRole } from '@nexuva/types';

// Minimal tenant shape used for ownership resolution — mirrors TENANT_OWNER_SELECT
// used in other services (FeatureFlags, Settings). slug is extra for R2 key building.
const TENANT_OWNER_SELECT = {
  id: true,
  slug: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

// Full file shape with nested tenant for ownership checks in delete/list
const FILE_WITH_TENANT_SELECT = {
  id: true,
  key: true,
  url: true,
  mimeType: true,
  size: true,
  folder: true,
  filename: true,
  tenantId: true,
  uploadedById: true,
  createdAt: true,
  deletedAt: true,
  tenant: { select: TENANT_OWNER_SELECT },
} as const;

// Safe projection for list / upload responses (no tenant details)
/**
 * Largest file the database driver accepts.
 *
 * Object storage takes ten megabytes; the database takes two. Brand assets —
 * a logo, a favicon, a share image — are measured in kilobytes, and a table
 * that also holds photo galleries would turn every backup into a chore.
 */
const DB_BLOB_MAX_BYTES = 2 * 1024 * 1024;

const FILE_SELECT = {
  id: true,
  key: true,
  url: true,
  mimeType: true,
  size: true,
  folder: true,
  filename: true,
  tenantId: true,
  uploadedById: true,
  createdAt: true,
} as const;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {
    const accountId = config.get<string>('storage.accountId') ?? '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get<string>('storage.accessKeyId') ?? '',
        secretAccessKey: config.get<string>('storage.secretAccessKey') ?? '',
      },
    });

    this.bucket = config.get<string>('storage.bucketName') ?? 'nexuva-os';
    this.publicUrl = config.get<string>('storage.publicUrl') ?? '';

    const missing = this.missingConfig();
    if (missing.length > 0) {
      this.logger.warn(
        `Object storage is not configured (missing: ${missing.join(', ')}). ` +
          'Uploads will be stored in the database instead, up to ' +
          `${DB_BLOB_MAX_BYTES / 1024 / 1024} MB per file.`,
      );
    }
  }

  /**
   * Which storage settings are absent.
   *
   * Their absence is not fatal: it selects the database driver instead. What
   * it costs is the CDN — files are then served by this API, which is fine for
   * a handful of brand assets and wrong for anything larger.
   */
  private missingConfig(): string[] {
    const required: [string, string][] = [
      ['R2_ACCOUNT_ID', 'storage.accountId'],
      ['R2_ACCESS_KEY_ID', 'storage.accessKeyId'],
      ['R2_SECRET_ACCESS_KEY', 'storage.secretAccessKey'],
      ['R2_PUBLIC_URL', 'storage.publicUrl'],
    ];
    return required.filter(([, key]) => !this.config.get<string>(key)).map(([name]) => name);
  }

  // ─── Ownership helpers ────────────────────────────────────────────────────

  private resolveOwnerCompanyId(tenant: {
    company: { id: string } | null;
    product: { companyId: string } | null;
  }): string | null {
    return tenant.company?.id ?? tenant.product?.companyId ?? null;
  }

  /**
   * Validates that the actor can operate on behalf of the given tenant.
   * SUPER_ADMIN bypasses all company checks.
   * Returns tenant slug for use as the R2 key prefix.
   */
  private async assertTenantOwnership(
    tenantId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<{ slug: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: TENANT_OWNER_SELECT,
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have access to this tenant');
      }
    }

    return { slug: tenant.slug };
  }

  /**
   * Loads a non-deleted file and verifies that the actor's company owns its tenant.
   * Returns the full file + tenant shape needed for audit logging.
   */
  private async assertFileOwnership(
    fileId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const file = await this.prisma.storageFile.findFirst({
      where: { id: fileId, deletedAt: null },
      select: FILE_WITH_TENANT_SELECT,
    });

    if (!file) throw new NotFoundException(`File ${fileId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(file.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have access to this file');
      }
    }

    return file;
  }

  // ─── R2 primitives ───────────────────────────────────────────────────────

  private buildKey(tenantSlug: string, folder: string, filename: string): string {
    return `${tenantSlug}/${folder}/${Date.now()}-${filename}`;
  }

  private async r2Upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    this.logger.log(`R2 upload: ${key}`);
  }

  private async r2Delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`R2 delete: ${key}`);
  }

  // ─── Storage driver ──────────────────────────────────────────────────────

  /** True when R2 is fully configured. Otherwise the database holds the bytes. */
  private get usesObjectStorage(): boolean {
    return this.missingConfig().length === 0;
  }

  /**
   * Where a database-held file is served from.
   *
   * Absolute, because the address is baked into a statically exported website
   * and into emails, neither of which can resolve a path relative to the API.
   */
  private blobUrl(fileId: string): string {
    const base = (this.config.get<string>('storage.apiPublicUrl') ?? '').replace(/\/+$/, '');
    return `${base}/storage/file/${fileId}`;
  }

  /**
   * The bytes of a database-held file.
   *
   * Public: these are logos and share images that appear on a public website,
   * and putting them behind a token would mean no browser could load them.
   */
  async readBlob(fileId: string): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    const file = await this.prisma.storageFile.findFirst({
      where: { id: fileId, deletedAt: null },
      select: { mimeType: true, filename: true, blob: { select: { data: true } } },
    });
    if (!file?.blob) throw new NotFoundException(`File ${fileId} not found`);
    return {
      data: Buffer.from(file.blob.data),
      mimeType: file.mimeType,
      filename: file.filename,
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async uploadFile(params: {
    tenantId: string;
    uploadedById: string;
    actorRole: UserRole;
    actorCompanyId?: string | null;
    folder: string;
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }) {
    const { tenantId, uploadedById, actorRole, actorCompanyId, folder, buffer, mimeType, filename } =
      params;

    // 1. Ownership: caller must belong to the company that owns this tenant
    const { slug: tenantSlug } = await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    const key = this.buildKey(tenantSlug, folder, filename);

    // 2. Store the bytes. Object storage when it is configured; otherwise the
    //    database, so that a deployment without R2 credentials can still accept
    //    a logo. Refusing the upload used to block most of what the CMS is for
    //    on a setting nobody could change from the panel.
    let file: { id: string; url: string; key: string; mimeType: string; size: number; folder: string; filename: string; tenantId: string; uploadedById: string; createdAt: Date };

    if (this.usesObjectStorage) {
      // If this fails, no DB record is created — no rows pointing at nothing.
      await this.r2Upload(key, buffer, mimeType);
      file = await this.prisma.storageFile.create({
        data: {
          tenantId,
          uploadedById,
          key,
          url: `${this.publicUrl}/${key}`,
          mimeType,
          size: buffer.length,
          folder,
          filename,
        },
        select: FILE_SELECT,
      });
    } else {
      if (buffer.length > DB_BLOB_MAX_BYTES) {
        throw new BadRequestException(
          `Dosya deposu yapılandırılmadığı için dosyalar veritabanında saklanıyor ve ` +
            `${Math.round(DB_BLOB_MAX_BYTES / 1024 / 1024)} MB sınırı var. Bu dosya ` +
            `${Math.round(buffer.length / 1024 / 1024)} MB.`,
        );
      }

      // The row and its bytes are written together: a record whose file is
      // missing is worse than no record.
      const created = await this.prisma.storageFile.create({
        data: {
          tenantId,
          uploadedById,
          key,
          // Filled in below — the address contains the id, which does not exist
          // until the row does.
          url: '',
          mimeType,
          size: buffer.length,
          folder,
          filename,
          blob: { create: { data: buffer } },
        },
        select: FILE_SELECT,
      });

      file = await this.prisma.storageFile.update({
        where: { id: created.id },
        data: { url: this.blobUrl(created.id) },
        select: FILE_SELECT,
      });
      this.logger.log(`Database upload: ${key} (${buffer.length} bytes)`);
    }

    // 4. Audit log
    await this.auditLog.log({
      actorId: uploadedById,
      action: 'CREATE_FILE',
      resource: 'storage_file',
      resourceId: file.id,
      tenantId,
      after: {
        key: file.key,
        url: file.url,
        mimeType: file.mimeType,
        size: file.size,
        folder: file.folder,
        filename: file.filename,
      },
    });

    return file;
  }

  async listFiles(params: {
    tenantId: string;
    actorRole: UserRole;
    actorCompanyId?: string | null;
    limit: number;
    offset: number;
  }) {
    const { tenantId, actorRole, actorCompanyId, limit, offset } = params;

    await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    const where = { tenantId, deletedAt: null };

    const [files, total] = await Promise.all([
      this.prisma.storageFile.findMany({
        where,
        select: FILE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.storageFile.count({ where }),
    ]);

    const usage = await this.getTenantUsage(tenantId);

    return { files, total, usage };
  }

  async deleteFile(params: {
    fileId: string;
    actorId: string;
    actorRole: UserRole;
    actorCompanyId?: string | null;
  }) {
    const { fileId, actorId, actorRole, actorCompanyId } = params;

    // 1. Ownership check — loads file data needed for audit log
    const file = await this.assertFileOwnership(fileId, actorRole, actorCompanyId);

    // 2. Soft-delete the DB record first; R2 removal is best-effort
    await this.prisma.storageFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    // 3. Remove the bytes — failure is logged but does not roll back the
    //    soft-delete. The file is already inaccessible through the API.
    if (this.usesObjectStorage) {
      // An orphaned R2 object can be reclaimed by a lifecycle rule on the bucket.
      try {
        await this.r2Delete(file.key);
      } catch (err) {
        this.logger.error(`R2 delete failed for key "${file.key}": ${(err as Error).message}`);
      }
    } else {
      // A database blob has no lifecycle rule to catch it, so leaving it would
      // keep the storage figure wrong forever. Deleting the row is enough —
      // the record stays soft-deleted and auditable, only the bytes go.
      try {
        await this.prisma.storageBlob.deleteMany({ where: { fileId } });
      } catch (err) {
        this.logger.error(`Blob delete failed for file "${fileId}": ${(err as Error).message}`);
      }
    }

    // 4. Audit log
    await this.auditLog.log({
      actorId,
      action: 'DELETE_FILE',
      resource: 'storage_file',
      resourceId: fileId,
      tenantId: file.tenantId,
      before: { key: file.key, url: file.url, mimeType: file.mimeType, size: file.size },
    });
  }

  async getTenantUsage(tenantId: string): Promise<number> {
    const result = await this.prisma.storageFile.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { size: true },
    });
    return result._sum.size ?? 0;
  }
}
