# 09D — DETAILED DATABASE USAGE
## Prisma Schema, All Models, All Queries Per Service, Write Map, Read Map

---

# Prisma Configuration

**Schema location**: `apps/api/prisma/schema.prisma`

**Generator**:
```prisma
generator client {
  provider = "prisma-client-js"
}
```

**Datasource**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Database**: PostgreSQL 16

**Migration history location**: `apps/api/prisma/migrations/`

**Manual migration** (not tracked by Prisma): `apps/api/prisma/migrations/manual/partial_unique_indexes.sql`

---

# All Prisma Models

## Model: `Tenant`

```prisma
model Tenant {
  id          String    @id @default(uuid())
  name        String
  slug        String    @unique
  plan        String    @default("STARTER")
  isActive    Boolean   @default(true)
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Ownership relations (one of these is set, the other is null)
  companyId   String?
  company     Company?  @relation(fields: [companyId], references: [id])
  productId   String?
  product     Product?  @relation(fields: [productId], references: [id])

  // Child relations
  domains       Domain[]
  pages         Page[]
  featureFlags  FeatureFlag[]
  branding      Branding?
  users         User[]

  @@map("tenants")
}
```

**Key design decisions**:
- `slug` is globally unique across all tenants — no two tenants can have the same slug
- Either `companyId` OR `productId` is set (not both). If `companyId` is set, this is a holding tenant. If `productId` is set, this is a product tenant.
- `plan` is a plain string, not an enum — values: `'STARTER'`, `'PRO'`, `'ENTERPRISE'`
- Soft delete via `deletedAt`

**Read by**: `TenantService.resolveFromDomain()` (via Domain include), `TenantService.findAll/findById()`, all ownership assertion methods across all services, `CompaniesService.create()` (not directly), `AuditLogService.findByTenant()` (ownership check)

**Written by**: `TenantService.create()`, `TenantService.update()`, `TenantService.softDelete()`, `CompaniesService.create()` (creates holding tenant), `ProductsService.create()` (creates product tenant)

---

## Model: `Company`

```prisma
model Company {
  id          String    @id @default(uuid())
  name        String
  slug        String    @unique
  description String?
  logoUrl     String?
  websiteUrl  String?
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Child relations
  tenants   Tenant[]
  products  Product[]
  users     User[]

  @@map("companies")
}
```

**Key design decisions**:
- `slug` globally unique — no two companies can share a slug
- Soft delete via `deletedAt`
- No `isActive` field — use `deletedAt` to determine state

**Read by**: `CompaniesService` (all methods), ownership chain traversal in `TenantService`, `ProductsService`, `DomainsService`, `PagesService`, `ContentBlocksService`, `SeoService`, `BrandingService`, `VersioningService`, `FeatureFlagsService`, `SettingsService`, `RolesService`, `UsersService`

**Written by**: `CompaniesService.create()`, `CompaniesService.update()`, `CompaniesService.softDelete()`

---

## Model: `Product`

```prisma
model Product {
  id          String        @id @default(uuid())
  name        String
  slug        String
  description String?
  logoUrl     String?
  status      ProductStatus @default(DRAFT)
  companyId   String
  company     Company       @relation(fields: [companyId], references: [id])
  deletedAt   DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Child relations
  tenants  Tenant[]

  @@unique([slug, companyId])   // slug unique per company (not globally)
  @@map("products")
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}
```

**Key design decisions**:
- `slug` is unique within a company (`@@unique([slug, companyId])`) — different companies can have products with the same slug
- `status` lifecycle: `DRAFT → ACTIVE → ARCHIVED`
- Each product has its own Tenant (created automatically by `ProductsService.create()`)

**Read by**: `ProductsService`, ownership chain traversal via `Tenant.productId`

**Written by**: `ProductsService.create()`, `ProductsService.update()`, `ProductsService.softDelete()`, `ProductsService.updateStatus()`

---

## Model: `Domain`

```prisma
model Domain {
  id           String     @id @default(uuid())
  name         String     @unique    // globally unique — no two domains can point to different tenants
  type         DomainType @default(PRIMARY)
  targetDomain String?               // only for REDIRECT type
  isVerified   Boolean    @default(false)
  verifiedAt   DateTime?
  tenantId     String
  tenant       Tenant     @relation(fields: [tenantId], references: [id])
  deletedAt    DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@map("domains")
}

enum DomainType {
  PRIMARY
  SECONDARY
  REDIRECT
}
```

**Key design decisions**:
- `name` globally unique — a hostname can only map to one tenant
- Hard delete by `DomainsService.remove()` (no cascade issue since Tenant is parent, not child)
- `deletedAt` exists for soft-filtering in domain queries but `remove()` uses hard delete

**Read by**: `TenantService.resolveFromDomain()` — most critical read path (every request on cache miss), `DomainsService` (all methods)

**Written by**: `DomainsService.create()`, `DomainsService.update()`, `DomainsService.verify()`, `DomainsService.remove()` (hard delete)

---

## Model: `Page`

```prisma
model Page {
  id             String    @id @default(uuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  slug           String
  title          String
  locale         String    @default("tr")
  isPublished    Boolean   @default(false)
  currentVersion Int       @default(1)   // vestigial — never updated after create
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Child relations
  contentBlocks ContentBlock[]
  seoSetting    SeoSetting?
  versions      PageVersion[]

  @@unique([slug, tenantId, locale])    // slug unique per tenant per locale
  @@map("pages")
}
```

**Key design decisions**:
- `@@unique([slug, tenantId, locale])` — same slug can exist in different locales (tr/en) or different tenants
- `currentVersion` is set to 1 on create and never updated (DEBT-007) — version count must be derived from `PageVersion` table
- Soft delete via `deletedAt`
- `ContentBlock` relation has `onDelete: Cascade` in Prisma — but cascade only triggers on hard deletes, not soft deletes

