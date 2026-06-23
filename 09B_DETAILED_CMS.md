# 09B — DETAILED CMS
## Pages, ContentBlocks, SEO, Branding, Versioning

---

# MODULE: Pages

## Folder Tree

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

## File Details

### `pages.module.ts`

**Location**: `apps/api/src/modules/pages/pages.module.ts`

**Purpose**: Declares the Pages feature module. Imports VersioningModule (for `captureVersionInTx` access) and AuditLogModule. Exports `PagesService` for potential cross-module use (no other module currently imports PagesModule).

**Imports**:
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { VersioningModule } from '../versioning/versioning.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
```

**Exports**: `[PagesService]`

**Who imports this module**: `AppModule`

**Who calls `PagesService`**: `PagesController` only (no cross-service calls)

---

### `pages.controller.ts`

**Location**: `apps/api/src/modules/pages/pages.controller.ts`

**Purpose**: HTTP interface for page lifecycle. Handles listing, single-fetch, create, update, publish/unpublish, and soft-delete. Separates publish state management into dedicated endpoints.

**Imports**:
```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
```

**Exports**: `PagesController` class

**Who calls this file**: NestJS HTTP layer (Fastify router), no direct service-to-controller calls

**Which files this file calls**: `PagesService` (all methods)

**Database models used**: None directly — all via PagesService

**Security implications**:
- `GET /pages/public/:tenantId/:locale/:slug` is `@Public()` — no auth, returns only published+visible content
- All mutation routes require minimum `CONTENT_EDITOR`
- Delete requires `ADMIN` — deliberately higher than create/update to prevent accidental deletion
- All routes pass `user.role` and `user.companyId` to service — service enforces ownership scoping

---

**Routes**:

#### `GET /pages`
```
@Roles('CONTENT_EDITOR')
@Get()
findByTenant(@Query('tenantId') tenantId: string, @CurrentUser() user)
```
- **Query param**: `tenantId: string` — required, not validated as UUID at controller level (service loads it)
- **Calls**: `PagesService.findByTenant(tenantId, user.role, user.companyId)`
- **Returns**: `Page[]` with `seoSetting` included, ordered by `updatedAt DESC`
- **Scope**: SUPER_ADMIN sees all pages for tenant; others see only if they own the tenant's company

#### `GET /pages/public/:tenantId/:locale/:slug`
```
@Public()
@Get('public/:tenantId/:locale/:slug')
findPublic(@Param('tenantId') tenantId, @Param('locale') locale, @Param('slug') slug)
```
- **No auth**
- **Calls**: `PagesService.findBySlug(tenantId, slug, locale)`
- **Returns**: Page with `contentBlocks` (visible only, ordered by position) and `seoSetting`
- **Used by**: `apps/web` Next.js SSR rendering pipeline

#### `GET /pages/:id`
```
@Roles('CONTENT_EDITOR')
@Get(':id')
findById(@Param('id') id, @CurrentUser() user)
```
- **Calls**: `PagesService.findById(id, user.role, user.companyId)`
- **Returns**: Full page with all blocks (including hidden), seoSetting, last 10 versions, tenant chain

#### `POST /pages`
```
@Roles('CONTENT_EDITOR')
@Post()
create(@Body() dto: CreatePageDto, @CurrentUser() user)
```
- **Body**: `CreatePageDto`
- **Calls**: `PagesService.create(dto, user.id, user.role, user.companyId)`
- **Returns**: Created page (no blocks — starts empty)

#### `PATCH /pages/:id`
```
@Roles('CONTENT_EDITOR')
@Patch(':id')
update(@Param('id') id, @Body() dto: UpdatePageDto, @CurrentUser() user)
```
- **Body**: `UpdatePageDto { title?: string }`
- **Calls**: `PagesService.update(id, dto, user.id, user.role, user.companyId)`
- **Returns**: Updated page (full reload)
- **Side effect**: Snapshots current state as a version in same transaction

#### `POST /pages/:id/publish`
```
@Roles('CONTENT_EDITOR')
@Post(':id/publish')
@HttpCode(HttpStatus.OK)
publish(@Param('id') id, @CurrentUser() user)
```
- **No body**
- **Calls**: `PagesService.publish(id, user.id, user.role, user.companyId)`
- **Returns**: `{ id, isPublished: true, changed: boolean }`
- **Idempotent**: already-published pages return `changed: false`

#### `POST /pages/:id/unpublish`
```
@Roles('CONTENT_EDITOR')
@Post(':id/unpublish')
@HttpCode(HttpStatus.OK)
unpublish(@Param('id') id, @CurrentUser() user)
```
- **Calls**: `PagesService.unpublish(id, user.id, user.role, user.companyId)`

#### `DELETE /pages/:id`
```
@Roles('ADMIN')
@Delete(':id')
softDelete(@Param('id') id, @CurrentUser() user)
```
- **Calls**: `PagesService.softDelete(id, user.id, user.role, user.companyId)`
- **Returns**: `{ deleted: true }`
- **Note**: Higher role required (ADMIN vs CONTENT_EDITOR for other mutations)

---

### `pages.service.ts`

**Location**: `apps/api/src/modules/pages/pages.service.ts`

**Purpose**: All CMS page business logic. Ownership verification, slug uniqueness enforcement, version snapshot integration, soft-delete lifecycle.

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VersioningService } from '../versioning/versioning.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
```

**Exports**: `PagesService` class

**Who calls this file**: `PagesController`

**Which files this file calls**:
- `PrismaService` — all page/tenant/content/seo queries
- `AuditLogService` — all mutation events
- `VersioningService.captureVersionInTx()` — called inside transactions for every content-changing mutation

**Database models used**:
- `Page` — all CRUD
- `Tenant` — read (ownership chain resolution)
- `Company` — read (via Tenant include, for ownership)
- `Product` — read (via Tenant include, for ownership)
- `ContentBlock` — read (included in responses, and in captureVersionInTx)
- `SeoSetting` — read (included in responses, and in captureVersionInTx)
- `PageVersion` — read (included in single page view), create (via captureVersionInTx)

---

#### Constants

```typescript
// Minimum tenant include to resolve the owning company
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
};

// Full page shape needed for mutation pre-fetch (ownership + full content for snapshot)
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
    orderBy: { position: 'asc' as const },
  },
  tenant: { select: TENANT_OWNER_SELECT },
};
```

---

#### Private Method: `resolveOwnerCompanyId(tenant)`

**Input**: Tenant object with `company: { id }` and `product: { companyId }` (nullable both)

**Output**: `string | null` — the company ID that owns this tenant

```typescript
private resolveOwnerCompanyId(tenant: TenantWithOwners): string | null {
  return tenant.company?.id ?? tenant.product?.companyId ?? null;
}
```

