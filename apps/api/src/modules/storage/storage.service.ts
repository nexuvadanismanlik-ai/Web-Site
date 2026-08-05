import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
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
        `Storage is not configured; uploads will be refused. Missing: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Which storage settings are absent.
   *
   * Reading and deleting records work without them — only putting bytes into
   * the bucket does not. An unconfigured upload used to reach the S3 client and
   * come back as a bare 500, which tells an operator nothing about the four
   * environment variables they are missing.
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

    // 0. Say what is missing rather than failing inside the S3 client, which
    //    surfaces as a bare 500 and tells an operator nothing.
    const missing = this.missingConfig();
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Dosya depolama yapılandırılmamış. Sunucuda tanımlanması gereken değişkenler: ${missing.join(', ')}`,
      );
    }

    // 1. Ownership: caller must belong to the company that owns this tenant
    const { slug: tenantSlug } = await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    // 2. Upload to R2 — if this fails, no DB record is created (no orphan rows)
    const key = this.buildKey(tenantSlug, folder, filename);
    const url = `${this.publicUrl}/${key}`;

    await this.r2Upload(key, buffer, mimeType);

    // 3. Create DB record after successful R2 upload
    const file = await this.prisma.storageFile.create({
      data: { tenantId, uploadedById, key, url, mimeType, size: buffer.length, folder, filename },
      select: FILE_SELECT,
    });

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

    // 3. Remove from R2 — failure is logged but does not roll back the soft-delete.
    //    The file is already inaccessible through the API; the R2 object can be
    //    reclaimed by a lifecycle rule on the bucket if needed.
    try {
      await this.r2Delete(file.key);
    } catch (err) {
      this.logger.error(`R2 delete failed for key "${file.key}": ${(err as Error).message}`);
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
