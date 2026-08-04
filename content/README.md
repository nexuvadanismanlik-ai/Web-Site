# `content/` — seed fixtures, not production data

As of Phase 4 the website runs entirely on the database. Nothing in this folder
is read at runtime by the site, the admin panel or the API.

## `site.json`

The seed fixture for the website CMS. `apps/api/prisma/seed.cjs` reads it to
populate the `nexuva` tenant:

```bash
pnpm --filter @nexuva/api db:seed
```

Seeding is idempotent, and it is also the recovery path: re-running it restores
every section and collection to the contents of this file, discarding whatever
is currently in the database for those tables.

**Editing this file does not change the live site.** Content is edited in the
admin panel, which writes to the database through the API. This file only
matters when seeding a fresh environment.

## `messages.json`

Left over from the file-backed contact form. Contact submissions now go to the
`contact_messages` table via `POST /api/v1/website/contact`. Nothing reads this
file; it is kept only so earlier submissions are not lost.

## Where content actually lives

| Concern | Home |
| --- | --- |
| Content of record | Supabase — `website_*` and `contact_messages` tables |
| Schema of record | `apps/api/prisma/schema.prisma` (Prisma migrations only) |
| Read path (public site) | `GET /api/v1/website/content`, fetched at build time |
| Write path (admin) | `PUT /api/v1/website/sections/:key`, `PUT /api/v1/website/collections/:slug` |
