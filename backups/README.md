# Database Backups

## `supabase-legacy-schema.sql` / `supabase-legacy-schema.prisma`

Safety export of the schema that occupied the `public` schema of Supabase
project `mjvqxhbgvnxtursxywbu` (eu-central-1) before it was cleared on
2026-08-04.

**Why it existed:** an earlier, abandoned trial design — a CRM / billing /
support platform (customers, invoices, subscriptions, licenses, tickets,
incidents, dashboards) plus some CMS tables (blogs, faqs, hero_sections,
sliders, references, menus, media, forms). No application code in this
repository ever referenced it.

**State at export:** 72 tables, 30 enum types, 808 columns, 130 constraints,
89 indexes — and **zero rows**. Schema only; there was no data to lose.

Its `_prisma_migrations` table held a single record, `20260712183553_init`,
with `applied_steps_count = 0` and identical start/finish timestamps — the
signature of `prisma migrate resolve --applied` (a baseline marker), not an
executed migration. The SQL that created those tables was never in this repo.

### How these were produced

The Supabase CLI's `db dump` requires Docker, which this project deliberately
avoids, so the DDL was reconstructed from the Postgres catalog
(`pg_catalog`, `pg_indexes`, `pg_get_constraintdef`) via read-only queries.

- `.sql` — runnable DDL: enum types, tables, constraints (PK → unique → check
  → FK order), then indexes.
- `.prisma` — the same schema as seen by `prisma db pull`, kept as a second,
  independent representation.

### Restoring

The export covers the `public` schema only; Supabase-managed schemas (`auth`,
`storage`, `realtime`, `vault`, `graphql*`, `extensions`) were never touched
and need no restore. To bring the legacy schema back into an empty database:

```bash
psql "$DIRECT_URL" -f backups/supabase-legacy-schema.sql
```

## Current source of truth

`apps/api/prisma/schema.prisma`. Every table change goes through Prisma
migrations — never by editing the database directly.
