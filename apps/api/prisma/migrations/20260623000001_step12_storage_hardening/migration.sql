-- Phase 2 Step 12 — Storage Module + Critical Infrastructure Hardening
-- Resolves: C-2 (partial unique indexes managed), H-4 (missing indexes), H-6 (page slug partial unique)
--
-- Apply with: prisma migrate deploy
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- ── StorageFile table ──────────────────────────────────────────────────────
-- Tracks every file upload: tenant ownership, size (for quota), and audit trail.

CREATE TABLE IF NOT EXISTS "storage_files" (
    "id"           TEXT          NOT NULL,
    "tenantId"     TEXT          NOT NULL,
    "uploadedById" TEXT          NOT NULL,
    "key"          TEXT          NOT NULL,
    "url"          TEXT          NOT NULL,
    "mimeType"     TEXT          NOT NULL,
    "size"         INTEGER       NOT NULL,
    "folder"       TEXT          NOT NULL DEFAULT 'uploads',
    "filename"     TEXT          NOT NULL,
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "storage_files_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (idempotent via pg_constraint check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'storage_files_tenantId_fkey'
  ) THEN
    ALTER TABLE "storage_files"
      ADD CONSTRAINT "storage_files_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'storage_files_uploadedById_fkey'
  ) THEN
    ALTER TABLE "storage_files"
      ADD CONSTRAINT "storage_files_uploadedById_fkey"
      FOREIGN KEY ("uploadedById")
      REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "storage_files_tenantId_idx"
    ON "storage_files"("tenantId");

CREATE INDEX IF NOT EXISTS "storage_files_tenantId_deletedAt_idx"
    ON "storage_files"("tenantId", "deletedAt");

CREATE INDEX IF NOT EXISTS "storage_files_uploadedById_idx"
    ON "storage_files"("uploadedById");

-- ── AuditLog.tenantId ──────────────────────────────────────────────────────
-- Enables efficient per-tenant audit queries without a full table scan.

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_idx"
    ON "audit_logs"("tenantId");

-- ── H-4: PageVersion composite descending index ────────────────────────────
-- The captureVersionInTx hot path queries:
--   WHERE "pageId" = $1 ORDER BY "versionNumber" DESC LIMIT 1
-- The @@unique([pageId, versionNumber]) B-tree can handle this with a
-- backward scan, but an explicit descending composite index makes the
-- planner's choice deterministic on large version tables.

CREATE INDEX IF NOT EXISTS "page_versions_pageId_versionNumber_idx"
    ON "page_versions"("pageId", "versionNumber" DESC);

-- ── C-2: Global FeatureFlag partial unique index ───────────────────────────
-- PostgreSQL treats NULL != NULL, so @@unique([key, tenantId]) does NOT
-- prevent duplicate global records (tenantId IS NULL). This partial index
-- fills that gap. Previously required manual SQL application; now managed.

CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_global_key_unique"
    ON "feature_flags"("key")
    WHERE "tenantId" IS NULL;

-- ── C-2: Global SystemSetting partial unique index ─────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_global_key_unique"
    ON "system_settings"("key")
    WHERE "tenantId" IS NULL;

-- ── H-6: Active-page slug partial unique index ─────────────────────────────
-- Replaces the regular @@unique([tenantId, slug, locale]) constraint.
-- The regular constraint prevented slug reuse even after soft-delete.
-- The partial index enforces uniqueness only among non-deleted pages,
-- so a soft-deleted page's slug becomes available for a new page immediately.

DROP INDEX IF EXISTS "pages_tenantId_slug_locale_key";

CREATE UNIQUE INDEX IF NOT EXISTS "pages_active_slug_unique"
    ON "pages"("tenantId", "slug", "locale")
    WHERE "deletedAt" IS NULL;
