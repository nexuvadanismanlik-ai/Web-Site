-- Imagery and detail the CMS had no field for.
--
-- Every one of these is chosen from the media library rather than typed as a
-- URL: the panel is the only place an address should come from.

-- A service illustrated by an icon alone reads as a template.
ALTER TABLE "website_services" ADD COLUMN "imageUrl" TEXT;

-- A name and a sector is a logo wall. These are what make it a reference.
ALTER TABLE "website_references" ADD COLUMN "description" JSONB;
ALTER TABLE "website_references" ADD COLUMN "website" TEXT;
ALTER TABLE "website_references" ADD COLUMN "imageUrl" TEXT;
