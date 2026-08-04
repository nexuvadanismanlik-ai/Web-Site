-- CreateEnum
CREATE TYPE "PublishState" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "publish_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "strategy" TEXT NOT NULL,
    "state" "PublishState" NOT NULL DEFAULT 'PENDING',
    "detail" TEXT NOT NULL,
    "deployId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "publish_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_state" (
    "tenantId" TEXT NOT NULL,
    "lastContentChangeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_state_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "publish_logs_tenantId_startedAt_idx" ON "publish_logs"("tenantId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "publish_logs_tenantId_state_idx" ON "publish_logs"("tenantId", "state");

-- AddForeignKey
ALTER TABLE "publish_logs" ADD CONSTRAINT "publish_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_logs" ADD CONSTRAINT "publish_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_state" ADD CONSTRAINT "website_state_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
