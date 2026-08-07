-- The last fields the panel could not manage.
ALTER TABLE "website_services" ADD COLUMN "imageAlt" TEXT;
ALTER TABLE "website_services" ADD COLUMN "ctaLabel" JSONB;
ALTER TABLE "website_services" ADD COLUMN "ctaHref" TEXT;

ALTER TABLE "website_process_steps" ADD COLUMN "icon" TEXT;
ALTER TABLE "website_process_steps" ADD COLUMN "imageUrl" TEXT;