**Read by**: `PagesService` (all methods), `ContentBlocksService.assertPageOwnership()`, `SeoService.assertPageOwnership()`, `BrandingService` (not directly, via tenant), `VersioningService.assertPageOwnership()`, `captureVersionInTx()`

**Written by**: `PagesService.create()`, `PagesService.update()`, `PagesService.publish()`, `PagesService.unpublish()`, `PagesService.softDelete()`, `VersioningService.rollback()` (title update), `VersioningService.restore()` (title update)

---

## Model: `ContentBlock`

```prisma
model ContentBlock {
  id        String    @id @default(uuid())
  pageId    String
  page      Page      @relation(fields: [pageId], references: [id], onDelete: Cascade)
  type      BlockType
  content   Json
  position  Int
  isVisible Boolean   @default(true)
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("content_blocks")
}

enum BlockType {
  HERO
  TEXT
  IMAGE
  GALLERY
  CTA
  FEATURES
  TESTIMONIALS
  FAQ
  CUSTOM
}
```

**Key design decisions**:
- `content` is a JSON column — arbitrary structure per block type. No schema enforcement at DB level.
- `position` is an integer — ordering is done by position ASC. Positions can have gaps (e.g., 0, 1, 5, 10). Reorder sets exact positions from the client.
- `isVisible` controls public visibility — invisible blocks are excluded from `findBySlug()` but included in admin `findByPage()`
- `onDelete: Cascade` — if Page is hard-deleted, all blocks are cascade-deleted. Soft-deleting Page does NOT cascade.
- `deletedAt` — soft delete. Soft-deleted blocks are excluded from snapshots and admin views but remain in DB.
- Hard-deleted during rollback/restore operations

**Read by**: `ContentBlocksService` (all methods), `PagesService.findById()` (included), `PagesService.findBySlug()` (included, isVisible filter), `captureVersionInTx()` (read for snapshot)

**Written by**: `ContentBlocksService.create()`, `ContentBlocksService.update()`, `ContentBlocksService.reorder()`, `ContentBlocksService.updateVisibility()`, `ContentBlocksService.softDelete()`, `VersioningService.rollback()` (deleteMany + create), `VersioningService.restore()` (deleteMany + create)

---

## Model: `PageVersion`

```prisma
model PageVersion {
  id              String   @id @default(uuid())
  pageId          String
  page            Page     @relation(fields: [pageId], references: [id])
  versionNumber   Int
  title           String
  contentSnapshot Json     // Array of { type, content, position, isVisible }
  seoSnapshot     Json?    // SeoSetting fields snapshot, or null
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])
  createdAt       DateTime @default(now())

  @@unique([pageId, versionNumber])
  @@map("page_versions")
}
```

**Key design decisions**:
- `contentSnapshot` stores the full block array as JSON — not a foreign key reference. Snapshot is immutable after creation.
- `seoSnapshot` is nullable — null means SEO was not captured (or did not exist at snapshot time). Uses `Prisma.DbNull` for DB NULL (not JSON null).
- `@@unique([pageId, versionNumber])` — version numbers are unique per page
- No `updatedAt` — versions are immutable once created
- Hard-deleted by `VersioningService.deleteVersion()` (SUPER_ADMIN only)
- No `deletedAt` — versions are either present or hard-deleted

**`contentSnapshot` structure** (stored JSON array):
```json
[
  {
    "type": "HERO",
    "content": { "title": "Welcome", "subtitle": "..." },
    "position": 0,
    "isVisible": true
  },
  {
    "type": "TEXT",
    "content": { "body": "<p>...</p>" },
    "position": 1,
    "isVisible": true
  }
]
```

**`seoSnapshot` structure** (stored JSON object or DB NULL):
```json
{
  "metaTitle": "Page Title",
  "metaDescription": "Description...",
  "keywords": ["keyword1", "keyword2"],
  "ogImage": "https://...",
  "ogTitle": null,
  "ogDescription": null,
  "twitterCard": "summary",
  "canonicalUrl": null,
  "noIndex": false
}
```

**Missing indexes (DEBT-015)**:
- No index on `pageId` — `findFirst({ where: { pageId }, orderBy: { versionNumber: 'desc' } })` does full table scan
- Recommended: `@@index([pageId, versionNumber(sort: Desc)])`

**Read by**: `VersioningService.getVersions()`, `VersioningService.getVersion()`, `VersioningService.createVersion()` (post-create read), `PagesService.findById()` (last 10 included), `captureVersionInTx()` (reads last version number)

**Written by**: `captureVersionInTx()` (called by all CMS mutations), `VersioningService.createVersion()`, `VersioningService.deleteVersion()` (hard delete)

---

## Model: `SeoSetting`

```prisma
model SeoSetting {
  id              String   @id @default(uuid())
  pageId          String   @unique     // one-to-one with Page
  page            Page     @relation(fields: [pageId], references: [id])
  metaTitle       String?
  metaDescription String?
  keywords        String[] @default([])
  ogImage         String?
  ogTitle         String?
  ogDescription   String?
  twitterCard     String?
  canonicalUrl    String?
  noIndex         Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("seo_settings")
}
```

**Key design decisions**:
- One-to-one with Page (via `@unique` on `pageId`)
- All fields optional — a page can have a SeoSetting with all null fields (empty SEO)
- No soft delete — `SeoService.remove()` hard-deletes the record
- `keywords` is a PostgreSQL text array (`String[]`) — not a JSON column

**Read by**: `SeoService` (all methods), `PagesService.findByTenant()` (seoSetting include), `PagesService.findById()` (seoSetting include), `PagesService.findBySlug()` (seoSetting include), `captureVersionInTx()` (read for seoSnapshot)

