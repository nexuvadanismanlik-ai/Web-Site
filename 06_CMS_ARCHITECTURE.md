# 06 — CMS ARCHITECTURE

---

## Overview

The CMS subsystem manages the content lifecycle for tenant-owned pages. It consists of five tightly-coupled modules:

- **Pages** — tenant-scoped CMS pages with slug + locale uniqueness
- **ContentBlocks** — ordered, typed JSON blocks within a page
- **SEO** — per-page meta tag configuration
- **Branding** — per-tenant visual identity configuration
- **Versioning** — full content snapshots enabling rollback and restore

Pages, ContentBlocks, and Versioning are deeply integrated: every mutation to page content automatically triggers a version snapshot inside a Prisma transaction.

---

## Module Dependency Graph

```
PagesModule
  ├── AuditLogModule
  └── VersioningModule
        └── AuditLogModule

ContentBlocksModule
  ├── AuditLogModule
  └── VersioningModule

SeoModule
  └── AuditLogModule

BrandingModule
  └── AuditLogModule
```

---

## MODULE: Pages

### Files

```
apps/api/src/modules/pages/
├── pages.module.ts
├── pages.controller.ts
├── pages.service.ts
└── dto/
    ├── create-page.dto.ts
    └── update-page.dto.ts
```

---

### `pages.module.ts`

```typescript
imports:  [AuditLogModule, VersioningModule]
providers: [PagesService]
controllers: [PagesController]
exports:  [PagesService]
```

PagesService is exported because it may be needed by other modules in the future (currently no other module imports PagesModule).

---

### `pages.controller.ts`

**Controller prefix**: `/pages`

#### GET /pages
- Role: `@Roles('CONTENT_EDITOR')` → minimum weight 40
- Query param: `tenantId: string`
- Calls: `PagesService.findByTenant(tenantId, user.role, user.companyId)`
- Returns: pages with seoSetting, ordered by updatedAt desc
- Ownership check: in service via `assertTenantOwnership()`

#### GET /pages/public/:tenantId/:locale/:slug
- Decorator: `@Public()` — no authentication required
- Path params: `tenantId`, `locale`, `slug`
- Calls: `PagesService.findBySlug(tenantId, slug, locale)`
- Returns: published page with visible content blocks and SEO
- Used by: `apps/web` SSR for public page rendering

#### GET /pages/:id
- Role: `@Roles('CONTENT_EDITOR')`
- Param: `id`
- Calls: `PagesService.findById(id, user.role, user.companyId)`
- Returns: page with all blocks, seoSetting, last 10 versions, ownership data

#### POST /pages
- Role: `@Roles('CONTENT_EDITOR')`
- Body: `CreatePageDto`
- Calls: `PagesService.create(dto, user.id, user.role, user.companyId)`
- Returns: created page (no blocks — created empty)

#### PATCH /pages/:id
- Role: `@Roles('CONTENT_EDITOR')`
- Param: `id`
- Body: `UpdatePageDto`
- Calls: `PagesService.update(id, dto, user.id, user.role, user.companyId)`
- Snapshots current state as a version BEFORE the update (inside transaction)

#### POST /pages/:id/publish
- Role: `@Roles('CONTENT_EDITOR')`
- Param: `id`, no body
- HTTP 200
- Calls: `PagesService.publish(id, user.id, user.role, user.companyId)`
- Snapshots state before publishing

#### POST /pages/:id/unpublish
- Role: `@Roles('CONTENT_EDITOR')`
- Param: `id`, no body
- HTTP 200
- Calls: `PagesService.unpublish(id, user.id, user.role, user.companyId)`
- Snapshots state before unpublishing

#### DELETE /pages/:id
- Role: `@Roles('ADMIN')` — higher than other CMS routes
- Param: `id`
- Calls: `PagesService.softDelete(id, user.id, user.role, user.companyId)`

---

### `pages.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`, `VersioningService`

#### Key Constants

```typescript
// Single query to resolve Tenant → Company | Product ownership chain
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
}

// Full page data shape for mutation pre-fetch operations
const PAGE_FOR_MUTATION = {
  id: true,
  tenantId: true,
  slug: true,
  locale: true,
  title: true,
  isPublished: true,
  currentVersion: true,
  contentBlocks: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
  },
  tenant: { select: TENANT_OWNER_SELECT },
}
```

---

#### `resolveOwnerCompanyId(tenant)` — private

```typescript
return tenant.company?.id ?? tenant.product?.companyId ?? null;
```

Resolves the company that owns a tenant regardless of whether the tenant is a HOLDING company tenant or a PRODUCT tenant.

---

#### `assertTenantOwnership(tenantId, actorRole, actorCompanyId)` — private async

1. SUPER_ADMIN → return immediately
2. `prisma.tenant.findUnique({ where: { id: tenantId }, select: TENANT_OWNER_SELECT })`
3. If not found → `NotFoundException`
4. `resolveOwnerCompanyId(tenant)` → if result !== `actorCompanyId` → `ForbiddenException`

Used by: `findByTenant()`, `create()`

---

#### `assertPageOwnership(pageId, actorRole, actorCompanyId)` — private async

1. `prisma.page.findFirst({ where: { id: pageId, deletedAt: null }, select: PAGE_FOR_MUTATION })`
2. If not found → `NotFoundException`
3. SUPER_ADMIN → return page
4. `resolveOwnerCompanyId(page.tenant)` → if !== `actorCompanyId` → `ForbiddenException`
5. Returns the page object for caller reuse (avoids double fetch in mutation methods)

