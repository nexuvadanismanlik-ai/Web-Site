-- Nexuva OS — PostgreSQL initialization
-- This file runs once when the container is first created.
-- Schema is managed by Prisma migrations — do not define tables here.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Grant full access to the nexuva user
GRANT ALL PRIVILEGES ON DATABASE nexuva_os TO nexuva;