**Written by**: `SeoService.upsert()`, `SeoService.remove()` (hard delete), `VersioningService.restore()` (upsert from seoSnapshot)

---

## Model: `Branding`

```prisma
model Branding {
  id              String   @id @default(uuid())
  tenantId        String   @unique     // one-to-one with Tenant
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  logoUrl         String?
  faviconUrl      String?
  primaryColor    String?
  secondaryColor  String?
  accentColor     String?
  fontHeading     String?
  fontBody        String?
  themePreset     String?
  customCss       String?
  config          Json?    // arbitrary extra config
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("branding")
}
```

**Key design decisions**:
- One-to-one with Tenant
- All style fields optional — can have branding record with only some fields filled
- `config` is a JSON column for future extensibility
- No soft delete — `BrandingService.reset()` hard-deletes the record
- Loaded into `TenantContext` by `TenantService.resolveFromDomain()` and cached

**Read by**: `BrandingService` (all methods), `TenantService.resolveFromDomain()` (included in tenant query)

**Written by**: `BrandingService.upsert()`, `BrandingService.reset()` (hard delete)

---

## Model: `User`

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  firstName    String
  lastName     String
  role         UserRole  @default(VIEWER)
  isActive     Boolean   @default(true)
  companyId    String?
  company      Company?  @relation(fields: [companyId], references: [id])
  tenantId     String?
  tenant       Tenant?   @relation(fields: [tenantId], references: [id])
  lastLoginAt  DateTime?
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  // Child relations
  refreshTokens  RefreshToken[]
  permissions    Permission[]
  pageVersions   PageVersion[]   // versions created by this user
  notifications  Notification[]

  @@map("users")
}