Used by: `update()`, `publish()`, `unpublish()`, `softDelete()`

---

#### `findByTenant(tenantId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. `prisma.page.findMany({ where: { tenantId, deletedAt: null }, include: { seoSetting: true }, orderBy: { updatedAt: 'desc' } })`

Returns pages with seoSetting. Does NOT include contentBlocks (list view optimization).

Prisma models touched: `tenant` (read), `page` (read), `seo_settings` (read via include)

---

#### `findById(id, actorRole, actorCompanyId)`

1. `prisma.page.findFirst({ where: { id, deletedAt: null }, include: { contentBlocks, seoSetting, versions (last 10), tenant } })`
2. If not found → `NotFoundException`
3. Inline ownership check: `resolveOwnerCompanyId(page.tenant) !== actorCompanyId` → `ForbiddenException`
4. Returns full page with all relations

Prisma models touched: `page` (read), `content_blocks` (read), `seo_settings` (read), `page_versions` (read)

---

#### `findBySlug(tenantId, slug, locale)` — public, no auth

```typescript
prisma.page.findFirst({
  where: { tenantId, slug, locale, deletedAt: null, isPublished: true },
  include: {
    contentBlocks: { where: { isVisible: true, deletedAt: null }, orderBy: { position: 'asc' } },
    seoSetting: true,
  }
})
```

Only returns published, non-deleted pages. Only returns visible, non-deleted blocks. No auth — called by public web SSR.

Prisma models touched: `page` (read), `content_blocks` (read, filtered by isVisible=true), `seo_settings` (read)

---

#### `create(dto, actorId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId)`
2. Compute `locale = dto.locale ?? 'tr'`
3. Pre-check for duplicate slug (active pages): `prisma.page.findFirst({ where: { tenantId, slug, locale, deletedAt: null } })`
4. If duplicate → `ConflictException`
5. `prisma.page.create({ data: { tenantId, slug, title, locale, isPublished: false, currentVersion: 1 } })`
   - Catches Prisma P2002 (unique constraint) for soft-deleted slug reservation
6. `auditLog.log({ action: 'CREATE', resource: 'page', after: { tenantId, slug, title, locale } })`

Note: `currentVersion` is always set to 1 on create and is NOT incremented anywhere in the codebase after creation. This field is vestigial — version management is handled by the `page_versions` table.

Prisma models touched: `tenant` (read), `page` (read, create)

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(id, actorRole, actorCompanyId)` — loads page with blocks and tenant
2. `prisma.$transaction(async (tx) => { await versioning.captureVersionInTx(tx, id, actorId); await tx.page.update({ title: dto.title }) })`
3. `auditLog.log({ action: 'UPDATE', resource: 'page', before: { title }, after: { title } })`
4. Return: `this.findById(id, actorRole, actorCompanyId)` — fresh full reload

Transaction flow:
```
BEGIN TRANSACTION
  captureVersionInTx(tx, pageId, actorId)
    → tx.page.findUnique (read current state)
    → tx.contentBlock.findMany (read current blocks)
    → tx.seoSetting.findUnique (read current SEO)
    → tx.pageVersion.findFirst (get last version number)
    → tx.pageVersion.create (insert snapshot)
  tx.page.update({ title: dto.title })