**Logic**:
- If tenant has a `company` (tenant IS a company): return `company.id`
- Else if tenant has a `product` (tenant IS a product's tenant): return `product.companyId`
- Else: return null (only for global/platform tenants)

**Called by**: `assertTenantOwnership()`, `assertPageOwnership()`, and inline in `findById()`

---

#### Private Method: `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`

**Input**: `tenantId: string`, actor role and company

**Output**: void (throws on failure)

**Calls**:
```typescript
const tenant = await this.prisma.tenant.findUnique({
  where: { id: tenantId },
  select: TENANT_OWNER_SELECT,
});
if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

if (actorRole === 'SUPER_ADMIN') return;

const ownerCompanyId = this.resolveOwnerCompanyId(tenant);
if (ownerCompanyId !== actorCompanyId) {
  throw new ForbiddenException('You do not have access to this tenant');
}
```

**Throws**:
- `NotFoundException` — tenant does not exist
- `ForbiddenException` — actor's company does not own this tenant

**Used by**: `findByTenant()`, `create()`

---

#### Private Method: `assertPageOwnership(pageId, actorRole, actorCompanyId)`

**Input**: `pageId: string`, actor role and company

**Output**: Page object (including contentBlocks and tenant chain) — returned for caller reuse to avoid a second DB query

**Calls**:
```typescript
const page = await this.prisma.page.findFirst({
  where: { id: pageId, deletedAt: null },
  select: PAGE_FOR_MUTATION,
});
if (!page) throw new NotFoundException(`Page ${pageId} not found`);

if (actorRole === 'SUPER_ADMIN') return page;

const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
if (ownerCompanyId !== actorCompanyId) {
  throw new ForbiddenException('You do not have access to this page');
}
return page;
```

**Prisma queries**:
```typescript
prisma.page.findFirst({
  where: { id: pageId, deletedAt: null },
  select: PAGE_FOR_MUTATION,  // includes contentBlocks + tenant chain
})
```

**Used by**: `update()`, `publish()`, `unpublish()`, `softDelete()`

---

#### Method: `findByTenant(tenantId, actorRole, actorCompanyId)`

**Input**: `tenantId: string`, actor context

**Output**: `Page[]` with `seoSetting`, ordered by `updatedAt DESC`

**Calls**:
1. `this.assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. DB query
3. Return pages

**Prisma queries**:
```typescript
prisma.page.findMany({
  where: { tenantId, deletedAt: null },
  include: { seoSetting: true },
  orderBy: { updatedAt: 'desc' },
})
```

**Note**: ContentBlocks are NOT included in list view — performance optimization. Full blocks are only loaded in `findById()`.

---

#### Method: `findById(id, actorRole, actorCompanyId)`

**Input**: `id: string`, actor context

**Output**: Full page with all relations

**Calls**:
```typescript
const page = await this.prisma.page.findFirst({
  where: { id, deletedAt: null },
  include: {
    contentBlocks: {
      where: { deletedAt: null },
      orderBy: { position: 'asc' },
    },
    seoSetting: true,
    versions: {
      orderBy: { versionNumber: 'desc' },
      take: 10,
      include: { createdBy: { select: { id, firstName, lastName, email } } },
    },
    tenant: {
      select: {
        id, name, slug,
        company: { select: { id, name } },
        product: { select: { id, name, companyId } },
      },
    },
  },
});
if (!page) throw new NotFoundException();

// Inline ownership check (not using assertPageOwnership — different include shape)
if (actorRole !== 'SUPER_ADMIN') {
  const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
  if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();
}
return page;
```

**Prisma queries**: Single `findFirst` with 4 includes (contentBlocks, seoSetting, versions, tenant)

**Note**: Last 10 versions are included with their creator's name. ContentBlocks include all non-deleted blocks, including hidden (admin view).

---

#### Method: `findBySlug(tenantId, slug, locale)`

**Input**: `tenantId: string`, `slug: string`, `locale: string` — no actor context (public endpoint)

**Output**: Page with visible blocks and SEO, or throws `NotFoundException`

**Calls**:
```typescript
const page = await this.prisma.page.findFirst({
  where: { tenantId, slug, locale, deletedAt: null, isPublished: true },
  include: {
    contentBlocks: {
      where: { isVisible: true, deletedAt: null },
      orderBy: { position: 'asc' },
    },
    seoSetting: true,
  },
});
if (!page) throw new NotFoundException('Page not found or not published');
return page;
```

**Filters applied**:
- `isPublished: true` — draft pages never returned
- `deletedAt: null` — soft-deleted pages excluded
- `contentBlocks.isVisible: true` — hidden blocks excluded from public view
- `contentBlocks.deletedAt: null` — deleted blocks excluded

**Used by**: `apps/web` Next.js SSR pages

---

#### Method: `create(dto, actorId, actorRole, actorCompanyId)`

**Input**: `CreatePageDto { tenantId, slug, title, locale? }`, actor context

**Output**: Created page (no blocks)

**Calls**:
1. `this.assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId)`
2. Compute locale: `const locale = dto.locale ?? 'tr'`
3. Duplicate slug check:
```typescript
const existing = await this.prisma.page.findFirst({
  where: { tenantId: dto.tenantId, slug: dto.slug, locale, deletedAt: null },
});
if (existing) throw new ConflictException(`Slug '${dto.slug}' already exists for locale '${locale}'`);
```
4. Create page:
```typescript
const page = await this.prisma.page.create({
  data: {
    tenantId: dto.tenantId,
    slug: dto.slug,
    title: dto.title,
    locale,
    isPublished: false,
    currentVersion: 1,  // vestigial — actual versioning via PageVersion table
  },
});
```
5. Catch Prisma P2002 (unique constraint) → `ConflictException`
6. `this.auditLogService.log({ action: 'CREATE', resource: 'page', actorId, tenantId: dto.tenantId, after: { slug, title, locale } })`
7. Return page

**Note on duplicate check**: Manual pre-check (step 3) before the create. Also catches P2002 as backup (step 5) for race conditions. The Prisma `@@unique([slug, tenantId, locale])` constraint is the authoritative guard.

**Prisma queries**:
```typescript
prisma.tenant.findUnique({ where: { id: dto.tenantId }, select: TENANT_OWNER_SELECT })
prisma.page.findFirst({ where: { tenantId, slug, locale, deletedAt: null } })
prisma.page.create({ data: { tenantId, slug, title, locale, isPublished: false, currentVersion: 1 } })
```

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

**Input**: `UpdatePageDto { title?: string }`, actor context

**Output**: Full page (fresh reload via `findById()`)

**Calls**:
1. `const page = await this.assertPageOwnership(id, actorRole, actorCompanyId)` — returns page with blocks and tenant
2. `const before = { title: page.title }` — capture for audit
3. Transaction:
```typescript
await this.prisma.$transaction(async (tx) => {
  await this.versioningService.captureVersionInTx(tx, id, actorId);
  await tx.page.update({
    where: { id },
    data: { ...(dto.title !== undefined && { title: dto.title }) },
  });
});
```
4. `this.auditLogService.log({ action: 'UPDATE', resource: 'page', resourceId: id, actorId, before, after: dto })`
5. Return `this.findById(id, actorRole, actorCompanyId)` — full fresh reload

**Transaction operations** (in order):
1. `captureVersionInTx` → reads current state (page + blocks + seo + last version number) → creates PageVersion
2. `page.update({ title })` → applies the change

**Important**: Version is captured BEFORE the change. V1 = state before update. If you update title from "A" to "B", V1 snapshot has title "A". This is correct — you can rollback to "A" from V1.

**Prisma queries**:
```typescript
// assertPageOwnership:
prisma.page.findFirst({ where: { id, deletedAt: null }, select: PAGE_FOR_MUTATION })
// In transaction:
tx.page.findUnique({ ... })  // captureVersionInTx
tx.contentBlock.findMany({ ... })  // captureVersionInTx
tx.seoSetting.findUnique({ ... })  // captureVersionInTx
tx.pageVersion.findFirst({ ... })  // captureVersionInTx
tx.pageVersion.create({ ... })  // captureVersionInTx
tx.page.update({ title })  // the actual update
// After transaction:
prisma.page.findFirst({ ... })  // findById reload (with 4 includes)
```

Total: 7 queries for a title update.

---

#### Method: `publish(id, actorId, actorRole, actorCompanyId)`

**Input**: `id: string`, actor context

**Output**: `{ id: string, isPublished: boolean, changed: boolean }`

**Calls**:
1. `const page = await this.assertPageOwnership(id, actorRole, actorCompanyId)`
2. Idempotency check: `if (page.isPublished) return { id, isPublished: true, changed: false }`
3. Transaction:
```typescript
await this.prisma.$transaction(async (tx) => {
  await this.versioningService.captureVersionInTx(tx, id, actorId);
  await tx.page.update({ where: { id }, data: { isPublished: true } });
});
```
4. `auditLog.log({ action: 'PUBLISH', resource: 'page', before: { isPublished: false }, after: { isPublished: true } })`
5. Return `{ id, isPublished: true, changed: true }`

**Security note**: No content validation before publish. A page with no blocks or a page with only invisible blocks can be published. Consider adding a pre-publish validation step.

---

#### Method: `unpublish(id, actorId, actorRole, actorCompanyId)`

**Mirror of `publish()`** — idempotent, snapshots state, sets `isPublished: false`.

---

#### Method: `softDelete(id, actorId, actorRole, actorCompanyId)`

**Input**: `id: string`, actor context

**Output**: `{ deleted: true }`

**Calls**:
1. `const page = await this.assertPageOwnership(id, actorRole, actorCompanyId)`
2. `const before = { slug: page.slug, title: page.title, isPublished: page.isPublished }`
3. `await this.prisma.page.update({ where: { id }, data: { deletedAt: new Date(), isPublished: false } })`
4. `auditLog.log({ action: 'DELETE', resource: 'page', before })`
5. Return `{ deleted: true }`

**Known issue (BUG-004)**: ContentBlocks for this page are NOT soft-deleted. They remain in the `content_blocks` table with their `pageId` intact and no `deletedAt` set. The Prisma schema has `onDelete: Cascade` on the relation, but cascade only triggers on hard deletes. Soft-deleting the Page orphans the blocks in the DB.

**No version snapshot before deletion**: Unlike update/publish, softDelete does NOT call `captureVersionInTx`. The final state of the page is not captured. If you want to restore a deleted page, you only have the last version snapshot that was taken before the delete.

---

### `dto/create-page.dto.ts`

**Location**: `apps/api/src/modules/pages/dto/create-page.dto.ts`

```typescript
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type SupportedLocale = 'tr' | 'en';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;
  // Accepts any string — not validated as UUID format

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_REGEX, { message: 'slug must be lowercase kebab-case (e.g. my-page-name)' })
  slug: string;
  // Enforced: ^[a-z0-9]+(?:-[a-z0-9]+)*$
  // Rejected: "My Page", "my_page", "myPage", "my page"

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  locale?: SupportedLocale;
  // Defaults to 'tr' in service if not provided
}
```

---

### `dto/update-page.dto.ts`

**Location**: `apps/api/src/modules/pages/dto/update-page.dto.ts`

```typescript
export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;
}
```

Only `title` can be changed after page creation. `slug`, `locale`, `tenantId`, `isPublished`, `currentVersion` are immutable via this endpoint. Publish state is managed via `/publish` and `/unpublish` endpoints.

---

## Pages Dependency Graph

```
PagesController
  │
  ├─ PagesService
  │     ├─ PrismaService
  │     │     └─ page, tenant, company, product, contentBlock, seoSetting, pageVersion tables
  │     ├─ AuditLogService
  │     │     └─ prisma.auditLog.create
  │     └─ VersioningService
  │           └─ captureVersionInTx(tx, pageId, actorId)
  │                 └─ PrismaService (tx)
  │
  └─ (reads req.user from JwtStrategy, req.tenantContext from TenantMiddleware)