enum UserRole {
  VIEWER
  CONTENT_EDITOR
  PRODUCT_MANAGER
  ADMIN
  SUPER_ADMIN
}
```

**Key design decisions**:
- `email` globally unique (no per-company scoping)
- `passwordHash` is NEVER included in SELECT queries — `USER_SELECT` constant explicitly excludes it
- `role` is a PostgreSQL enum — stored as string in DB, typed as enum in Prisma
- `companyId` is the primary scoping field — all service ownership checks compare actor's `companyId` with resource's owning company
- `tenantId` exists but is rarely used in authorization logic — `companyId` is the primary access control dimension
- Soft delete via `deletedAt`

**Read by**: `UsersService` (all methods), `JwtStrategy.validate()` (via `UsersService.findById()`), `AuditLogService.findByResource()` (via createdBy include on PageVersion), `RolesService` (via permission lookup)

**Written by**: `UsersService.create()`, `UsersService.update()`, `UsersService.changePassword()`, `UsersService.assignRole()`, `UsersService.setActive()`, `UsersService.softDelete()`, `AuthService.login()` (updates lastLoginAt)

---

## Model: `RefreshToken`

```prisma
model RefreshToken {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  tokenHash   String   // argon2 hash of the raw refresh token JWT
  isRevoked   Boolean  @default(false)
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@map("refresh_tokens")
}
```

**Key design decisions**:
- Stores the argon2 HASH of the refresh token, not the token itself — even if DB is breached, tokens cannot be replayed without the original JWT
- `isRevoked` flag — tokens are not deleted on revocation, they are soft-flagged. This preserves audit history.
- `expiresAt` is always `now + 7 days` (hardcoded in `AuthService.signTokenPair()`) regardless of `JWT_REFRESH_EXPIRY` config
- Multiple active tokens per user are possible (one per device/session)
- No compound index on `(userId, isRevoked)` — `findFirst({ where: { userId, isRevoked: false } })` is a filtered scan

**Missing index (DEBT-015)**: `@@index([userId, isRevoked])` would speed up token lookup and revocation

**Read by**: `AuthService.refresh()` — loads token for hash verification, `AuthService.logout()` — loads all active tokens for revocation

**Written by**: `AuthService.signTokenPair()` (create), `AuthService.refresh()` (revoke old, create new), `AuthService.logout()` (revoke all for user), `UsersService.softDelete()` (revoke all for deleted user), `UsersService.changePassword()` (revoke all — security measure)

---

## Model: `Permission`

```prisma
model Permission {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  resource  String   // e.g. 'page', 'branding', 'user'
  action    String   // e.g. 'read', 'write', 'delete', 'publish'
  scope     String?  // e.g. 'own', 'company', 'global'
  createdAt DateTime @default(now())

  @@unique([userId, resource, action])
  @@map("permissions")
}
```

**Key design decisions**:
- `@@unique([userId, resource, action])` — a user can only have one permission entry per resource+action pair
- `scope` is free-text — not an enum, not validated
- **Runtime enforcement: NONE** — `RolesGuard` does not read this table. Permission records are stored but never checked. (DEBT-005)

**Read by**: `RolesService.getPermissions()`

**Written by**: `RolesService.setPermission()` (upsert), `RolesService.removePermission()` (delete)

---

## Model: `FeatureFlag`

```prisma
model FeatureFlag {
  id           String   @id @default(uuid())
  key          String
  description  String?
  isEnabled    Boolean  @default(false)
  defaultValue Json?    // arbitrary config value
  tenantId     String?
  tenant       Tenant?  @relation(fields: [tenantId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([key, tenantId])  // does NOT prevent duplicate global flags (NULL != NULL in PostgreSQL)
  @@map("feature_flags")
}
```

**Key design decisions**:
- `tenantId = null` means global flag (applies to all tenants as default)
- `tenantId = <id>` means tenant-specific override
- `@@unique([key, tenantId])` DOES NOT prevent `(key='x', tenantId=NULL)` duplicates due to PostgreSQL NULL semantics (DEBT-001)
- `defaultValue` is a JSON column — can store any config object

**Manual SQL required** (`partial_unique_indexes.sql`):
```sql
CREATE UNIQUE INDEX feature_flags_key_global_unique
  ON feature_flags (key)
  WHERE tenant_id IS NULL;
```

**Merge logic in `TenantService.resolveFromDomain()`**:
1. Load all global flags (`tenantId = null`)
2. Load tenant-specific flags (already in Tenant include)
3. Build Map keyed by flag.key — tenant-specific overwrites global
4. Merged result cached in TenantContext

**Read by**: `FeatureFlagsService` (all methods), `TenantService.resolveFromDomain()` (global flags query + tenant include)

**Written by**: `FeatureFlagsService.create()`, `FeatureFlagsService.update()`, `FeatureFlagsService.toggle()`, `FeatureFlagsService.remove()` (hard delete)

---

## Model: `SystemSetting`

```prisma
model SystemSetting {
  id          String   @id @default(uuid())
  key         String
  value       Json     // any JSON value (string, number, boolean, object, array)
  description String?
  isPublic    Boolean  @default(false)
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([key, tenantId])  // same NULL semantics issue as FeatureFlag
  @@map("system_settings")
}
```

**Key design decisions**: Structurally identical to `FeatureFlag` for global/tenant scoping. Key difference: Settings store `value` (any JSON), Flags store `isEnabled` (boolean) + `defaultValue`.

**`isPublic` field**: Intended for settings that can be returned without authentication (e.g., public site config). Not currently used by any route — no `@Public()` settings endpoint exists.

**Manual SQL required**:
```sql
CREATE UNIQUE INDEX system_settings_key_global_unique
  ON system_settings (key)
  WHERE tenant_id IS NULL;
```

**Read by**: `SettingsService` (all methods)

**Written by**: `SettingsService.create()`, `SettingsService.update()`, `SettingsService.remove()` (hard delete)

---

## Model: `AuditLog`

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  action     String   // 'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'LOGIN', etc.
  resource   String   // 'page', 'user', 'company', 'feature_flag', etc.
  resourceId String?
  actorId    String?  // null for system-generated events
  tenantId   String?  // null for global events (login, company create)
  before     Json?    // state before mutation
  after      Json?    // state after mutation
  metadata   Json?    // additional context
  createdAt  DateTime @default(now())

  @@map("audit_logs")
}
```

**Key design decisions**:
- Immutable — no `updatedAt`, no soft delete, no hard delete via API (SUPER_ADMIN has no delete route)
- All JSON fields stored as `Prisma.DbNull` when null (not JSON null)
- No foreign keys to other tables — `actorId` and `resourceId` are plain strings, not FK relations. This prevents audit log from being affected by cascades.
- No partitioning or archival strategy — will grow unboundedly

**Missing indexes (DEBT-014)**:
```sql
-- Needed for findByTenant() — table scan without this
CREATE INDEX audit_logs_tenant_id_idx ON audit_logs (tenant_id);
-- Needed for ordering in findAll()
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC);
-- Needed for findByResource()
CREATE INDEX audit_logs_resource_resource_id_idx ON audit_logs (resource, resource_id);
```

**Prisma schema additions needed**:
```prisma
@@index([tenantId])
@@index([createdAt(sort: Desc)])
@@index([resource, resourceId])
```

**Read by**: `AuditLogService.findAll()`, `AuditLogService.findByTenant()`, `AuditLogService.findByResource()`

**Written by**: `AuditLogService.log()` — called by all 14 service modules

---

## Model: `ActivityLog`

```prisma
model ActivityLog {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String
  resource   String
  resourceId String?
  tenantId   String?
  metadata   Json?
  createdAt  DateTime @default(now())

  @@map("activity_logs")
}
```

**Status**: Schema defined, table exists in DB, but `ActivityLogService` is never called by any code. Records are never written.

**Distinction from AuditLog**: ActivityLog has a `userId` FK relation (user-centric), AuditLog is resource-centric with no FK.

---

## Model: `Notification`

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  title     String
  body      String
  isRead    Boolean  @default(false)
  metadata  Json?
  createdAt DateTime @default(now())

  @@map("notifications")
}
```

**Status**: Schema defined, `NotificationsService.send()` writes to this table, but no delivery mechanism exists. No read endpoint. Records accumulate unread.

---

## Model: `McpProvider`

```prisma
model McpProvider {
  id          String   @id @default(uuid())
  name        String
  type        String   // 'openai', 'anthropic', 'azure', etc.
  config      Json     // API keys, endpoints
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  connections McpConnection[]

  @@map("mcp_providers")
}
```

**Status**: Never written to (McpService is a stub).

---

## Model: `McpConnection`

```prisma
model McpConnection {
  id         String      @id @default(uuid())
  providerId String
  provider   McpProvider @relation(fields: [providerId], references: [id])
  tenantId   String
  tenant     Tenant      @relation(fields: [tenantId], references: [id])
  settings   Json
  isActive   Boolean     @default(true)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  agents AiAgent[]

  @@map("mcp_connections")
}
```

---

## Model: `AiAgent`

```prisma
model AiAgent {
  id           String        @id @default(uuid())
  name         String
  description  String?
  connectionId String
  connection   McpConnection @relation(fields: [connectionId], references: [id])
  config       Json
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  permissions AgentPermission[]
  auditLogs   AgentAuditLog[]
  workflows   WorkflowDefinition[]

  @@map("ai_agents")
}
```

---

## Model: `AgentPermission`

```prisma
model AgentPermission {
  id        String   @id @default(uuid())
  agentId   String
  agent     AiAgent  @relation(fields: [agentId], references: [id])
  resource  String
  action    String
  createdAt DateTime @default(now())

  @@unique([agentId, resource, action])
  @@map("agent_permissions")
}
```

---

## Model: `WorkflowDefinition`

```prisma
model WorkflowDefinition {
  id          String   @id @default(uuid())
  agentId     String
  agent       AiAgent  @relation(fields: [agentId], references: [id])
  name        String
  description String?
  steps       Json     // workflow step definitions
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("workflow_definitions")
}
```

---

## Model: `AgentAuditLog`

```prisma
model AgentAuditLog {
  id        String   @id @default(uuid())
  agentId   String
  agent     AiAgent  @relation(fields: [agentId], references: [id])
  action    String
  resource  String
  before    Json?
  after     Json?
  createdAt DateTime @default(now())

  @@map("agent_audit_logs")
}
```

---

# Complete Database Write Map

## Per-Service Prisma Write Operations

### AuthService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `login()` | `User` | `update` | `lastLoginAt` |
| `signTokenPair()` | `RefreshToken` | `create` | `userId, tokenHash, expiresAt, isRevoked=false` |
| `refresh()` | `RefreshToken` | `update` | `isRevoked=true` (old token) |
| `refresh()` → `signTokenPair()` | `RefreshToken` | `create` | new token pair |
| `logout()` | `RefreshToken` | `updateMany` | `isRevoked=true` (all user tokens) |

### UsersService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `User` | `create` | `email, passwordHash, firstName, lastName, role, companyId, isActive=true` |
| `update()` | `User` | `update` | `firstName?, lastName?, isActive?` |
| `changePassword()` | `User` | `update` | `passwordHash` |
| `changePassword()` | `RefreshToken` | `updateMany` | `isRevoked=true` |
| `assignRole()` | `User` | `update` | `role` |
| `setActive()` | `User` | `update` | `isActive` |
| `softDelete()` | `User` | `update` | `deletedAt, isActive=false` |
| `softDelete()` | `RefreshToken` | `updateMany` | `isRevoked=true` |

### RolesService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `setPermission()` | `Permission` | `upsert` | `userId, resource, action, scope` |
| `removePermission()` | `Permission` | `delete` | — |

### CompaniesService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `Company` | `create` | `name, slug, description, logoUrl, websiteUrl` |
| `create()` | `Tenant` | `create` | `name, slug, plan=ENTERPRISE, isActive=true, companyId` |
| `update()` | `Company` | `update` | `name?, slug?, description?, logoUrl?, websiteUrl?` |
| `softDelete()` | `Company` | `update` | `deletedAt` |

### ProductsService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `Product` | `create` | `name, slug, description, companyId, status=DRAFT, logoUrl?` |
| `create()` | `Tenant` | `create` | `name, slug, plan=STARTER, isActive=true, productId` |
| `update()` | `Product` | `update` | `name?, description?, logoUrl?` |
| `updateStatus()` | `Product` | `update` | `status` |
| `softDelete()` | `Product` | `update` | `deletedAt` |

### DomainsService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `Domain` | `create` | `tenantId, name, type, targetDomain?, isVerified=false` |
| `update()` | `Domain` | `update` | `name?, type?, targetDomain?` |
| `verify()` | `Domain` | `update` | `isVerified=true, verifiedAt` |
| `remove()` | `Domain` | `delete` (hard) | — |

### TenantService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `Tenant` | `create` | `name, slug, plan, isActive, companyId?, productId?` |
| `update()` | `Tenant` | `update` | `name?, plan?, isActive?` |
| `softDelete()` | `Tenant` | `update` | `deletedAt, isActive=false` |

### PagesService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `Page` | `create` | `tenantId, slug, title, locale, isPublished=false, currentVersion=1` |
| `update()` (tx) | `PageVersion` | `create` (captureVersionInTx) | `pageId, versionNumber, title, contentSnapshot, seoSnapshot, createdById` |
| `update()` (tx) | `Page` | `update` | `title?` |
| `publish()` (tx) | `PageVersion` | `create` | snapshot |
| `publish()` (tx) | `Page` | `update` | `isPublished=true` |
| `unpublish()` (tx) | `PageVersion` | `create` | snapshot |
| `unpublish()` (tx) | `Page` | `update` | `isPublished=false` |
| `softDelete()` | `Page` | `update` | `deletedAt, isPublished=false` |

### ContentBlocksService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `ContentBlock` | `create` | `pageId, type, content, position, isVisible=true` |
| `update()` (tx) | `PageVersion` | `create` | snapshot |
| `update()` (tx) | `ContentBlock` | `update` | `type?, content?` |
| `reorder()` (tx) | `PageVersion` | `create` | snapshot |
| `reorder()` (tx) | `ContentBlock` | `update` ×N | `position` for each block |
| `updateVisibility()` (tx) | `PageVersion` | `create` | snapshot |
| `updateVisibility()` (tx) | `ContentBlock` | `update` | `isVisible` |
| `softDelete()` | `ContentBlock` | `update` | `deletedAt` |

### SeoService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `upsert()` | `SeoSetting` | `upsert` | all SEO fields |
| `remove()` | `SeoSetting` | `delete` (hard) | — |

### BrandingService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `upsert()` | `Branding` | `upsert` | all branding fields |
| `reset()` | `Branding` | `delete` (hard) | — |

### VersioningService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `captureVersionInTx()` | `PageVersion` | `create` | `pageId, versionNumber, title, contentSnapshot, seoSnapshot, createdById` |
| `rollback()` (tx) | `ContentBlock` | `deleteMany` (hard) | — |
| `rollback()` (tx) | `ContentBlock` | `create` ×N | all block fields |
| `rollback()` (tx) | `Page` | `update` | `title` |
| `rollback()` (tx) | `PageVersion` | `create` | snapshot of restored state |
| `restore()` (tx) | same as rollback + | `SeoSetting` | `upsert` |
| `deleteVersion()` | `PageVersion` | `delete` (hard) | — |

### FeatureFlagsService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `FeatureFlag` | `create` | `key, description, isEnabled=false, defaultValue?, tenantId?` |
| `update()` | `FeatureFlag` | `update` | `key?, description?, defaultValue?` |
| `toggle()` | `FeatureFlag` | `update` | `isEnabled` |
| `remove()` | `FeatureFlag` | `delete` (hard) | — |

### SettingsService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `create()` | `SystemSetting` | `create` | `key, value, tenantId?, isPublic?, description?` |
| `update()` | `SystemSetting` | `update` | `value?, isPublic?, description?` |
| `remove()` | `SystemSetting` | `delete` (hard) | — |

### AuditLogService

| Method | Model | Operation | Fields Written |
|---|---|---|---|
| `log()` | `AuditLog` | `create` | `action, resource, resourceId?, actorId?, tenantId?, before?, after?, metadata?` |

---

# Complete Database Read Map

## Per-Service Prisma Read Operations

### TenantMiddleware / TenantService (per-request path)

```
Cache MISS:
  prisma.domain.findFirst({
    where: { name: domain, deletedAt: null },
    include: {
      tenant: {
        include: {
          domains: { where: { deletedAt: null } },
          featureFlags: true,
          branding: true,
          company: true,
          product: { include: { company: true } },
        }
      }
    }
  })
  // Tables read: domain, tenant, featureFlag, branding, company, product

  prisma.featureFlag.findMany({ where: { tenantId: null } })
  // Tables read: featureFlag (global flags only)
```

### JwtStrategy (per authenticated request)

```
prisma.user.findFirst({
  where: { id: payload.sub, deletedAt: null },
  select: USER_SELECT,  // excludes passwordHash
})
// Tables read: user
```

### PagesService.findBySlug (public SSR path)

```
prisma.page.findFirst({
  where: { tenantId, slug, locale, deletedAt: null, isPublished: true },
  include: {
    contentBlocks: { where: { isVisible: true, deletedAt: null }, orderBy: { position: 'asc' } },
    seoSetting: true,
  }
})
// Tables read: page, content_blocks (filtered), seo_settings
```

### captureVersionInTx (inside every CMS mutation transaction)

```
Promise.all([
  tx.page.findUnique({ where: { id: pageId }, select: { title, slug, locale, isPublished } }),
  tx.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' } }),
  tx.seoSetting.findUnique({ where: { pageId } }),
  tx.pageVersion.findFirst({ where: { pageId }, orderBy: { versionNumber: 'desc' } }),
])
// Tables read: page, content_blocks, seo_settings, page_versions
// These 4 reads happen IN PARALLEL within every mutation transaction
```

---

# Transaction Map

## Transactions Used in the Application

All `prisma.$transaction()` calls in the codebase:

### `PagesService.update()`
```typescript
prisma.$transaction(async (tx) => {
  await versioningService.captureVersionInTx(tx, pageId, actorId);
  // 5 queries: page read, blocks read, seo read, version read, version create
  await tx.page.update({ where: { id }, data: { title } });
  // 1 query: page update
});
// Total: 6 queries in 1 transaction
```

### `PagesService.publish()` / `unpublish()`
```typescript
prisma.$transaction(async (tx) => {
  await versioningService.captureVersionInTx(tx, pageId, actorId);
  // 5 queries
  await tx.page.update({ where: { id }, data: { isPublished } });
  // 1 query
});
// Total: 6 queries in 1 transaction
```

### `ContentBlocksService.update()`
```typescript
prisma.$transaction(async (tx) => {
  await versioningService.captureVersionInTx(tx, block.pageId, actorId);
  // 5 queries
  await tx.contentBlock.update({ where: { id }, data: { type, content } });
  // 1 query
});
// Total: 6 queries in 1 transaction
```

### `ContentBlocksService.reorder()`
```typescript
prisma.$transaction(async (tx) => {
  await versioningService.captureVersionInTx(tx, pageId, actorId);
  // 5 queries
  for (const item of items) {
    await tx.contentBlock.update({ where: { id: item.id }, data: { position: item.position } });
    // N queries — one per block
  }
});
// Total: 5 + N queries in 1 transaction (N = number of blocks being reordered)
```

### `ContentBlocksService.updateVisibility()`
```typescript
prisma.$transaction(async (tx) => {
  await versioningService.captureVersionInTx(tx, block.pageId, actorId);
  // 5 queries
  await tx.contentBlock.update({ where: { id }, data: { isVisible } });
  // 1 query
});
// Total: 6 queries in 1 transaction
```

### `VersioningService.createVersion()`
```typescript
prisma.$transaction(async (tx) => {
  await captureVersionInTx(tx, pageId, actorId);
  // 5 queries
  const newVersion = await tx.pageVersion.findFirst({ ... });
  // 1 query to get the new version number
});
// Total: 6 queries in 1 transaction
```

### `VersioningService.rollback()`
```typescript
prisma.$transaction(async (tx) => {
  await tx.contentBlock.deleteMany({ where: { pageId } });
  // 1 query: hard delete all blocks
  for (const block of blocks) {
    await tx.contentBlock.create({ data: { ... } });
    // N queries: recreate each block from snapshot
  }
  await tx.page.update({ where: { id: pageId }, data: { title } });
  // 1 query: restore title
  await captureVersionInTx(tx, pageId, actorId);
  // 5 queries: snapshot the restored state
  const newVersion = await tx.pageVersion.findFirst({ ... });
  // 1 query: get new version number
});
// Total: 1 (deleteMany) + N (creates) + 1 (title update) + 5 (captureVersionInTx) + 1 (version read)
//       = N + 8 queries in 1 transaction
```

### `VersioningService.restore()`
```typescript
// Same as rollback + 1 additional seoSetting.upsert inside the transaction
// Total: N + 9 queries in 1 transaction
```

---

# Query Load Analysis

## Hot Path: Public Page Render

```
Request: GET /pages/public/:tenantId/:locale/:slug

1. TenantMiddleware:
   - Cache HIT: 0 queries
   - Cache MISS: 2 queries (domain + global flags)

2. JwtAuthGuard:
   - @Public() detected: 0 queries

3. PagesService.findBySlug():
   - 1 query (page + visible blocks + seo)

Total DB queries:
  Cache HIT:  1 query  (just findBySlug)
  Cache MISS: 3 queries (domain resolution + global flags + findBySlug)
```

## Hot Path: Authenticated CMS Edit

```
Request: PATCH /content-blocks/:id { content: {...} }

1. TenantMiddleware: 0-2 queries (cache dep.)
2. JwtAuthGuard → JwtStrategy: 1 query (load user)
3. RolesGuard: 0 queries
4. ContentBlocksService.update():
   a. assertBlockOwnership: 1 query (block + page + tenant + company + product)
   b. assertValidContent: 0 queries
   c. prisma.$transaction:
      - captureVersionInTx (4 parallel reads): 4 queries
      - captureVersionInTx (version create): 1 query
      - contentBlock.update: 1 query
   d. auditLog.log: 1 query

Total:
  Cache HIT:  1 (user) + 1 (block ownership) + 6 (transaction) + 1 (audit) = 9 queries
  Cache MISS: 2 (tenant) + 1 (user) + 1 (block ownership) + 6 (transaction) + 1 (audit) = 11 queries
```

## Cold Path: Rollback with 10 Blocks

```
Request: POST /pages/:pageId/rollback { versionId }

1. TenantMiddleware: 0-2 queries
2. JwtStrategy: 1 query
3. RolesGuard: 0 queries
4. VersioningService.rollback():
   a. assertPageOwnership: 1 query
   b. assertVersionOwnership: 1 query (with full version snapshots)
   c. prisma.$transaction:
      - deleteMany (all blocks): 1 query
      - create × 10 blocks: 10 queries
      - page.update (title): 1 query
      - captureVersionInTx: 5 queries (4 parallel + 1 create)
      - pageVersion.findFirst: 1 query
   d. auditLog.log: 1 query

Total:
  1 (user) + 1 (page ownership) + 1 (version ownership) + 18 (transaction) + 1 (audit) = 22 queries
```

---

# Index Recommendations

## Existing Indexes (from Prisma schema)

| Table | Index | Type |
|---|---|---|
| `tenants` | `slug` | UNIQUE |
| `companies` | `slug` | UNIQUE |
| `products` | `(slug, companyId)` | UNIQUE |
| `domains` | `name` | UNIQUE |
| `pages` | `(slug, tenantId, locale)` | UNIQUE |
| `page_versions` | `(pageId, versionNumber)` | UNIQUE |
| `users` | `email` | UNIQUE |
| `permissions` | `(userId, resource, action)` | UNIQUE |
| `feature_flags` | `(key, tenantId)` | UNIQUE (broken for NULL) |
| `system_settings` | `(key, tenantId)` | UNIQUE (broken for NULL) |
| All `@id` fields | each `id` | PRIMARY KEY (B-tree) |

## Missing Indexes (Recommended Additions to `schema.prisma`)

### `PageVersion`
```prisma
model PageVersion {
  // ... existing fields ...
  @@index([pageId, versionNumber(sort: Desc)])  // captureVersionInTx findFirst
}
```
**Impact**: Every CMS mutation calls `pageVersion.findFirst({ where: { pageId }, orderBy: { versionNumber: 'desc' } })`. Without this index, it does a full `page_versions` table scan for every mutation.

### `ContentBlock`
```prisma
model ContentBlock {
  // ... existing fields ...
  @@index([pageId, position])   // findMany for snapshots and admin view
  @@index([pageId, deletedAt])  // filtered queries with deletedAt: null
}
```
**Impact**: `captureVersionInTx` and every `findByPage` call scan all blocks for a pageId. With this index, only blocks for the relevant page are touched.

### `AuditLog`
```prisma
model AuditLog {
  // ... existing fields ...
  @@index([tenantId])
  @@index([createdAt(sort: Desc)])
  @@index([resource, resourceId])
}
```
**Impact**: `findByTenant()` is called by ADMIN users to view their audit trail. Without `tenantId` index, it's a full table scan of potentially millions of audit records.

### `RefreshToken`
```prisma
model RefreshToken {
  // ... existing fields ...
  @@index([userId, isRevoked])
}
```
**Impact**: `refresh()` and `logout()` filter by `(userId, isRevoked: false)`. Without this index, it scans all refresh tokens for the user.

### `Domain`
```prisma
model Domain {
  // ... existing fields ...
  @@index([name, deletedAt])    // TenantMiddleware on every cache miss
}
```
**Impact**: `TenantService.resolveFromDomain()` is called on every request on cache miss. The `domain.name` has a UNIQUE index already, so this is already indexed. However, the existing unique index on `name` alone covers this lookup. Acceptable as-is.

### `ActivityLog` (if ever enabled)
```prisma
model ActivityLog {
  // ... existing fields ...
  @@index([userId])
  @@index([tenantId])
}
```

---

# Schema Relation Graph

```
Company (1)
  ├── (n) User [companyId]
  ├── (n) Product [companyId]
  │     └── (1) Tenant [productId]  ← product tenant
  └── (1) Tenant [companyId]        ← holding tenant

Tenant (1)
  ├── (n) Domain
  ├── (n) Page
  │     ├── (n) ContentBlock
  │     ├── (1) SeoSetting
  │     └── (n) PageVersion
  │           └── (1) User (createdBy)
  ├── (1) Branding
  ├── (n) FeatureFlag
  └── (n) User [tenantId] (loose relation, less used)

User (1)
  ├── (n) RefreshToken
  ├── (n) Permission
  ├── (n) PageVersion (created_by)
  └── (n) Notification

MCP (all stubs):
McpProvider (1)
  └── (n) McpConnection [providerId]
        └── (n) AiAgent [connectionId]
              ├── (n) AgentPermission
              ├── (n) WorkflowDefinition
              └── (n) AgentAuditLog
```

---

# Soft Delete vs Hard Delete Reference

| Model | Delete Type | Column | Cascade behavior |
|---|---|---|---|
| `Tenant` | Soft | `deletedAt` | None — children remain |
| `Company` | Soft | `deletedAt` | None — children remain |
| `Product` | Soft | `deletedAt` | None — children remain |
| `Domain` | Hard (in service) | — | N/A |
| `Page` | Soft | `deletedAt` | Prisma cascade on HARD delete only |
| `ContentBlock` | Soft | `deletedAt` | — |
| `PageVersion` | Hard (SUPER_ADMIN only) | — | N/A |
| `SeoSetting` | Hard | — | N/A |
| `Branding` | Hard | — | N/A |
| `User` | Soft | `deletedAt` | RefreshTokens revoked (not deleted) |
| `RefreshToken` | Soft (isRevoked) | `isRevoked` | — |
| `Permission` | Hard | — | N/A |
| `FeatureFlag` | Hard | — | N/A |
| `SystemSetting` | Hard | — | N/A |
| `AuditLog` | Never deleted | — | N/A |
| `ActivityLog` | Never written | — | N/A |
| `Notification` | Never deleted | — | N/A |

---

# Prisma Client Usage Patterns

## `USER_SELECT` Constant Pattern

All user queries use an explicit `select` object that excludes `passwordHash`:

```typescript
// Defined in users.service.ts, applied to ALL user reads
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  companyId: true,
  tenantId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  // passwordHash: intentionally OMITTED
};
```

## `TENANT_OWNER_SELECT` Constant Pattern

Used for ownership resolution across 12+ service files:

```typescript
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
};
```

Minimal select — only fetches what's needed for the ownership chain. Does not load tenant name, slug, domains, etc.

## `__none__` Sentinel Pattern

Used when `actorCompanyId` is null for non-SUPER_ADMIN actors:

```typescript
prisma.user.findMany({
  where: {
    companyId: actorCompanyId ?? '__none__',  // '__none__' never matches any UUID
    deletedAt: null,
  },
})
```

This returns empty results rather than matching records with `companyId = null`, which could accidentally expose cross-company data.

## `Prisma.DbNull` Pattern

Used for nullable JSON columns to store true SQL NULL (not JSON null):

```typescript
// seoSnapshot is a nullable Json column
contentSnapshot: blocks,
seoSnapshot: seo ? { ...seoFields } : Prisma.DbNull,
// Stores NULL in DB (not the JSON value null)
// Allows WHERE seoSnapshot IS NULL queries to work correctly
```

## Partial Update Pattern

Used in `BrandingService.upsert()`, `SeoService.upsert()`, `SettingsService.update()`:

```typescript
update: {
  ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
  ...(dto.fontHeading !== undefined && { fontHeading: dto.fontHeading }),
  // only fields explicitly present in dto are written
}
```

`undefined` field = "don't change". `null` field = "clear this field" (if column nullable). This preserves existing values for unspecified fields.

## Transaction + captureVersionInTx Pattern

The most common compound pattern in the codebase:

```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Snapshot current state BEFORE the mutation
  await this.versioningService.captureVersionInTx(tx, resourceId, actorId);
  // 2. Apply the mutation
  await tx.someModel.update({ ... });
  // Both are in the same transaction — if either fails, both roll back
});
```

Why snapshot BEFORE: if the update fails, the transaction rolls back and no stale snapshot is created. If the snapshot fails (extremely rare), the update also does not happen.

---

# Environment Variables Used by Prisma / DB Layer

| Variable | Used By | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | Prisma datasource | YES | — |
| `JWT_ACCESS_SECRET` | `main.ts` guard (process.exit), `JwtModule` | YES | — |
| `JWT_REFRESH_SECRET` | `main.ts` guard (process.exit), `AuthService` | YES | — |
| `JWT_ACCESS_EXPIRY` | `JwtModule` config | NO | `'15m'` |
| `JWT_REFRESH_EXPIRY` | `JwtModule` config (refresh signing only) | NO | `'7d'` |

Note: `JWT_REFRESH_EXPIRY` is used for signing the refresh JWT but the DB `expiresAt` field is hardcoded to 7 days (DEBT-003).

---

# Migration Management

## Prisma-Managed Migrations

Location: `apps/api/prisma/migrations/`

Run with:
```bash
pnpm prisma migrate dev    # development (creates + applies)
pnpm prisma migrate deploy # production (applies pending only)
```

## Manual Migrations (NOT Prisma-managed)

Location: `apps/api/prisma/migrations/manual/partial_unique_indexes.sql`

Content:
```sql
-- Must be applied manually after every DB reset
-- Prevents duplicate global feature flags (NULL != NULL in @@unique)
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_global_unique
  ON feature_flags (key)
  WHERE tenant_id IS NULL;

-- Prevents duplicate global system settings
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_global_unique
  ON system_settings (key)
  WHERE tenant_id IS NULL;
```

**Risk**: If DB is reset with `prisma migrate reset` + `prisma migrate deploy`, this file is NOT applied automatically. Global duplicate flags/settings become possible until manually re-applied.

**Recommended fix**: Add a post-migrate script in `package.json`:
```json
"scripts": {
  "db:migrate": "prisma migrate deploy && psql $DATABASE_URL -f prisma/migrations/manual/partial_unique_indexes.sql"
}
```