COMMIT
```

Prisma models touched: `page` (read via assertPageOwnership, read via captureVersionInTx, update), `content_blocks` (read via captureVersionInTx), `seo_settings` (read via captureVersionInTx), `page_versions` (read, create)

Currently, only `title` can be changed via this endpoint. `slug` and `locale` cannot be changed after creation.

---

#### `publish(id, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(id, actorRole, actorCompanyId)`
2. If already published → return `{ id, isPublished: true, changed: false }` (idempotent)
3. `prisma.$transaction(async (tx) => { await versioning.captureVersionInTx(...); await tx.page.update({ isPublished: true }) })`
4. `auditLog.log({ action: 'PUBLISH', resource: 'page', before: { isPublished: false }, after: { isPublished: true } })`
5. Return `{ id, isPublished: true, changed: true }`

Prisma models touched: `page` (read, update), `content_blocks` (read), `seo_settings` (read), `page_versions` (read, create)

---

#### `unpublish(id, actorId, actorRole, actorCompanyId)`

Mirror of `publish()`:
1. `assertPageOwnership(id, actorRole, actorCompanyId)`
2. If already unpublished → return idempotent response
3. Transaction: captureVersionInTx → page.update({ isPublished: false })
4. `auditLog.log({ action: 'UNPUBLISH', ... })`
5. Return `{ id, isPublished: false, changed: true }`

---

#### `softDelete(id, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(id, actorRole, actorCompanyId)`
2. `prisma.page.update({ where: { id }, data: { deletedAt: new Date(), isPublished: false } })` — also unpublishes
3. `auditLog.log({ action: 'DELETE', resource: 'page', before: { slug, title, isPublished } })`

No transaction. No version snapshot before deletion. ContentBlocks and SeoSettings are NOT explicitly deleted — they rely on Prisma's cascade delete (onDelete: Cascade on the relation). However, soft delete does NOT trigger cascade — `deletedAt` on Page does not cascade to ContentBlocks. ContentBlocks remain in the DB with their pageId intact. Only a hard delete of Page would cascade-delete ContentBlocks via Prisma.

Prisma models touched: `page` (read via assertPageOwnership, update)

---

### `dto/create-page.dto.ts`

```typescript
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUPPORTED_LOCALES = ['tr', 'en'] as const;

class CreatePageDto {
  @IsString() @IsNotEmpty()
  tenantId: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  @Matches(SLUG_REGEX, { message: 'slug must be kebab-case' })
  slug: string;           // enforces kebab-case format

  @IsString() @IsNotEmpty() @MaxLength(200)
  title: string;

  @IsOptional() @IsIn(SUPPORTED_LOCALES)
  locale?: string;        // default 'tr'
}
```

Only Page DTO enforces slug format. Company and Product DTOs do not.

---

### `dto/update-page.dto.ts`

```typescript
class UpdatePageDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;
}
```

Only `title` is updatable. `slug`, `locale`, `isPublished`, `tenantId` cannot be changed. Publish state is managed via dedicated `/publish` and `/unpublish` endpoints.

---

## MODULE: ContentBlocks

### Files

```
apps/api/src/modules/content-blocks/
├── content-blocks.module.ts
├── content-blocks.controller.ts
├── content-blocks.service.ts
└── dto/
    ├── create-content-block.dto.ts
    ├── reorder-blocks.dto.ts
    ├── update-content-block.dto.ts
    └── visibility.dto.ts
```

---

### `content-blocks.module.ts`

```typescript
imports:  [AuditLogModule, VersioningModule]
providers: [ContentBlocksService]
controllers: [ContentBlocksController]
exports:  []
```

---

### `content-blocks.controller.ts`

**Controller prefix**: `/content-blocks`

#### GET /content-blocks/page/:pageId
- Role: `@Roles('CONTENT_EDITOR')`
- Returns: all non-deleted blocks (including invisible), ordered by position
- Admin view — visible and hidden blocks included

#### GET /content-blocks/:id
- Role: `@Roles('CONTENT_EDITOR')`
- Returns: single block

#### POST /content-blocks
- Role: `@Roles('CONTENT_EDITOR')`
- Body: `CreateContentBlockDto`
- Returns: created block

#### PATCH /content-blocks/page/:pageId/reorder
- Role: `@Roles('CONTENT_EDITOR')`
- Path param: `pageId`
- Body: `ReorderBlocksDto { blocks: ReorderItemDto[] }`
- HTTP 200
- Reorders N blocks atomically; snapshots version

#### PATCH /content-blocks/:id/visibility
- Role: `@Roles('CONTENT_EDITOR')`
- Param: `id`
- Body: `VisibilityDto { isVisible: boolean }`
- HTTP 200
- Idempotent; snapshots version

#### PATCH /content-blocks/:id
- Role: `@Roles('CONTENT_EDITOR')`
- Param: `id`
- Body: `UpdateContentBlockDto`
- Snapshots version before update

#### DELETE /content-blocks/:id
- Role: `@Roles('ADMIN')` — higher than read/write routes
- Param: `id`
- Soft delete

---

### `content-blocks.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`, `VersioningService`

**Constants**:
```typescript
const MAX_CONTENT_BYTES = 100 * 1024; // 100 KB per block
```

---

#### `assertPageOwnership(pageId, actorRole, actorCompanyId)` — private async

1. `prisma.page.findFirst({ where: { id: pageId, deletedAt: null }, select: { id, tenantId, tenant: { select: TENANT_OWNER_SELECT } } })`
2. If not found → `NotFoundException`
3. SUPER_ADMIN → return `{ id, tenantId }`
4. `resolveOwnerCompanyId(page.tenant) !== actorCompanyId` → `ForbiddenException`
5. Returns `{ id: page.id, tenantId: page.tenantId }`

---

#### `assertBlockOwnership(blockId, actorRole, actorCompanyId)` — private async

1. `prisma.contentBlock.findFirst({ where: { id: blockId, deletedAt: null }, include: { page: { select: { id, tenantId, tenant: { select: TENANT_OWNER_SELECT } } } } })`
2. If not found → `NotFoundException`
3. SUPER_ADMIN → return block
4. `resolveOwnerCompanyId(block.page.tenant) !== actorCompanyId` → `ForbiddenException`
5. Returns the full block object (with page ownership chain included)

---

#### `assertValidContent(content)` — private

```typescript
if (!content || typeof content !== 'object' || Array.isArray(content)) throw BadRequest
if (Object.keys(content).length === 0) throw BadRequest('content must not be empty')
const size = Buffer.byteLength(JSON.stringify(content), 'utf8');
if (size > MAX_CONTENT_BYTES) throw BadRequest('content exceeds 100KB')
```

---

#### `findByPage(pageId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' } })`

Returns all non-deleted blocks including invisible ones (admin view).

---

#### `findById(id, actorRole, actorCompanyId)`

1. `assertBlockOwnership(id, actorRole, actorCompanyId)` — verifies ownership
2. `prisma.contentBlock.findUnique({ where: { id } })` — second query, without ownership data

Two DB queries for a single block fetch. The first loads the block with tenant data (for ownership check), the second reloads it clean. Optimization opportunity: return the block from `assertBlockOwnership` directly and strip the page/tenant fields.

---

#### `create(dto, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(dto.pageId, actorRole, actorCompanyId)`
2. `assertValidContent(dto.content)` — size and type check
3. If `dto.position` is undefined: `prisma.contentBlock.findFirst({ where: { pageId, deletedAt: null }, orderBy: { position: 'desc' }, select: { position } })` — find max position
4. `position = last ? last.position + 1 : 0`
5. `prisma.contentBlock.create({ data: { pageId, type, content, position, isVisible } })`
6. `auditLog.log({ action: 'CREATE', resource: 'content_block', ... })`

Note: No version snapshot on CREATE. A new block does not trigger a page version. Only updates, reorders, visibility changes, and page-level operations trigger version capture.

Prisma models touched: `page` (read), `content_blocks` (read for max position, create)

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `assertBlockOwnership(id, actorRole, actorCompanyId)` → returns `before` (the block)
2. If `dto.content !== undefined`: `assertValidContent(dto.content)`
3. `prisma.$transaction(async (tx) => { await versioning.captureVersionInTx(tx, before.pageId, actorId); updated = await tx.contentBlock.update({ type, content }) })`
4. `auditLog.log({ action: 'UPDATE', resource: 'content_block', before, after })`

Transaction: version snapshot → block update, atomic.

Prisma models touched: `content_blocks` (read via assertBlockOwnership, update in tx), `page_versions` (create in tx), `page` (read in captureVersionInTx), `seo_settings` (read in captureVersionInTx)

---

#### `reorder(pageId, items, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.contentBlock.findMany({ where: { pageId, deletedAt: null }, select: { id, position } })` — load current order
3. Build `existingIds = new Set(existing.map(b => b.id))`
4. Validate every `item.id` is in `existingIds` — throws `BadRequestException` for any unknown or deleted block
5. `prisma.$transaction(async (tx) => { await versioning.captureVersionInTx(tx, pageId, actorId); for (item of items) await tx.contentBlock.update({ where: { id: item.id }, data: { position: item.position } }) })`
6. `auditLog.log({ action: 'REORDER', resource: 'content_block', resourceId: pageId, before: { positions }, after: { positions } })`
7. Return: `prisma.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' } })` — fresh reload

Transaction contains: 1 captureVersionInTx + N block updates. For large pages, this could be a long transaction.

Prisma models touched: `page` (read via assertPageOwnership, read in captureVersionInTx), `content_blocks` (read, N updates in tx), `page_versions` (read, create in tx), `seo_settings` (read in captureVersionInTx)

---

#### `updateVisibility(id, isVisible, actorId, actorRole, actorCompanyId)`

1. `assertBlockOwnership(id, actorRole, actorCompanyId)` → `before`
2. If `before.isVisible === isVisible` → return `{ id, isVisible, changed: false }` (idempotent)
3. `prisma.$transaction(async (tx) => { await versioning.captureVersionInTx(tx, before.pageId, actorId); updated = await tx.contentBlock.update({ isVisible }) })`
4. `auditLog.log({ action: 'VISIBILITY_CHANGE', resource: 'content_block', ... })`
5. Return `{ id, isVisible, changed: true }`

Prisma models touched: `content_blocks` (read, update), `page_versions` (read, create), `page` (read), `seo_settings` (read)

---

#### `softDelete(id, actorId, actorRole, actorCompanyId)`

1. `assertBlockOwnership(id, actorRole, actorCompanyId)` → `before`
2. `prisma.contentBlock.update({ where: { id }, data: { deletedAt: new Date() } })`
3. `auditLog.log({ action: 'DELETE', resource: 'content_block', ... })`

No version snapshot on soft-delete. Soft-deleted blocks remain in DB with deletedAt set. They are excluded from all queries that filter `where: { deletedAt: null }` and from version snapshots (captureVersionInTx filters `deletedAt: null`).

---

### DTOs

#### `create-content-block.dto.ts`

```typescript
class CreateContentBlockDto {
  @IsString() @IsNotEmpty()
  pageId: string;

  @IsEnum(BLOCK_TYPES)
  type: BlockType;        // HERO | TEXT | IMAGE | GALLERY | CTA | FEATURES | TESTIMONIALS | FAQ | CUSTOM

  @IsObject()
  content: Record<string, unknown>;  // any JSON object

  @IsOptional() @IsInt() @Min(0)
  position?: number;      // appended to end if omitted

  @IsOptional() @IsBoolean()
  isVisible?: boolean;    // default true
}
```

---

#### `reorder-blocks.dto.ts`

```typescript
class ReorderItemDto {
  @IsString() @IsNotEmpty()
  id: string;

  @IsInt() @Min(0)
  position: number;
}

class ReorderBlocksDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReorderItemDto)
  blocks: ReorderItemDto[];
}
```

---

#### `update-content-block.dto.ts`

```typescript
class UpdateContentBlockDto {
  @IsOptional() @IsEnum(BLOCK_TYPES)
  type?: BlockType;

  @IsOptional() @IsObject()
  content?: Record<string, unknown>;
}
```

Note: `position` and `isVisible` are NOT updatable via the general PATCH endpoint. They have dedicated endpoints (`/reorder` and `/visibility`). This is an intentional separation of concerns.

---

#### `visibility.dto.ts`

```typescript
class VisibilityDto {
  @IsBoolean()
  isVisible: boolean;
}
```

---

## MODULE: SEO

### Files

```
apps/api/src/modules/seo/
├── seo.module.ts
├── seo.controller.ts
├── seo.service.ts
└── dto/
    └── upsert-seo.dto.ts
```

---

### `seo.controller.ts`

**Controller prefix**: `/seo`

#### GET /seo
- Role: `@Roles('CONTENT_EDITOR')`
- Returns: all SEO records visible to actor

#### GET /seo/page/:pageId
- Role: `@Roles('CONTENT_EDITOR')`
- Returns: SEO for that page (null if not yet set)

#### GET /seo/page/:pageId/public
- Decorator: `@Public()` — no auth
- Returns: SEO for a published page
- Used by SSR for `<head>` meta tags

#### PUT /seo/page/:pageId
- Role: `@Roles('CONTENT_EDITOR')`
- Body: `UpsertSeoDto`
- HTTP 200
- Partial upsert — only supplied fields are written

#### DELETE /seo/page/:pageId
- Role: `@Roles('ADMIN')`
- HTTP 200
- Removes SEO record (hard delete)
- Idempotent — safe if no SEO exists

---

### `seo.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### Include constants

```typescript
// Full ownership chain for mutation checks
const SEO_WITH_OWNER = {
  page: {
    select: {
      id, tenantId, slug, locale, isPublished, deletedAt,
      tenant: { select: { id, name, slug, company: { select: { id } }, product: { select: { companyId } } } }
    }
  }
}

// Lighter shape for list endpoint
const SEO_LIST_INCLUDE = {
  page: { select: { id, slug, locale, tenantId, tenant: { select: { id, name, slug } } } }
}
```

---

#### `assertPageOwnership(pageId, actorRole, actorCompanyId)` — private async

1. `prisma.page.findFirst({ where: { id: pageId, deletedAt: null }, select: { ...with tenant } })`
2. If not found → `NotFoundException`
3. Ownership check via `resolveOwnerCompanyId(page.tenant) !== actorCompanyId` → `ForbiddenException`
4. Returns page with tenant (for caller reuse)

---

#### `findAll(actorRole, actorCompanyId)`

- SUPER_ADMIN: all SEO records with light page info
- Others: `where: { page: { deletedAt: null, tenant: { OR: [company, product] } } }`

---

#### `findByPage(pageId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.seoSetting.findUnique({ where: { pageId }, include: SEO_WITH_OWNER })`
3. Returns null if no SEO record exists (not an error)

---

#### `findByPagePublic(pageId)` — no auth

```typescript
const page = await prisma.page.findFirst({ where: { id: pageId, isPublished: true, deletedAt: null } });
if (!page) throw NotFoundException;
return prisma.seoSetting.findUnique({ where: { pageId } });
```

Returns null if no SEO record (caller must handle).

---

#### `upsert(pageId, dto, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.seoSetting.findUnique({ where: { pageId } })` — check if existing
3. `prisma.seoSetting.upsert({ where: { pageId }, create: { ...all dto fields }, update: { ...only present dto fields } })`
4. `auditLog.log({ action: existing ? 'UPDATE' : 'CREATE', resource: 'seo_setting', ... })`

Partial update on existing: only fields present in `dto` are written. Missing fields in `dto` keep their existing values.

Prisma models touched: `page` (read), `seo_settings` (read, upsert)

---

#### `remove(pageId, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.seoSetting.findUnique({ where: { pageId } })` — check if exists
3. If not found → return `{ removed: true, hadSeoSettings: false }` (idempotent)
4. `prisma.seoSetting.delete({ where: { pageId } })` — hard delete
5. `auditLog.log({ action: 'DELETE', resource: 'seo_setting', ... })`
6. Return `{ removed: true, hadSeoSettings: true }`

---

### `dto/upsert-seo.dto.ts`

All fields optional:
- `metaTitle?: string` (maxLength: 70)
- `metaDescription?: string` (maxLength: 160)
- `keywords?: string[]`
- `ogImage?: string` (URL)
- `ogTitle?: string` (maxLength: 70)
- `ogDescription?: string` (maxLength: 200)
- `twitterCard?: string`
- `canonicalUrl?: string` (URL)
- `noIndex?: boolean`

---

## MODULE: Branding

### Files

```
apps/api/src/modules/branding/
├── branding.module.ts
├── branding.controller.ts
├── branding.service.ts
└── dto/
    └── upsert-branding.dto.ts
```

---

### `branding.controller.ts`

**Controller prefix**: `/branding`

#### GET /branding
- Role: `@Roles('PRODUCT_MANAGER')`

#### GET /branding/tenant/:tenantId
- Role: `@Roles('PRODUCT_MANAGER')`
- Returns branding or null

#### PUT /branding/tenant/:tenantId
- Role: `@Roles('PRODUCT_MANAGER')`
- HTTP 200
- Body: `UpsertBrandingDto`
- Partial upsert

#### DELETE /branding/tenant/:tenantId
- Role: `@Roles('ADMIN')`
- HTTP 200
- Resets branding (hard delete of record)

---

### `branding.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### `assertTenantOwnership(tenantId, actorRole, actorCompanyId)` — private async

Standard ownership check. Loads tenant with company + product relations. SUPER_ADMIN bypasses.

---

#### `findAll(actorRole, actorCompanyId)`

- SUPER_ADMIN: all branding records
- Others: branding where `tenant.company.id = actorCompanyId OR tenant.product.companyId = actorCompanyId`

---

#### `findByTenant(tenantId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. `prisma.branding.findUnique({ where: { tenantId }, include: { tenant } })`
3. Returns null if no branding exists

---

#### `upsert(tenantId, dto, actorId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. `prisma.branding.findUnique({ where: { tenantId } })` — check existing
3. `prisma.branding.upsert({ create: { all fields }, update: { ...only present fields } })`
4. `auditLog.log({ action: existing ? 'UPDATE' : 'CREATE', resource: 'branding', before, after })`

Partial update: `...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl })` for each field.

Prisma models touched: `tenant` (read), `branding` (read, upsert)

---

#### `reset(tenantId, actorId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. `prisma.branding.findUnique({ where: { tenantId } })`
3. If not found → return `{ reset: true, hadBranding: false }` (idempotent)
4. `prisma.branding.delete({ where: { tenantId } })` — hard delete
5. `auditLog.log({ action: 'DELETE', resource: 'branding', ... })`

Note: Does NOT invalidate TenantService cache. After branding reset, the cache will serve stale branding data for up to 60 seconds.

---

### `dto/upsert-branding.dto.ts`

All fields optional:
- `logoUrl?: string` (URL)
- `faviconUrl?: string` (URL)
- `primaryColor?: string`
- `secondaryColor?: string`
- `accentColor?: string`
- `fontHeading?: string`
- `fontBody?: string`
- `themePreset?: string`
- `customCss?: string`
- `config?: Record<string, unknown>`

No hex color validation — any string is accepted for color fields.

---

## MODULE: Versioning

### Files

```
apps/api/src/modules/versioning/
├── versioning.module.ts
├── versioning.controller.ts
├── versioning.service.ts
└── dto/
    ├── create-version.dto.ts
    └── rollback.dto.ts
```

---

### `versioning.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [VersioningService]
controllers: [VersioningController]
exports:  [VersioningService]   ← exported for PagesModule and ContentBlocksModule
```

---

### `versioning.controller.ts`

**No controller prefix** — routes are structured under `/pages/:pageId/versions` and `/versions/:id`.

#### GET /pages/:pageId/versions
- Role: `@Roles('CONTENT_EDITOR')`
- Returns: list of versions (newest first), without full snapshot data (summary only)

#### POST /pages/:pageId/versions
- Role: `@Roles('CONTENT_EDITOR')`
- Body: `CreateVersionDto { reason?: string }` — `reason` field is accepted but not stored (no `reason` column in PageVersion model)
- Manually snapshots current page state

#### POST /pages/:pageId/rollback
- Role: `@Roles('CONTENT_EDITOR')`
- Body: `RollbackDto { versionId: string (UUID) }`
- HTTP 200
- Rolls back content (blocks + title) from snapshot; creates new version

#### POST /pages/:pageId/restore
- Role: `@Roles('CONTENT_EDITOR')`
- Body: `RollbackDto { versionId: string }`
- HTTP 200
- Same as rollback but also restores SEO from snapshot

#### GET /versions/:id
- Role: `@Roles('CONTENT_EDITOR')`
- Returns: full version with contentSnapshot and seoSnapshot

#### DELETE /versions/:id
- Role: `@Roles('SUPER_ADMIN')`
- Permanently deletes a version record — irreversible
- Audit logged

---

### `versioning.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### Ownership Helpers

**`assertPageOwnership(pageId, actorRole, actorCompanyId)`** — private async
- Loads page with ownership chain
- SUPER_ADMIN bypasses
- Returns page

**`assertVersionOwnership(versionId, actorRole, actorCompanyId)`** — private async
- Loads PageVersion with its page and page's tenant ownership chain
- SUPER_ADMIN bypasses
- Returns version

---

#### `captureVersionInTx(tx, pageId, actorId)` — public, used in transactions

This is the central snapshot method called by Pages, ContentBlocks, and Versioning services inside transactions.

```typescript
const [page, blocks, seo, last] = await Promise.all([
  tx.page.findUnique({ where: { id: pageId }, select: { title, slug, locale, isPublished } }),
  tx.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' }, select: { type, content, position, isVisible } }),
  tx.seoSetting.findUnique({ where: { pageId } }),
  tx.pageVersion.findFirst({ where: { pageId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber } }),
]);

if (!page) return; // page deleted mid-transaction; bail silently

const versionNumber = (last?.versionNumber ?? 0) + 1;

await tx.pageVersion.create({
  data: {
    pageId,
    versionNumber,
    title: page.title,
    contentSnapshot: blocks,      // array of { type, content, position, isVisible }
    seoSnapshot: seo ? { ...seo fields } : Prisma.DbNull,
    createdById: actorId,
  }
});
```

Uses `Promise.all` to parallelize 4 reads within the transaction, then inserts the version.

**Note on Prisma.DbNull vs null**: SEO snapshot uses `Prisma.DbNull` when no SEO exists — this explicitly stores a database NULL rather than JSON null. This is the correct behavior for a nullable JSON column.

**Note on `currentVersion`**: The `Page.currentVersion` field is set to 1 on create and is NEVER incremented by this method. The actual version counter is determined by querying `pageVersion.findFirst` with desc order. `currentVersion` on the Page model is vestigial.

---

#### `getVersions(pageId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.pageVersion.findMany({ where: { pageId }, orderBy: { versionNumber: 'desc' }, select: { id, pageId, versionNumber, title, createdAt, createdById, createdBy: { select: { id, firstName, lastName, email } } } })`

Returns metadata only — contentSnapshot and seoSnapshot are excluded from the list view (performance).

---

#### `getVersion(versionId, actorRole, actorCompanyId)`

Delegates to `assertVersionOwnership()` which loads the full version including snapshots.

---

#### `createVersion(pageId, actorId, actorRole, actorCompanyId)`

Manual checkpoint operation.

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.$transaction(async (tx) => { await captureVersionInTx(tx, pageId, actorId); versionNumber = ... })`
3. `auditLog.log({ action: 'CREATE_VERSION', resource: 'page_version', ... })`
4. Return `{ versionNumber }`

---

#### `rollback(pageId, versionId, actorId, actorRole, actorCompanyId)`

Restores blocks and title from a snapshot. Creates a new version from the restored state. History is append-only — old versions are never modified.

Example: At V5, rollback to V3 → creates V6 whose content = V3's content.

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `assertVersionOwnership(versionId, actorRole, actorCompanyId)` → `target`
3. If `target.pageId !== pageId` → `BadRequestException`
4. Extract `blocks = target.contentSnapshot as Array<Record<string, unknown>>`
5. `prisma.$transaction(async (tx) => { ... })`

Inside transaction:
```
tx.contentBlock.deleteMany({ where: { pageId } })     ← HARD DELETE all existing blocks
for block in blocks:
  tx.contentBlock.create({ type, content, position, isVisible })
tx.page.update({ title: target.title })
captureVersionInTx(tx, pageId, actorId)               ← snapshot the restored state
```

6. `auditLog.log({ action: 'ROLLBACK', resource: 'page_version', ... })`
7. Return `{ pageId, restoredFromVersion, newVersionNumber }`

**Critical**: The `deleteMany` inside the rollback transaction is a **hard delete**, not a soft delete. All current live blocks (including soft-deleted ones with deletedAt set) are permanently removed from the DB. This is intentional — clean slate before restoring — but it means soft-deleted blocks are also wiped.

---

#### `restore(pageId, versionId, actorId, actorRole, actorCompanyId)`

Identical to `rollback()` but also restores SEO data from `seoSnapshot`.

Inside transaction (additional steps after block restore):
```
tx.seoSetting.upsert({ where: { pageId }, create: { ...seo fields }, update: { ...seo fields } })
```

If `seoSnapshot` is null in the version, SEO is not touched (existing SEO is preserved).

7. Return `{ pageId, restoredFromVersion, newVersionNumber, seoRestored: boolean }`

---

#### `deleteVersion(versionId, actorId, actorRole)`

SUPER_ADMIN only — enforced in method (not just at controller).

```typescript
if (actorRole !== 'SUPER_ADMIN') throw ForbiddenException('Only SUPER_ADMIN may delete version records');
```

1. `prisma.pageVersion.findUnique({ where: { id: versionId }, select: { id, pageId, versionNumber, title } })`
2. If not found → `NotFoundException`
3. `prisma.pageVersion.delete({ where: { id: versionId } })` — hard delete
4. `auditLog.log({ action: 'DELETE_VERSION', ... })`

This is irreversible. Deleting a version means it cannot be rolled back to.

---

### `dto/create-version.dto.ts`

```typescript
class CreateVersionDto {
  @IsOptional() @IsString() @MaxLength(255)
  reason?: string;
}
```

The `reason` field is accepted by the DTO but is NOT stored — the `PageVersion` model has no `reason` column. The field is silently ignored. This is technical debt.

---

### `dto/rollback.dto.ts`

```typescript
class RollbackDto {
  @IsString() @IsNotEmpty() @IsUUID()
  versionId: string;
}
```

---

## CMS Execution Maps (Request Flow)

### Page Create Flow

```
POST /pages
  │
  ├─ JwtAuthGuard (validates JWT, loads user from DB)
  ├─ RolesGuard (requires CONTENT_EDITOR+)
  │
  └─ PagesController.create(dto, user)
        │
        └─ PagesService.create(dto, actorId, actorRole, actorCompanyId)
              │
              ├─ assertTenantOwnership(dto.tenantId, ...)
              │     └─ prisma.tenant.findUnique (load + check ownership)
              │
              ├─ prisma.page.findFirst (duplicate slug check)
              │
              ├─ prisma.page.create (insert page, isPublished=false, currentVersion=1)
              │
              └─ auditLogService.log({ action: 'CREATE', resource: 'page' })
                    └─ prisma.auditLog.create
```

---

### Page Update Flow

```
PATCH /pages/:id
  │
  ├─ JwtAuthGuard
  ├─ RolesGuard (CONTENT_EDITOR+)
  │
  └─ PagesController.update(id, dto, user)
        │
        └─ PagesService.update(id, dto, actorId, actorRole, actorCompanyId)
              │
              ├─ assertPageOwnership(id, ...)
              │     └─ prisma.page.findFirst (+ tenant ownership check)
              │
              ├─ prisma.$transaction()
              │     │
              │     ├─ VersioningService.captureVersionInTx(tx, pageId, actorId)
              │     │     ├─ Promise.all: [page, blocks, seo, lastVersion]
              │     │     └─ tx.pageVersion.create (snapshot)
              │     │
              │     └─ tx.page.update({ title })
              │
              ├─ auditLogService.log({ action: 'UPDATE', resource: 'page' })
              │
              └─ PagesService.findById() (fresh reload)
```

---

### Page Publish Flow

```
POST /pages/:id/publish
  │
  ├─ JwtAuthGuard
  ├─ RolesGuard (CONTENT_EDITOR+)
  │
  └─ PagesController.publish(id, user)
        │
        └─ PagesService.publish(id, actorId, actorRole, actorCompanyId)
              │
              ├─ assertPageOwnership(id, ...)
              │
              ├─ if page.isPublished === true → return { changed: false } (idempotent)
              │
              ├─ prisma.$transaction()
              │     ├─ captureVersionInTx (snapshot before publish)
              │     └─ tx.page.update({ isPublished: true })
              │
              └─ auditLogService.log({ action: 'PUBLISH' })
```

---

### Content Block Update Flow

```
PATCH /content-blocks/:id
  │
  ├─ JwtAuthGuard
  ├─ RolesGuard (CONTENT_EDITOR+)
  │
  └─ ContentBlocksController.update(id, dto, user)
        │
        └─ ContentBlocksService.update(id, dto, actorId, actorRole, actorCompanyId)
              │
              ├─ assertBlockOwnership(id, ...)
              │     └─ prisma.contentBlock.findFirst (+ page → tenant chain)
              │
              ├─ assertValidContent(dto.content) (if present)
              │
              ├─ prisma.$transaction()
              │     ├─ captureVersionInTx(tx, block.pageId, actorId)
              │     └─ tx.contentBlock.update({ type, content })
              │
              └─ auditLogService.log({ action: 'UPDATE', resource: 'content_block' })
```

---

### Version Rollback Flow

```
POST /pages/:pageId/rollback
  │
  ├─ JwtAuthGuard
  ├─ RolesGuard (CONTENT_EDITOR+)
  │
  └─ VersioningController.rollback(pageId, dto, user)
        │
        └─ VersioningService.rollback(pageId, versionId, actorId, actorRole, actorCompanyId)
              │
              ├─ assertPageOwnership(pageId, ...)
              │
              ├─ assertVersionOwnership(versionId, ...)
              │     └─ checks version.pageId === pageId
              │
              ├─ prisma.$transaction()
              │     ├─ tx.contentBlock.deleteMany({ where: { pageId } })  ← HARD DELETE
              │     ├─ for each block in contentSnapshot:
              │     │     tx.contentBlock.create({ ... })
              │     ├─ tx.page.update({ title: target.title })
              │     ├─ captureVersionInTx(tx, pageId, actorId)  ← snapshot the restored state
              │     └─ (read new versionNumber)
              │
              └─ auditLogService.log({ action: 'ROLLBACK' })
```

---

### Feature Flag Toggle Flow

```
PATCH /feature-flags/:id/toggle
  │
  ├─ JwtAuthGuard
  ├─ RolesGuard (ADMIN+)
  │
  └─ FeatureFlagsController.toggle(id, dto, user)
        │
        └─ FeatureFlagsService.toggle(id, dto.isEnabled, actorId, actorRole, actorCompanyId)
              │
              ├─ assertFeatureFlagOwnership(id, ...)
              │
              ├─ if before.isEnabled === isEnabled → return { changed: false } (idempotent)
              │
              ├─ prisma.featureFlag.update({ isEnabled })
              │
              └─ auditLogService.log({ action: 'ENABLE' or 'DISABLE' })
```

Note: Toggling a feature flag does NOT invalidate the TenantService cache. Feature flags are merged into TenantContext at resolution time and cached for 60 seconds. A flag toggle takes up to 60 seconds to be visible in tenant middleware.

---

## Route Access Matrix — CMS

| Route | VIEWER | CONTENT_EDITOR | PRODUCT_MANAGER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| GET /pages (list) | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| GET /pages/public/:... | ✓ (public) | ✓ | ✓ | ✓ | ✓ |
| GET /pages/:id | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| POST /pages | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| PATCH /pages/:id | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| POST /pages/:id/publish | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| POST /pages/:id/unpublish | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ (scoped) | ✓ |
| DELETE /pages/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /content-blocks/page/:id | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| POST /content-blocks | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| PATCH /content-blocks/:id | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| PATCH .../reorder | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| PATCH .../visibility | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| DELETE /content-blocks/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /pages/:id/versions | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| POST /pages/:id/versions | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| POST /pages/:id/rollback | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| POST /pages/:id/restore | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| GET /versions/:id | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| DELETE /versions/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /seo/page/:pageId | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| GET /seo/page/:pageId/public | ✓ (public) | ✓ | ✓ | ✓ | ✓ |
| PUT /seo/page/:pageId | ✗ | ✓ (scoped) | ✓ | ✓ | ✓ |
| DELETE /seo/page/:pageId | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /branding | ✗ | ✗ | ✓ (scoped) | ✓ | ✓ |
| GET /branding/tenant/:id | ✗ | ✗ | ✓ (scoped) | ✓ | ✓ |
| PUT /branding/tenant/:id | ✗ | ✗ | ✓ (scoped) | ✓ | ✓ |
| DELETE /branding/tenant/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
