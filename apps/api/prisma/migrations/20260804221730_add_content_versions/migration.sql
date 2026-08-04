-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "note" TEXT,
    "restoredFrom" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_versions_tenantId_createdAt_idx" ON "content_versions"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "content_versions_tenantId_isPublished_idx" ON "content_versions"("tenantId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_tenantId_number_key" ON "content_versions"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