```

---

## Pages Runtime Flows

### Create Page

```
POST /pages { tenantId, slug, title, locale }
  │
  1. TenantMiddleware → req.tenantContext
  2. JwtAuthGuard → JwtStrategy → req.user
  3. RolesGuard → CONTENT_EDITOR+ required
  │
  4. PagesController.create(dto, user)
     └─ PagesService.create(dto, user.id, user.role, user.companyId)
           │
           a. prisma.tenant.findUnique({ id: dto.tenantId, select: TENANT_OWNER_SELECT })
              [assertTenantOwnership]
              └─ company.id || product.companyId !== user.companyId → 403
           │
           b. prisma.page.findFirst({ tenantId, slug, locale, deletedAt:null })
              └─ EXISTS → 409 ConflictException
           │
           c. prisma.page.create({ tenantId, slug, title, locale, isPublished:false })
              └─ P2002 → 409 ConflictException
           │
           d. auditLogService.log({ action:'CREATE', resource:'page', after:{slug,title} })
           │
           e. RETURN created page
```

### Update Page (Title)

```
PATCH /pages/:id { title: "New Title" }
  │
  1-3. Auth + Role guards
  │
  4. PagesController.update(id, dto, user)
     └─ PagesService.update(id, dto, user.id, user.role, user.companyId)
           │
           a. prisma.page.findFirst({ id, deletedAt:null, select:PAGE_FOR_MUTATION })
              [assertPageOwnership → ownership check]
              Returns page object with contentBlocks + tenant chain
           │
           b. prisma.$transaction(async tx => {
                │
                i. VersioningService.captureVersionInTx(tx, pageId, actorId)
                   │
                   Promise.all([
                     tx.page.findUnique({ id }),         // current page state
                     tx.contentBlock.findMany({pageId}), // current blocks
                     tx.seoSetting.findUnique({pageId}), // current SEO
                     tx.pageVersion.findFirst({pageId,   // last version number
                       orderBy:{versionNumber:'desc'}}),
                   ])
                   tx.pageVersion.create({
                     pageId, versionNumber: last+1,
                     title: page.title,          // OLD title (before update)
                     contentSnapshot: blocks,
                     seoSnapshot: seo ?? Prisma.DbNull,
                     createdById: actorId,
                   })
                │
                ii. tx.page.update({ id }, { title: "New Title" })
              })
           │
           c. auditLogService.log({ action:'UPDATE', before:{title:"Old"}, after:{title:"New"} })
           │
           d. this.findById(id, user.role, user.companyId) → fresh full reload
              RETURN
```

### Publish Page

```
POST /pages/:id/publish
  │
  4. PagesService.publish(id, actorId, actorRole, actorCompanyId)
     │
     a. assertPageOwnership(id) → loads page
     │
     b. page.isPublished === true → RETURN { changed: false } (idempotent)
     │
     c. prisma.$transaction([captureVersionInTx, page.update({isPublished:true})])
     │
     d. auditLog({ action:'PUBLISH', before:{false}, after:{true} })
     │
     e. RETURN { id, isPublished:true, changed:true }
```

---

# MODULE: ContentBlocks

## Folder Tree

```
apps/api/src/modules/content-blocks/
├── content-blocks.module.ts
├── content-blocks.controller.ts
├── content-blocks.service.ts
└── dto/
    ├── create-content-block.dto.ts
    ├── update-content-block.dto.ts
    ├── reorder-blocks.dto.ts
    └── visibility.dto.ts
```

---

## File Details

### `content-blocks.module.ts`

**Location**: `apps/api/src/modules/content-blocks/content-blocks.module.ts`

**Imports**:
```typescript
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { VersioningModule } from '../versioning/versioning.module';
import { ContentBlocksController } from './content-blocks.controller';
import { ContentBlocksService } from './content-blocks.service';
```

**Exports**: Nothing (no cross-module dependencies on ContentBlocksService)

**Who imports this module**: `AppModule`

---

### `content-blocks.controller.ts`

**Location**: `apps/api/src/modules/content-blocks/content-blocks.controller.ts`

**Purpose**: HTTP interface for block management within pages. Manages creation, retrieval, content update, position reordering, visibility toggling, and soft-deletion. Purposely separates reorder and visibility into dedicated endpoints to prevent misuse.

**Imports**:
```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ContentBlocksService } from './content-blocks.service';
import { CreateContentBlockDto } from './dto/create-content-block.dto';
import { UpdateContentBlockDto } from './dto/update-content-block.dto';
import { ReorderBlocksDto } from './dto/reorder-blocks.dto';
import { VisibilityDto } from './dto/visibility.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
```

**Routes**:

#### `GET /content-blocks/page/:pageId`
```
@Roles('CONTENT_EDITOR')
@Get('page/:pageId')
findByPage(@Param('pageId') pageId, @CurrentUser() user)
```
- Returns all non-deleted blocks (including invisible ones — admin view)
- Ordered by position ASC

#### `GET /content-blocks/:id`
```
@Roles('CONTENT_EDITOR')
@Get(':id')
findById(@Param('id') id, @CurrentUser() user)
```
- Returns single block with page info
- Makes 2 DB queries (see DEBT-010)

#### `POST /content-blocks`
```
@Roles('CONTENT_EDITOR')
@Post()
create(@Body() dto: CreateContentBlockDto, @CurrentUser() user)
```
- Creates block appended to end of page if `position` not specified
- Does NOT snapshot version on create (design decision)

#### `PATCH /content-blocks/page/:pageId/reorder`
```
@Roles('CONTENT_EDITOR')
@Patch('page/:pageId/reorder')
@HttpCode(HttpStatus.OK)
reorder(@Param('pageId') pageId, @Body() dto: ReorderBlocksDto, @CurrentUser() user)
```
- Atomically updates all block positions in a transaction
- Validates all block IDs belong to the page before executing
- Snapshots version before reordering

#### `PATCH /content-blocks/:id/visibility`
```
@Roles('CONTENT_EDITOR')
@Patch(':id/visibility')
@HttpCode(HttpStatus.OK)
updateVisibility(@Param('id') id, @Body() dto: VisibilityDto, @CurrentUser() user)
```
- Idempotent: `{ changed: false }` if already in requested state
- Snapshots version before changing visibility

#### `PATCH /content-blocks/:id`
```
@Roles('CONTENT_EDITOR')
@Patch(':id')
update(@Param('id') id, @Body() dto: UpdateContentBlockDto, @CurrentUser() user)
```
- Updates `type` and/or `content` JSON
- Snapshots version before update

#### `DELETE /content-blocks/:id`
```
@Roles('ADMIN')
@Delete(':id')
softDelete(@Param('id') id, @CurrentUser() user)
```
- Higher role than other operations (ADMIN vs CONTENT_EDITOR)
- Soft delete only — no version snapshot on delete

---

### `content-blocks.service.ts`

**Location**: `apps/api/src/modules/content-blocks/content-blocks.service.ts`

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VersioningService } from '../versioning/versioning.service';
import { CreateContentBlockDto } from './dto/create-content-block.dto';
import { UpdateContentBlockDto } from './dto/update-content-block.dto';
import { ReorderItemDto } from './dto/reorder-blocks.dto';
```

