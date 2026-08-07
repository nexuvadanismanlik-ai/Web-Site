-- Campaign attribution, from the first visit through to a won deal.
--
-- Kept verbatim rather than normalised: a campaign name is what the advertiser
-- typed, and two spellings are two campaigns to whoever set them up.

ALTER TABLE "page_views" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utmContent" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utmTerm" TEXT;

CREATE INDEX "page_views_tenantId_utmCampaign_idx" ON "page_views"("tenantId", "utmCampaign");

-- The same, on the enquiry, so "which campaign won us work" is one query.
ALTER TABLE "contact_messages" ADD COLUMN "source" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN "landingPath" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN "referrer" TEXT;
ALTER TABLE "contact_messages" ADD COLUMN "device" TEXT;

CREATE INDEX "contact_messages_tenantId_utmCampaign_idx" ON "contact_messages"("tenantId", "utmCampaign");
