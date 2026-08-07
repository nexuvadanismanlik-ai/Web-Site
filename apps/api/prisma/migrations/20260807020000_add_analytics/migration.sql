-- First-party analytics. No IP address is stored: visitors are counted through
-- a hash salted with a value that changes daily, which distinguishes them for
-- one day and identifies nobody afterwards.

CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "browser" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "visitorHash" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "scrollDepth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_views_tenantId_createdAt_idx" ON "page_views"("tenantId", "createdAt" DESC);
CREATE INDEX "page_views_tenantId_path_idx" ON "page_views"("tenantId", "path");
CREATE INDEX "page_views_tenantId_visitorHash_idx" ON "page_views"("tenantId", "visitorHash");

ALTER TABLE "page_views" ADD CONSTRAINT "page_views_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_tenantId_createdAt_idx" ON "analytics_events"("tenantId", "createdAt" DESC);
CREATE INDEX "analytics_events_tenantId_name_idx" ON "analytics_events"("tenantId", "name");

ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