**Exports**: `ContentBlocksService` class

**Who calls this file**: `ContentBlocksController`

**Which files this file calls**:
- `PrismaService`
- `AuditLogService`
- `VersioningService.captureVersionInTx()`

**Database models used**: `ContentBlock` (all CRUD), `Page` (read for ownership), `Tenant` (read for ownership via Page), `Company`, `Product`, `PageVersion` (create via captureVersionInTx), `SeoSetting` (read via captureVersionInTx), `AuditLog` (create)

---

#### Constant

```typescript
const MAX_CONTENT_BYTES = 100 * 1024; // 100 KB = 102,400 bytes
```

---

#### Private Method: `assertPageOwnership(pageId, actorRole, actorCompanyId)`

**Resolves page → tenant → company chain for ownership check.**

```typescript
private async assertPageOwnership(pageId: string, actorRole: string, actorCompanyId: string | null) {
  const page = await this.prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          company: { select: { id: true } },
          product: { select: { companyId: true } },
        },
      },
    },
  });
  if (!page) throw new NotFoundException(`Page ${pageId} not found`);
  if (actorRole === 'SUPER_ADMIN') return { id: page.id, tenantId: page.tenantId };

  const ownerCompanyId = page.tenant.company?.id ?? page.tenant.product?.companyId ?? null;
  if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();

  return { id: page.id, tenantId: page.tenantId };
}
```

**Returns**: `{ id, tenantId }` — the page's ID and tenantId (for audit log context)

---

#### Private Method: `assertBlockOwnership(blockId, actorRole, actorCompanyId)`

**Resolves block → page → tenant → company chain.**

```typescript
private async assertBlockOwnership(blockId: string, actorRole: string, actorCompanyId: string | null) {
  const block = await this.prisma.contentBlock.findFirst({
    where: { id: blockId, deletedAt: null },
    include: {
      page: {
        select: {
          id: true,
          tenantId: true,
          tenant: {
            select: {
              company: { select: { id: true } },
              product: { select: { companyId: true } },
            },
          },
        },
      },
    },
  });
  if (!block) throw new NotFoundException(`ContentBlock ${blockId} not found`);
  if (actorRole === 'SUPER_ADMIN') return block;

  const ownerCompanyId = block.page.tenant.company?.id ?? block.page.tenant.product?.companyId ?? null;
  if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();

  return block;  // includes block.pageId for use by caller
}
```

---

#### Private Method: `assertValidContent(content)`

```typescript
private assertValidContent(content: unknown): void {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new BadRequestException('content must be a non-null object');
  }
  if (Object.keys(content as object).length === 0) {
    throw new BadRequestException('content must not be empty');
  }
  const sizeBytes = Buffer.byteLength(JSON.stringify(content), 'utf8');
  if (sizeBytes > MAX_CONTENT_BYTES) {
    throw new BadRequestException(`content exceeds maximum size of ${MAX_CONTENT_BYTES} bytes`);
  }
}
```

**Validates**: non-null, object type (not array), non-empty, under 100KB when serialized to JSON.

---

#### Method: `findByPage(pageId, actorRole, actorCompanyId)`

**Calls**:
1. `this.assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' } })`

**Returns**: All non-deleted blocks (visible AND invisible — admin view)

---

#### Method: `findById(id, actorRole, actorCompanyId)`

**Calls**:
1. `const blockWithOwnership = await this.assertBlockOwnership(id, actorRole, actorCompanyId)` — loads block + page + tenant
2. `return await this.prisma.contentBlock.findUnique({ where: { id } })` — second query, clean block without page data

**Known issue (DEBT-010)**: Two DB queries. The first query loads everything needed for ownership, the second reloads the block cleanly. Optimize by stripping the page/tenant fields from the first result.

---

#### Method: `create(dto, actorId, actorRole, actorCompanyId)`

**Input**: `CreateContentBlockDto { pageId, type, content, position?, isVisible? }`

**Output**: Created ContentBlock

**Calls**:
1. `this.assertPageOwnership(dto.pageId, actorRole, actorCompanyId)` → `{ id, tenantId }`
2. `this.assertValidContent(dto.content)`
3. If `dto.position === undefined`: find max position:
```typescript
const last = await this.prisma.contentBlock.findFirst({
  where: { pageId: dto.pageId, deletedAt: null },
  orderBy: { position: 'desc' },
  select: { position: true },
});
const position = last ? last.position + 1 : 0;
```
4. Create block:
```typescript
await this.prisma.contentBlock.create({
  data: {
    pageId: dto.pageId,
    type: dto.type,
    content: dto.content,
    position,
    isVisible: dto.isVisible ?? true,
  },
});
```
5. `auditLog.log({ action: 'CREATE', resource: 'content_block', ... })`
6. Return created block

**No version snapshot on create**: A new empty block does not trigger a version. Only updates to existing content trigger versions. This is a design choice — newly created blocks have no "before" state worth snapshotting.

**Prisma queries**:
```typescript
prisma.page.findFirst({ where: { id: pageId, deletedAt:null } })  // assertPageOwnership
prisma.contentBlock.findFirst({ where:{ pageId, deletedAt:null }, orderBy:{position:'desc'} })
prisma.contentBlock.create({ data:{...} })
```

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

**Input**: `UpdateContentBlockDto { type?, content? }`

**Output**: Updated ContentBlock

**Calls**:
1. `const before = await this.assertBlockOwnership(id, actorRole, actorCompanyId)` — loads block
2. If `dto.content !== undefined`: `this.assertValidContent(dto.content)`
3. Transaction:
```typescript
let updated: ContentBlock;
await this.prisma.$transaction(async (tx) => {
  await this.versioningService.captureVersionInTx(tx, before.pageId, actorId);
  updated = await tx.contentBlock.update({
    where: { id },
    data: {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.content !== undefined && { content: dto.content }),
    },
  });
});
```
4. `auditLog.log({ action: 'UPDATE', resource: 'content_block', before: { type, content }, after: dto })`
5. Return `updated`

**Prisma queries**:
```typescript
prisma.contentBlock.findFirst({ id, deletedAt:null, include:{ page.tenant } })  // assertBlockOwnership
// In transaction:
tx.page.findUnique, tx.contentBlock.findMany, tx.seoSetting.findUnique, tx.pageVersion.findFirst  // captureVersionInTx
tx.pageVersion.create  // captureVersionInTx
tx.contentBlock.update({ type, content })  // actual update
```

---

#### Method: `reorder(pageId, items, actorId, actorRole, actorCompanyId)`

**Input**: `pageId: string`, `items: ReorderItemDto[] = [{ id, position }]`

**Output**: Updated block list (full reload)

**Calls**:
1. `this.assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. Load current blocks: `const existing = await this.prisma.contentBlock.findMany({ where: { pageId, deletedAt: null }, select: { id, position } })`
3. Validate all requested IDs:
```typescript
const existingIds = new Set(existing.map(b => b.id));
for (const item of items) {
  if (!existingIds.has(item.id)) {
    throw new BadRequestException(`Block ${item.id} does not belong to page ${pageId} or is deleted`);
  }
}
```
4. Transaction:
```typescript
await this.prisma.$transaction(async (tx) => {
  await this.versioningService.captureVersionInTx(tx, pageId, actorId);
  for (const item of items) {
    await tx.contentBlock.update({
      where: { id: item.id },
      data: { position: item.position },
    });
  }
});
```
5. `auditLog.log({ action: 'REORDER', resource: 'content_block', resourceId: pageId, before: { positions: before }, after: { positions: items } })`
6. Return: `prisma.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' } })`

**Important**: The transaction contains `1 captureVersionInTx` + `N individual update calls` (one per block). For a page with 20 blocks, this is 20 UPDATE statements inside a single transaction. PostgreSQL handles this fine, but it's N round trips within the transaction. Could be optimized with a raw SQL UPDATE ... CASE ... WHEN.

**Prisma queries**:
```typescript
prisma.page.findFirst(...)  // assertPageOwnership
prisma.contentBlock.findMany({ where:{ pageId, deletedAt:null } })  // load current
// In transaction: captureVersionInTx (5 queries) + N contentBlock.update calls
prisma.contentBlock.findMany({ where:{ pageId, deletedAt:null }, orderBy:{position:'asc'} })  // final reload
```

---

#### Method: `updateVisibility(id, isVisible, actorId, actorRole, actorCompanyId)`

**Calls**:
1. `const before = await this.assertBlockOwnership(id, actorRole, actorCompanyId)`
2. Idempotency: `if (before.isVisible === isVisible) return { id, isVisible, changed: false }`
3. Transaction:
```typescript
await this.prisma.$transaction(async (tx) => {
  await this.versioningService.captureVersionInTx(tx, before.page.id, actorId);
  await tx.contentBlock.update({ where: { id }, data: { isVisible } });
});
```
4. `auditLog.log({ action: 'VISIBILITY_CHANGE', resource: 'content_block', before: { isVisible: !isVisible }, after: { isVisible } })`
5. Return `{ id, isVisible, changed: true }`

---

#### Method: `softDelete(id, actorId, actorRole, actorCompanyId)`

**Calls**:
1. `const before = await this.assertBlockOwnership(id, actorRole, actorCompanyId)`
2. `await this.prisma.contentBlock.update({ where: { id }, data: { deletedAt: new Date() } })`
3. `auditLog.log({ action: 'DELETE', resource: 'content_block', before: { type, position } })`
4. Return `{ deleted: true }`

**No version snapshot on delete**: Soft-deleted blocks are excluded from all subsequent `captureVersionInTx` calls (which filter `deletedAt: null`). If you rollback to a version taken before the delete, the block is recreated from the snapshot.

---

### ContentBlocks DTOs

#### `dto/create-content-block.dto.ts`

```typescript
enum BlockType {
  HERO = 'HERO',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  GALLERY = 'GALLERY',
  CTA = 'CTA',
  FEATURES = 'FEATURES',
  TESTIMONIALS = 'TESTIMONIALS',
  FAQ = 'FAQ',
  CUSTOM = 'CUSTOM',
}

export class CreateContentBlockDto {
  @IsString() @IsNotEmpty()
  pageId: string;

  @IsEnum(BlockType)
  type: BlockType;

  @IsObject()
  content: Record<string, unknown>;  // arbitrary JSON — validated for size/type in service

  @IsOptional() @IsInt() @Min(0)
  position?: number;  // auto-appended if omitted

  @IsOptional() @IsBoolean()
  isVisible?: boolean;  // default true
}
```

**Schema does NOT enforce content structure per block type**: A HERO block and a TEXT block both accept any `{ key: value }` object. Content structure validation is the responsibility of the frontend editor.

---

#### `dto/update-content-block.dto.ts`

```typescript
export class UpdateContentBlockDto {
  @IsOptional() @IsEnum(BlockType)
  type?: BlockType;

  @IsOptional() @IsObject()
  content?: Record<string, unknown>;
}
```

**`position` and `isVisible` are intentionally NOT in this DTO**. They have dedicated endpoints.

---

#### `dto/reorder-blocks.dto.ts`

```typescript
export class ReorderItemDto {
  @IsString() @IsNotEmpty()
  id: string;

  @IsInt() @Min(0)
  position: number;
}

export class ReorderBlocksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  blocks: ReorderItemDto[];
}
```

Client must send ALL blocks they want to reorder (partial reorder supported — only the IDs provided are updated).

---

#### `dto/visibility.dto.ts`

```typescript
export class VisibilityDto {
  @IsBoolean()
  isVisible: boolean;
}
```

---

## ContentBlocks Dependency Graph

```
ContentBlocksController
  │
  └─ ContentBlocksService
        ├─ PrismaService
        │     └─ contentBlock, page, tenant, company, product,
        │         pageVersion, seoSetting, auditLog tables
        ├─ AuditLogService
        └─ VersioningService
              └─ captureVersionInTx(tx, pageId, actorId)
```

---

# MODULE: Versioning

## Folder Tree

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

## File Details

### `versioning.module.ts`

**Location**: `apps/api/src/modules/versioning/versioning.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [VersioningService],
  controllers: [VersioningController],
  exports: [VersioningService],  // exported for PagesModule and ContentBlocksModule
})
```

**Who imports this module**: `AppModule`, `PagesModule`, `ContentBlocksModule`

---

### `versioning.controller.ts`

**Location**: `apps/api/src/modules/versioning/versioning.controller.ts`

**Routes** (no shared prefix — uses nested URL pattern):

#### `GET /pages/:pageId/versions`
```
@Roles('CONTENT_EDITOR')
@Get('pages/:pageId/versions')
getVersions(@Param('pageId') pageId, @CurrentUser() user)
```
- Returns version list WITHOUT snapshot data (metadata only — title, number, date, creator)
- Ordered: newest first

#### `POST /pages/:pageId/versions`
```
@Roles('CONTENT_EDITOR')
@Post('pages/:pageId/versions')
createVersion(@Param('pageId') pageId, @Body() dto: CreateVersionDto, @CurrentUser() user)
```
- Manual snapshot trigger
- `dto.reason` accepted but silently discarded (no column in schema)

#### `POST /pages/:pageId/rollback`
```
@Roles('CONTENT_EDITOR')
@Post('pages/:pageId/rollback')
@HttpCode(HttpStatus.OK)
rollback(@Param('pageId') pageId, @Body() dto: RollbackDto, @CurrentUser() user)
```
- Restores blocks + title from a version snapshot
- HARD DELETES current blocks before recreating from snapshot

#### `POST /pages/:pageId/restore`
```
@Roles('CONTENT_EDITOR')
@Post('pages/:pageId/restore')
@HttpCode(HttpStatus.OK)
restore(@Param('pageId') pageId, @Body() dto: RollbackDto, @CurrentUser() user)
```
- Same as rollback + also restores SEO from `seoSnapshot`

#### `GET /versions/:id`
```
@Roles('CONTENT_EDITOR')
@Get('versions/:id')
getVersion(@Param('id') id, @CurrentUser() user)
```
- Returns full version WITH `contentSnapshot` and `seoSnapshot`

#### `DELETE /versions/:id`
```
@Roles('SUPER_ADMIN')
@Delete('versions/:id')
deleteVersion(@Param('id') id, @CurrentUser() user)
```
- Permanently deletes a version record — irreversible
- SUPER_ADMIN only

---

### `versioning.service.ts`

**Location**: `apps/api/src/modules/versioning/versioning.service.ts`

**Purpose**: Version lifecycle — snapshot creation (called inside transactions by other services), manual version creation, rollback, restore, and hard delete of versions. The `captureVersionInTx` method is the most called method in the entire application.

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
```

**Exports**: `VersioningService` class

**Who calls this file**:
- `VersioningController` — getVersions, getVersion, createVersion, rollback, restore, deleteVersion
- `PagesService` — captureVersionInTx (via transaction in update, publish, unpublish)
- `ContentBlocksService` — captureVersionInTx (via transaction in update, reorder, updateVisibility)

**Database models used**: `PageVersion` (all CRUD), `Page` (read for ownership and snapshot data), `ContentBlock` (read for snapshot, deleteMany + create in rollback), `SeoSetting` (read for snapshot, upsert in restore), `Tenant`, `Company`, `Product` (ownership chain), `AuditLog` (create)

---

#### Private Method: `assertPageOwnership(pageId, actorRole, actorCompanyId)`

```typescript
private async assertPageOwnership(pageId: string, actorRole: string, actorCompanyId: string | null) {
  const page = await this.prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
    select: {
      id: true, tenantId: true, title: true,
      tenant: {
        select: {
          company: { select: { id: true } },
          product: { select: { companyId: true } },
        },
      },
    },
  });
  if (!page) throw new NotFoundException(`Page ${pageId} not found`);
  if (actorRole === 'SUPER_ADMIN') return page;

  const ownerCompanyId = page.tenant.company?.id ?? page.tenant.product?.companyId ?? null;
  if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();
  return page;
}
```

---

#### Private Method: `assertVersionOwnership(versionId, actorRole, actorCompanyId)`

```typescript
private async assertVersionOwnership(versionId: string, actorRole: string, actorCompanyId: string | null) {
  const version = await this.prisma.pageVersion.findUnique({
    where: { id: versionId },
    include: {
      page: {
        select: {
          id: true, tenantId: true,
          tenant: {
            select: {
              company: { select: { id: true } },
              product: { select: { companyId: true } },
            },
          },
        },
      },
    },
  });
  if (!version) throw new NotFoundException(`PageVersion ${versionId} not found`);
  if (actorRole === 'SUPER_ADMIN') return version;

  const ownerCompanyId = version.page.tenant.company?.id ?? version.page.tenant.product?.companyId ?? null;
  if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();
  return version;
}
```

---

#### Method: `captureVersionInTx(tx, pageId, actorId)` — PUBLIC, called inside transactions

**This is the most critical and most-called method in the application.**

**Input**: `tx: Prisma.TransactionClient`, `pageId: string`, `actorId: string`

**Output**: void (creates PageVersion record as a side effect)

**Called by**: `PagesService.update()`, `PagesService.publish()`, `PagesService.unpublish()`, `ContentBlocksService.update()`, `ContentBlocksService.reorder()`, `ContentBlocksService.updateVisibility()`, `VersioningService.createVersion()`, `VersioningService.rollback()`, `VersioningService.restore()`

**Calls**:
```typescript
async captureVersionInTx(tx: Prisma.TransactionClient, pageId: string, actorId: string): Promise<void> {
  // Parallel read of all current state within the same transaction
  const [page, blocks, seo, last] = await Promise.all([
    tx.page.findUnique({
      where: { id: pageId },
      select: { title: true, slug: true, locale: true, isPublished: true },
    }),
    tx.contentBlock.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { type: true, content: true, position: true, isVisible: true },
    }),
    tx.seoSetting.findUnique({
      where: { pageId },
      // All SEO fields
    }),
    tx.pageVersion.findFirst({
      where: { pageId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    }),
  ]);

  if (!page) return; // Page deleted mid-transaction — bail silently

  const versionNumber = (last?.versionNumber ?? 0) + 1;

  await tx.pageVersion.create({
    data: {
      pageId,
      versionNumber,
      title: page.title,
      contentSnapshot: blocks as Prisma.JsonArray,
      seoSnapshot: seo
        ? {
            metaTitle: seo.metaTitle,
            metaDescription: seo.metaDescription,
            keywords: seo.keywords,
            ogImage: seo.ogImage,
            ogTitle: seo.ogTitle,
            ogDescription: seo.ogDescription,
            twitterCard: seo.twitterCard,
            canonicalUrl: seo.canonicalUrl,
            noIndex: seo.noIndex,
          }
        : Prisma.DbNull,
      createdById: actorId,
    },
  });
}
```

**Why `Promise.all`**: The 4 reads are independent. Running them in parallel within the transaction reduces round-trip latency. All 4 see the same transaction snapshot (consistent view).

**`Prisma.DbNull` vs `null`**: When `seo` is null (no SEO record exists), `Prisma.DbNull` explicitly stores a PostgreSQL NULL in the JSON column, rather than JSON `null`. This distinction matters for filtering: `WHERE seo_snapshot IS NULL` vs `WHERE seo_snapshot = 'null'`.

**Versioning model**: Append-only. `versionNumber` is always incrementing — never reset, never reused. Rollback creates a NEW version (e.g., V6 = content of V3), it does NOT revert the version pointer.

---

#### Method: `getVersions(pageId, actorRole, actorCompanyId)`

**Calls**:
1. `this.assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.pageVersion.findMany({ where: { pageId }, orderBy: { versionNumber: 'desc' }, select: { id, pageId, versionNumber, title, createdAt, createdById, createdBy: { select: { id, firstName, lastName, email } } } })`

**Note**: `contentSnapshot` and `seoSnapshot` are EXCLUDED from list view. Full snapshots only available via `getVersion(id)`.

---

#### Method: `getVersion(versionId, actorRole, actorCompanyId)`

**Calls**:
1. `const version = await this.assertVersionOwnership(versionId, actorRole, actorCompanyId)` — loads full version
2. Return version (includes contentSnapshot and seoSnapshot from assertVersionOwnership's `findUnique`)

---

#### Method: `createVersion(pageId, actorId, actorRole, actorCompanyId)`

**Manual snapshot.**

**Calls**:
1. `this.assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `let newVersionNumber: number`
3. Transaction:
```typescript
await this.prisma.$transaction(async (tx) => {
  await this.captureVersionInTx(tx, pageId, actorId);
  // Read the version number that was just created
  const newVersion = await tx.pageVersion.findFirst({
    where: { pageId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });
  newVersionNumber = newVersion!.versionNumber;
});
```
4. `auditLog.log({ action: 'CREATE_VERSION', resource: 'page_version', resourceId: pageId, actorId })`
5. Return `{ versionNumber: newVersionNumber }`

---

#### Method: `rollback(pageId, versionId, actorId, actorRole, actorCompanyId)`

**Restores page content (blocks + title) from a historical snapshot. Creates a new version after restoration.**

**Calls**:
1. `this.assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `const target = await this.assertVersionOwnership(versionId, actorRole, actorCompanyId)`
3. Validate: `if (target.pageId !== pageId) throw new BadRequestException('Version does not belong to this page')`
4. Extract blocks: `const blocks = target.contentSnapshot as Array<Record<string, unknown>>`
5. Transaction:
```typescript
let newVersionNumber: number;
await this.prisma.$transaction(async (tx) => {
  // Step 1: HARD DELETE all current blocks (including soft-deleted ones)
  await tx.contentBlock.deleteMany({ where: { pageId } });

  // Step 2: Recreate blocks from snapshot
  for (const block of blocks) {
    await tx.contentBlock.create({
      data: {
        pageId,
        type: block.type as string,
        content: block.content as Prisma.JsonObject,
        position: block.position as number,
        isVisible: block.isVisible as boolean,
      },
    });
  }

  // Step 3: Restore page title
  await tx.page.update({
    where: { id: pageId },
    data: { title: target.title },
  });

  // Step 4: Snapshot the restored state (creates new version N+1)
  await this.captureVersionInTx(tx, pageId, actorId);

  // Step 5: Get the new version number
  const newVersion = await tx.pageVersion.findFirst({
    where: { pageId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });
  newVersionNumber = newVersion!.versionNumber;
});
```
6. `auditLog.log({ action: 'ROLLBACK', resource: 'page_version', before: { versionId }, after: { newVersionNumber } })`
7. Return `{ pageId, restoredFromVersion: target.versionNumber, newVersionNumber }`

**CRITICAL (BUG-005)**: Step 1 uses `deleteMany` with no `deletedAt` filter. This PERMANENTLY DESTROYS all ContentBlock records for the page, including blocks that had been soft-deleted. After rollback, the DB has no trace of those soft-deleted blocks.

**Rollback history example**:
```
V1: title="Home", blocks=[Hero, Text]
V2: title="Home 2", blocks=[Hero, Text, CTA]  (after adding CTA)
V3: title="Home 2", blocks=[Hero, Text]       (after deleting CTA — soft-deleted)
Rollback to V1:
  → DELETE all blocks (including soft-deleted CTA)
  → CREATE Hero, Text (from V1 snapshot)
  → UPDATE title = "Home"
  → captureVersionInTx → creates V4
V4: title="Home", blocks=[Hero, Text]
```

---

#### Method: `restore(pageId, versionId, actorId, actorRole, actorCompanyId)`

**Identical to `rollback()` with one additional step: SEO restoration.**

After step 3 (title restore) and before step 4 (captureVersionInTx):
```typescript
if (target.seoSnapshot && target.seoSnapshot !== Prisma.DbNull) {
  const seo = target.seoSnapshot as Record<string, unknown>;
  await tx.seoSetting.upsert({
    where: { pageId },
    create: { pageId, ...seoFields },
    update: { ...seoFields },
  });
  seoRestored = true;
}
```

Return: `{ pageId, restoredFromVersion, newVersionNumber, seoRestored: boolean }`

---

#### Method: `deleteVersion(versionId, actorId, actorRole)`

**SUPER_ADMIN only — irreversible.**

```typescript
async deleteVersion(versionId: string, actorId: string, actorRole: string) {
  if (actorRole !== 'SUPER_ADMIN') {
    throw new ForbiddenException('Only SUPER_ADMIN may delete version records');
  }
  // Note: actorRole check is IN the service, NOT just at controller level
  // This double-guards against controller misconfiguration

  const version = await this.prisma.pageVersion.findUnique({
    where: { id: versionId },
    select: { id, pageId, versionNumber, title },
  });
  if (!version) throw new NotFoundException();

  await this.prisma.pageVersion.delete({ where: { id: versionId } });
  await this.auditLogService.log({ action: 'DELETE_VERSION', resource: 'page_version', ... });
}
```

---

### Versioning DTOs

#### `dto/create-version.dto.ts`

```typescript
export class CreateVersionDto {
  @IsOptional() @IsString() @MaxLength(255)
  reason?: string;
  // Accepted by DTO, passed to service, silently discarded — no column in PageVersion model
}
```

#### `dto/rollback.dto.ts`

```typescript
export class RollbackDto {
  @IsString() @IsNotEmpty() @IsUUID()
  versionId: string;
}
```

---

## Versioning Dependency Graph

```
VersioningController
  │
  └─ VersioningService
        ├─ PrismaService
        │     └─ pageVersion, page, contentBlock, seoSetting, tenant,
        │         company, product, auditLog tables
        └─ AuditLogService

PagesService.update() ─────────┐
PagesService.publish() ────────┤  → all call captureVersionInTx(tx, pageId, actorId)
PagesService.unpublish() ──────┤     inside their own prisma.$transaction()
ContentBlocksService.update() ─┤
ContentBlocksService.reorder() ┤
ContentBlocksService.updateVisibility() ┘
```

---

## Versioning Runtime Flow: Rollback

```
POST /pages/:pageId/rollback { versionId }
  │
  1-3. Auth + Role guards (CONTENT_EDITOR+)
  │
  4. VersioningController.rollback(pageId, dto, user)
     └─ VersioningService.rollback(pageId, dto.versionId, user.id, user.role, user.companyId)
           │
           a. assertPageOwnership(pageId) → verifies page exists + caller can access
           │
           b. assertVersionOwnership(dto.versionId) → loads full version with snapshots
           │
           c. version.pageId !== pageId → 400 BadRequest (version mismatch)
           │
           d. prisma.$transaction(async tx => {
                │
                i.   tx.contentBlock.deleteMany({ where: { pageId } })
                     ← HARD DELETE, no filter, wipes soft-deleted blocks too
                │
                ii.  for each block in version.contentSnapshot:
                       tx.contentBlock.create({ pageId, type, content, position, isVisible })
                │
                iii. tx.page.update({ id: pageId, data: { title: version.title } })
                │
                iv.  captureVersionInTx(tx, pageId, actorId)
                       → Promise.all([page, blocks, seo, lastVersion])
                       → tx.pageVersion.create({ versionNumber: last+1, contentSnapshot: newBlocks })
                │
                v.   tx.pageVersion.findFirst({ pageId, orderBy:{versionNumber:'desc'} })
                       → captures new versionNumber
              })
           │
           e. auditLog.log({ action:'ROLLBACK', before:{versionId}, after:{newVersionNumber} })
           │
           f. RETURN { pageId, restoredFromVersion: target.versionNumber, newVersionNumber }
```

---

# MODULE: SEO

## Folder Tree

```
apps/api/src/modules/seo/
├── seo.module.ts
├── seo.controller.ts
├── seo.service.ts
└── dto/
    └── upsert-seo.dto.ts
```

---

## File Details

### `seo.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [SeoService],
  controllers: [SeoController],
  exports: [],
})
```

**Who imports this module**: `AppModule`

---

### `seo.controller.ts`

**Location**: `apps/api/src/modules/seo/seo.controller.ts`

**Routes**:

#### `GET /seo`
- `@Roles('CONTENT_EDITOR')`
- Returns all SEO records visible to actor

#### `GET /seo/page/:pageId`
- `@Roles('CONTENT_EDITOR')`
- Returns SEO for page, or null if none exists
- Does NOT throw 404 when SEO is missing

#### `GET /seo/page/:pageId/public`
- `@Public()` — no auth
- Used by SSR for `<head>` tag generation
- Requires page to be published

#### `PUT /seo/page/:pageId`
- `@Roles('CONTENT_EDITOR')`
- Body: `UpsertSeoDto` (all fields optional)
- Partial upsert — only fields present in body are written
- Returns the full SEO record after upsert

#### `DELETE /seo/page/:pageId`
- `@Roles('ADMIN')`
- Hard delete of SEO record (not soft delete)
- Idempotent — returns `{ removed: true, hadSeoSettings: false }` if no SEO existed

---

### `seo.service.ts`

**Location**: `apps/api/src/modules/seo/seo.service.ts`

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpsertSeoDto } from './dto/upsert-seo.dto';
```

**Database models used**: `SeoSetting` (read, upsert, delete), `Page` (read for ownership), `Tenant`, `Company`, `Product` (read for ownership chain)

---

#### Ownership constants

```typescript
const SEO_WITH_OWNER = {
  page: {
    select: {
      id: true, tenantId: true, slug: true, locale: true, isPublished: true, deletedAt: true,
      tenant: {
        select: {
          id: true, name: true, slug: true,
          company: { select: { id: true } },
          product: { select: { companyId: true } },
        },
      },
    },
  },
};

const SEO_LIST_INCLUDE = {
  page: {
    select: {
      id: true, slug: true, locale: true, tenantId: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  },
};
```

---

#### Private Method: `assertPageOwnership(pageId, actorRole, actorCompanyId)`

Same ownership check pattern as Pages. Loads page + tenant chain, SUPER_ADMIN bypass, throws ForbiddenException if company mismatch.

---

#### Method: `findAll(actorRole, actorCompanyId)`

```typescript
if (actorRole === 'SUPER_ADMIN') {
  return prisma.seoSetting.findMany({ include: SEO_LIST_INCLUDE });
}

return prisma.seoSetting.findMany({
  where: {
    page: {
      deletedAt: null,
      tenant: {
        OR: [
          { company: { id: actorCompanyId } },
          { product: { companyId: actorCompanyId } },
        ],
      },
    },
  },
  include: SEO_LIST_INCLUDE,
});
```

---

#### Method: `findByPage(pageId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. `prisma.seoSetting.findUnique({ where: { pageId }, include: SEO_WITH_OWNER })`
3. Returns null if no record (not an error)

---

#### Method: `findByPagePublic(pageId)`

```typescript
const page = await this.prisma.page.findFirst({
  where: { id: pageId, isPublished: true, deletedAt: null },
  select: { id: true },
});
if (!page) throw new NotFoundException('Page not found or not published');
return this.prisma.seoSetting.findUnique({ where: { pageId } });
// Returns null if page exists but has no SEO record
```

---

#### Method: `upsert(pageId, dto, actorId, actorRole, actorCompanyId)`

**Partial upsert** — only writes fields that are present in `dto`.

```typescript
const existing = await this.prisma.seoSetting.findUnique({ where: { pageId } });

const result = await this.prisma.seoSetting.upsert({
  where: { pageId },
  create: {
    pageId,
    metaTitle: dto.metaTitle,
    metaDescription: dto.metaDescription,
    keywords: dto.keywords ?? [],
    ogImage: dto.ogImage,
    ogTitle: dto.ogTitle,
    ogDescription: dto.ogDescription,
    twitterCard: dto.twitterCard,
    canonicalUrl: dto.canonicalUrl,
    noIndex: dto.noIndex ?? false,
  },
  update: {
    ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
    ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
    ...(dto.keywords !== undefined && { keywords: dto.keywords }),
    ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
    ...(dto.ogTitle !== undefined && { ogTitle: dto.ogTitle }),
    ...(dto.ogDescription !== undefined && { ogDescription: dto.ogDescription }),
    ...(dto.twitterCard !== undefined && { twitterCard: dto.twitterCard }),
    ...(dto.canonicalUrl !== undefined && { canonicalUrl: dto.canonicalUrl }),
    ...(dto.noIndex !== undefined && { noIndex: dto.noIndex }),
  },
});

await this.auditLogService.log({
  action: existing ? 'UPDATE' : 'CREATE',
  resource: 'seo_setting',
  resourceId: pageId,
  before: existing ? { ...existing } : undefined,
  after: { ...result },
});

return result;
```

**Important**: On UPDATE, only `dto` fields that are explicitly present are written. A field of `undefined` means "don't change this field". A field of `null` means "clear this field" (if the column is nullable). This allows partial SEO updates without overwriting unspecified fields.

---

#### Method: `remove(pageId, actorId, actorRole, actorCompanyId)`

1. `assertPageOwnership(pageId, actorRole, actorCompanyId)`
2. Check existence: `prisma.seoSetting.findUnique({ where: { pageId } })`
3. If not found → `return { removed: true, hadSeoSettings: false }` (idempotent)
4. `prisma.seoSetting.delete({ where: { pageId } })` — hard delete
5. `auditLog.log({ action: 'DELETE', resource: 'seo_setting', before })`
6. Return `{ removed: true, hadSeoSettings: true }`

---

### `dto/upsert-seo.dto.ts`

```typescript
export class UpsertSeoDto {
  @IsOptional() @IsString() @MaxLength(70)
  metaTitle?: string;               // Google title: max 60-70 chars

  @IsOptional() @IsString() @MaxLength(160)
  metaDescription?: string;         // Google snippet: max 155-160 chars

  @IsOptional() @IsArray() @IsString({ each: true })
  keywords?: string[];

  @IsOptional() @IsUrl()
  ogImage?: string;                 // Open Graph image URL

  @IsOptional() @IsString() @MaxLength(70)
  ogTitle?: string;

  @IsOptional() @IsString() @MaxLength(200)
  ogDescription?: string;

  @IsOptional() @IsString()
  twitterCard?: string;             // e.g. 'summary', 'summary_large_image'

  @IsOptional() @IsUrl()
  canonicalUrl?: string;

  @IsOptional() @IsBoolean()
  noIndex?: boolean;                // true = add <meta name="robots" content="noindex">
}
```

---

# MODULE: Branding

## Folder Tree

```
apps/api/src/modules/branding/
├── branding.module.ts
├── branding.controller.ts
├── branding.service.ts
└── dto/
    └── upsert-branding.dto.ts
```

---

## File Details

### `branding.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [BrandingService],
  controllers: [BrandingController],
  exports: [],
})
```

---

### `branding.controller.ts`

**Location**: `apps/api/src/modules/branding/branding.controller.ts`

**Routes**:

#### `GET /branding`
- `@Roles('PRODUCT_MANAGER')` — higher minimum than CMS routes
- Returns all branding records visible to actor

#### `GET /branding/tenant/:tenantId`
- `@Roles('PRODUCT_MANAGER')`
- Returns branding for tenant, or null

#### `PUT /branding/tenant/:tenantId`
- `@Roles('PRODUCT_MANAGER')`
- Body: `UpsertBrandingDto` (all optional)
- Partial upsert

#### `DELETE /branding/tenant/:tenantId`
- `@Roles('ADMIN')` — higher than PUT
- Hard delete (reset branding to defaults)

---

### `branding.service.ts`

**Location**: `apps/api/src/modules/branding/branding.service.ts`

**Database models used**: `Branding` (read, upsert, delete), `Tenant` (ownership chain), `Company`, `Product`

---

#### Method: `findAll(actorRole, actorCompanyId)`

```typescript
if (actorRole === 'SUPER_ADMIN') {
  return prisma.branding.findMany({ include: { tenant: true } });
}

return prisma.branding.findMany({
  where: {
    tenant: {
      OR: [
        { company: { id: actorCompanyId } },
        { product: { companyId: actorCompanyId } },
      ],
    },
  },
  include: { tenant: true },
});
```

---

#### Method: `findByTenant(tenantId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. `prisma.branding.findUnique({ where: { tenantId }, include: { tenant: { select: { id, name, slug } } } })`
3. Returns null if no branding

---

#### Method: `upsert(tenantId, dto, actorId, actorRole, actorCompanyId)`

```typescript
const existing = await this.prisma.branding.findUnique({ where: { tenantId } });

const result = await this.prisma.branding.upsert({
  where: { tenantId },
  create: {
    tenantId,
    logoUrl: dto.logoUrl,
    faviconUrl: dto.faviconUrl,
    primaryColor: dto.primaryColor,
    secondaryColor: dto.secondaryColor,
    accentColor: dto.accentColor,
    fontHeading: dto.fontHeading,
    fontBody: dto.fontBody,
    themePreset: dto.themePreset,
    customCss: dto.customCss,
    config: dto.config ?? Prisma.DbNull,
  },
  update: {
    ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
    ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
    ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
    ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
    ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
    ...(dto.fontHeading !== undefined && { fontHeading: dto.fontHeading }),
    ...(dto.fontBody !== undefined && { fontBody: dto.fontBody }),
    ...(dto.themePreset !== undefined && { themePreset: dto.themePreset }),
    ...(dto.customCss !== undefined && { customCss: dto.customCss }),
    ...(dto.config !== undefined && { config: dto.config }),
  },
});

auditLog.log({ action: existing ? 'UPDATE' : 'CREATE', resource: 'branding', before: existing, after: result });
return result;
```

---

#### Method: `reset(tenantId, actorId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(tenantId, actorRole, actorCompanyId)`
2. Check existence
3. If not found → `{ reset: true, hadBranding: false }`
4. `prisma.branding.delete({ where: { tenantId } })` — hard delete
5. `auditLog.log({ action: 'DELETE', resource: 'branding', before: existingBranding })`
6. Return `{ reset: true, hadBranding: true }`

**Cache invalidation gap**: TenantService cache is NOT invalidated after branding reset. Cached tenant contexts will contain the old branding for up to 60 seconds.

---

### `dto/upsert-branding.dto.ts`

```typescript
export class UpsertBrandingDto {
  @IsOptional() @IsUrl()
  logoUrl?: string;

  @IsOptional() @IsUrl()
  faviconUrl?: string;

  @IsOptional() @IsString()
  primaryColor?: string;     // e.g. '#1A73E8' — no hex format validation

  @IsOptional() @IsString()
  secondaryColor?: string;   // any string accepted

  @IsOptional() @IsString()
  accentColor?: string;

  @IsOptional() @IsString()
  fontHeading?: string;      // e.g. 'Inter', 'Roboto'

  @IsOptional() @IsString()
  fontBody?: string;

  @IsOptional() @IsString()
  themePreset?: string;      // e.g. 'default', 'dark', 'minimal'

  @IsOptional() @IsString()
  customCss?: string;        // raw CSS injected into <style> tag — XSS risk if rendered unsanitized

  @IsOptional() @IsObject()
  config?: Record<string, unknown>;
}
```

**Security note on `customCss`**: This field stores raw CSS string. If the frontend renders `customCss` into a `<style>` tag without sanitization, it could contain CSS injection (e.g., `background: url(data:...)`) but CSS alone cannot execute JavaScript. Markdown injection is not possible. Risk is limited to visual defacement.

---

## CMS Dependency Graph (All Modules)

```
apps/web (Next.js SSR)
  │
  ├─ GET /pages/public/:tenantId/:locale/:slug
  │     └─ PagesService.findBySlug()
  └─ GET /seo/page/:pageId/public
        └─ SeoService.findByPagePublic()

apps/admin (Next.js admin)
  │
  ├─ Pages CRUD → PagesController → PagesService
  ├─ ContentBlocks CRUD → ContentBlocksController → ContentBlocksService
  ├─ SEO → SeoController → SeoService
  ├─ Branding → BrandingController → BrandingService
  └─ Versions → VersioningController → VersioningService

All CMS mutations:
  service.method()
    └─ prisma.$transaction(async tx => {
          captureVersionInTx(tx, pageId, actorId)  ← VersioningService
            └─ tx.pageVersion.create(snapshot)
          actual_mutation(tx)
       })
    └─ auditLogService.log(event)                  ← AuditLogService
```
