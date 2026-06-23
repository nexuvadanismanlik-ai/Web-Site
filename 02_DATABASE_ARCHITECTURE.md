# 02 — DATABASE ARCHITECTURE

## Database

- Engine: PostgreSQL 16 (Alpine Docker image)
- ORM: Prisma Client JS
- Connection: `DATABASE_URL` env var
- Extensions enabled at init: `pg_trgm`, `unaccent`
- Schema file: `apps/api/prisma/schema.prisma`
- Manual migration: `apps/api/prisma/migrations/manual/partial_unique_indexes.sql`

---

## Enums (defined in schema.prisma)

### TenantType
```
HOLDING   — top-level holding company tenant
PRODUCT   — individual product/SaaS tenant
```

### CompanyType
```
HOLDING    — the parent holding entity
SUBSIDIARY — a subsidiary company
```

### ProductStatus
```
DRAFT     — not yet published or released
ACTIVE    — live product
HIDDEN    — exists but not publicly visible
BETA      — in beta testing
ARCHIVED  — end-of-life; soft-delete companion
```

### DomainType
```
PRIMARY   — the canonical domain for a tenant
SUBDOMAIN — a subdomain alias
REDIRECT  — issues a 301 redirect; redirectTo field must be set
ALIAS     — alternate name resolving to the same tenant
```

### BlockType
```
HERO | TEXT | IMAGE | GALLERY | CTA | FEATURES | TESTIMONIALS | FAQ | CUSTOM
```

### UserRole
```
SUPER_ADMIN     — weight 100; platform owner; unrestricted
ADMIN           — weight 80; manages one company and its subsidiaries
PRODUCT_MANAGER — weight 60; manages a product and its pages
CONTENT_EDITOR  — weight 40; creates and edits pages and blocks
VIEWER          — weight 20; read-only
```

### SettingType
```
STRING | NUMBER | BOOLEAN | JSON | TEXT
```

### NotificationType
```
INFO | SUCCESS | WARNING | ERROR | SYSTEM
```

### McpProviderType
```
HIGGSFIELD | OPENAI | ANTHROPIC | CUSTOM
```

### McpConnectionStatus
```
PENDING | ACTIVE | ERROR | DISABLED
```

### AgentStatus
```
DRAFT | ACTIVE | PAUSED | ARCHIVED
```

### WorkflowStatus
```
DRAFT | ACTIVE | ARCHIVED
```

---

## Models — Complete Field Reference

### Tenant
Table: `tenants`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| slug | String | unique | URL-safe identifier |
| type | TenantType | enum | HOLDING or PRODUCT |
| name | String | | Display name |
| description | String? | nullable | |
| isActive | Boolean | default true | |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete |

Relations:
- `company` → Company (optional, 1:1)
- `product` → Product (optional, 1:1)
- `domains` → Domain[] (1:many)
- `pages` → Page[] (1:many)
- `branding` → Branding (optional, 1:1)
- `settings` → SystemSetting[] (1:many)
- `featureFlags` → FeatureFlag[] (1:many)
- `activityLogs` → ActivityLog[] (1:many)
- `notifications` → Notification[] (1:many)

Indexes:
- `@@index([isActive])`
- `@@index([type])`

---

### Company
Table: `companies`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| tenantId | String | unique, FK→Tenant | 1:1 with Tenant |
| name | String | | |
| type | CompanyType | enum | HOLDING or SUBSIDIARY |
| legalName | String? | nullable | |
| taxId | String? | nullable | |
| description | String? | nullable | |
| parentId | String? | nullable, FK→Company | self-referential hierarchy |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete |

Relations:
- `tenant` → Tenant (1:1, owns tenant)
- `parent` → Company? (self-referential "CompanyHierarchy")
- `subsidiaries` → Company[] (self-referential reverse)
- `products` → Product[] (1:many)
- `users` → User[] (1:many)

Indexes:
- `@@index([parentId])`
- `@@index([type])`

---

### Product
Table: `products`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| tenantId | String | unique, FK→Tenant | 1:1 with Tenant |
| companyId | String | FK→Company | owning company |
| name | String | | |
| slug | String | unique (global) | URL identifier |
| description | String? | nullable | |
| status | ProductStatus | default DRAFT | |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete; status set to ARCHIVED |

Relations:
- `tenant` → Tenant (1:1, owns tenant)
- `company` → Company (many:1)

Indexes:
- `@@index([companyId])`
- `@@index([status])`

---

### Domain
Table: `domains`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| tenantId | String | FK→Tenant | |
| domainName | String | unique (global) | e.g. `nexuva.com` |
| type | DomainType | default PRIMARY | |
| isActive | Boolean | default true | |
| redirectTo | String? | nullable | required when type=REDIRECT |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations:
- `tenant` → Tenant (many:1)

Indexes:
- `@@index([tenantId])`
- `@@index([tenantId, isActive])`

Note: Domain has NO soft delete. The `remove()` method in DomainsService performs a hard delete.

---

### Page
Table: `pages`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| tenantId | String | FK→Tenant | |
| slug | String | part of @@unique | |
| title | String | | |
| isPublished | Boolean | default false | |
| locale | String | default "tr" | |
| currentVersion | Int | default 1 | not auto-incremented by Prisma; managed manually (not currently updated in code) |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete |

Relations:
- `tenant` → Tenant (many:1)
- `contentBlocks` → ContentBlock[] (1:many, cascade delete)
- `seoSetting` → SeoSetting? (1:1, cascade delete)
- `versions` → PageVersion[] (1:many, cascade delete)

Unique Constraints:
- `@@unique([tenantId, slug, locale])` — per-tenant slug+locale uniqueness

Indexes:
- `@@index([tenantId])`
- `@@index([tenantId, isPublished])`
- `@@index([tenantId, locale])`

Critical Note: The `@@unique([tenantId, slug, locale])` constraint does NOT account for soft-deleted pages (deletedAt IS NOT NULL). A soft-deleted page still holds its slug. The service layer pre-checks and catches P2002 on Prisma create.

---

### ContentBlock
Table: `content_blocks`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| pageId | String | FK→Page, onDelete Cascade | |
| type | BlockType | enum | |
| content | Json | | freeform block payload; max 100 KB enforced in service |
| position | Int | | ordering; 0-based |
| isVisible | Boolean | default true | controls public rendering |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete |

Relations:
- `page` → Page (many:1)

Indexes:
- `@@index([pageId])`
- `@@index([pageId, position])`
- `@@index([pageId, deletedAt])`

---

### PageVersion
Table: `page_versions`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| pageId | String | FK→Page, onDelete Cascade | |
| versionNumber | Int | part of @@unique | monotonically increasing per page |
| title | String | | page title at snapshot time |
| contentSnapshot | Json | | full array of block objects: type, content, position, isVisible |
| seoSnapshot | Json? | nullable | SEO fields at snapshot time |
| createdById | String | FK→User | who triggered the snapshot |
| createdAt | DateTime | default now() | |

Relations:
- `page` → Page (many:1)
- `createdBy` → User (many:1)

Unique Constraints:
- `@@unique([pageId, versionNumber])`

Indexes:
- `@@index([pageId])`
- `@@index([createdById])`

---

### SeoSetting
Table: `seo_settings`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| pageId | String | unique, FK→Page, onDelete Cascade | 1:1 with Page |
| metaTitle | String? | nullable | |
| metaDescription | String? | nullable | |
| keywords | String[] | | array of keyword strings |
| ogImage | String? | nullable | URL |
| ogTitle | String? | nullable | |
| ogDescription | String? | nullable | |
| twitterCard | String? | nullable | |
| canonicalUrl | String? | nullable | |
| noIndex | Boolean | default false | |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations:
- `page` → Page (1:1)

---

### Branding
Table: `branding`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| tenantId | String | unique, FK→Tenant | 1:1 with Tenant |
| logoUrl | String? | nullable | |
| faviconUrl | String? | nullable | |
| primaryColor | String? | nullable | hex string |
| secondaryColor | String? | nullable | |
| accentColor | String? | nullable | |
| fontHeading | String? | nullable | |
| fontBody | String? | nullable | |
| themePreset | String? | nullable | named theme |
| customCss | String? | nullable | raw CSS override |
| config | Json? | nullable | arbitrary extension config |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |

Relations:
- `tenant` → Tenant (1:1)

Note: Branding has NO soft delete. The `reset()` method performs a hard delete (`prisma.branding.delete`).

---

### User
Table: `users`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| email | String | unique (global) | |
| passwordHash | String | | argon2 hash; NEVER returned in responses |
| firstName | String? | nullable | |
| lastName | String? | nullable | |
| role | UserRole | default VIEWER | |
| isActive | Boolean | default true | |
| companyId | String? | nullable, FK→Company | optional company scope |
| lastLoginAt | DateTime? | nullable | updated on every login |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete; sets isActive=false |

Relations:
- `company` → Company? (many:1, optional)
- `pageVersions` → PageVersion[] (1:many, as version author)
- `auditLogs` → AuditLog[] (1:many, as actor)
- `activityLogs` → ActivityLog[] (1:many, as actor)
- `notifications` → Notification[] (1:many)
- `refreshTokens` → RefreshToken[] (1:many, cascade delete)

Indexes:
- `@@index([companyId])`
- `@@index([role])`

---

### RefreshToken
Table: `refresh_tokens`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| userId | String | FK→User, onDelete Cascade | |
| tokenHash | String | unique | argon2 hash of the raw refresh token |
| expiresAt | DateTime | | hardcoded 7 days in AuthService |
| isRevoked | Boolean | default false | |
| createdAt | DateTime | default now() | |

Relations:
- `user` → User (many:1)

Indexes:
- `@@index([userId])`
- `@@index([userId, isRevoked])`

---

### Permission
Table: `permissions`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| role | UserRole | enum | |
| resource | String | | e.g. `company`, `page` |
| actions | Json | | e.g. `{create: true, read: true, update: false, delete: false}` |

Unique Constraints:
- `@@unique([role, resource])` — one permission record per role+resource pair

Note: This table stores explicit overrides. The actual route-level enforcement is handled by `@Roles()` decorator + `RolesGuard`, NOT by querying this table at request time. This table is only read/written via the `/roles/permissions` endpoints. It is metadata storage, not a runtime enforcement table.

---

### FeatureFlag
Table: `feature_flags`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| key | String | part of @@unique | e.g. `page_versioning` |
| name | String | | human label |
| description | String? | nullable | |
| tenantId | String? | nullable, FK→Tenant | null = global flag |
| isEnabled | Boolean | default false | |
| config | Json? | nullable | max 10 KB |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete; isEnabled set to false |

Unique Constraints:
- `@@unique([key, tenantId])` — tenant-scoped uniqueness only
- `CREATE UNIQUE INDEX feature_flags_global_key_unique ON feature_flags(key) WHERE tenant_id IS NULL` — MANUAL SQL required for global uniqueness

Indexes:
- `@@index([tenantId])`
- `@@index([tenantId, deletedAt])`
- `@@index([isEnabled])`

Known Issue: The partial unique index for global flags (`tenantId IS NULL`) must be applied manually via `partial_unique_indexes.sql`. It is NOT part of the Prisma migration chain. If this SQL is not run, duplicate global flag keys are possible.

---

### SystemSetting
Table: `system_settings`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| key | String | part of @@unique | |
| value | Json | | typed by the `type` field |
| type | SettingType | default STRING | STRING / NUMBER / BOOLEAN / JSON / TEXT |
| description | String? | nullable | |
| isPublic | Boolean | default false | if true, exposed via public GET endpoint |
| tenantId | String? | nullable, FK→Tenant | null = global setting |
| createdAt | DateTime | default now() | |
| updatedAt | DateTime | @updatedAt | |
| deletedAt | DateTime? | nullable | soft delete |

Unique Constraints:
- `@@unique([key, tenantId])` — same NULL caveat as FeatureFlag
- `CREATE UNIQUE INDEX system_settings_global_key_unique ON system_settings(key) WHERE tenant_id IS NULL` — MANUAL SQL required

Indexes:
- `@@index([tenantId])`
- `@@index([tenantId, deletedAt])`
- `@@index([tenantId, isPublic])`

---

### AuditLog
Table: `audit_logs`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| actorId | String | FK→User | who performed the action |
| action | String | | e.g. `CREATE`, `UPDATE`, `DELETE`, `PUBLISH`, `ROLLBACK` |
| resource | String | | e.g. `page`, `content_block`, `user` |
| resourceId | String? | nullable | the affected record's ID |
| before | Json? | nullable | pre-mutation state snapshot |
| after | Json? | nullable | post-mutation state snapshot |
| ipAddress | String? | nullable | not currently populated by services |
| userAgent | String? | nullable | not currently populated by services |
| createdAt | DateTime | default now() | |

Indexes:
- `@@index([actorId])`
- `@@index([resource, resourceId])`
- `@@index([createdAt])`

Note: `ipAddress` and `userAgent` fields exist in the schema and `CreateAuditLogParams` interface but are never populated by any current service call. All calls pass only `actorId`, `action`, `resource`, `resourceId`, `before`, `after`.

---

### ActivityLog
Table: `activity_logs`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| actorId | String? | nullable, FK→User | null for system events |
| tenantId | String? | nullable, FK→Tenant | |
| event | String | | e.g. `user.login`, `page.publish` |
| description | String | | human-readable description |
| metadata | Json? | nullable | arbitrary context |
| createdAt | DateTime | default now() | |

Indexes:
- `@@index([actorId])`
- `@@index([tenantId])`
- `@@index([event])`
- `@@index([createdAt])`

Note: ActivityLogService has `log()`, `findByTenant()`, `findRecent()` methods but ActivityLogService is NEVER called by any other service. It is registered and exported by ActivityLogModule but has zero callers in the current codebase. Dead code path.

---

### Notification
Table: `notifications`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, cuid() | |
| userId | String | FK→User | target user |
| tenantId | String? | nullable, FK→Tenant | context tenant |
| type | NotificationType | enum | |
| title | String | | |
| body | String? | nullable | |
| metadata | Json? | nullable | |
| isRead | Boolean | default false | |
| readAt | DateTime? | nullable | |
| createdAt | DateTime | default now() | |

Indexes:
- `@@index([userId, isRead])`
- `@@index([tenantId])`
- `@@index([createdAt])`

Note: `NotificationsService.send()` exists and is registered, but is NEVER called by any other service in the codebase. The only calls are from the NotificationsController (user-facing read/mark-read operations).

---

### MCP / AI Layer Models (schema placeholders, no business logic)

#### McpProvider — Table: `mcp_providers`
| Field | Type |
|---|---|
| id | String PK |
| name | String |
| type | McpProviderType |
| description | String? |
| isActive | Boolean default false |
| createdAt | DateTime |

#### McpConnection — Table: `mcp_connections`
| Field | Type |
|---|---|
| id | String PK |
| providerId | String FK→McpProvider |
| tenantId | String |
| status | McpConnectionStatus default PENDING |
| createdAt | DateTime |

Indexes: `[tenantId]`, `[providerId]`

#### AiAgent — Table: `ai_agents`
| Field | Type |
|---|---|
| id | String PK |
| tenantId | String |
| name | String |
| description | String? |
| status | AgentStatus default DRAFT |
| createdAt | DateTime |

Index: `[tenantId]`

#### AgentPermission — Table: `agent_permissions`
| Field | Type |
|---|---|
| id | String PK |
| agentId | String FK→AiAgent, onDelete Cascade |
| permission | String |
| createdAt | DateTime |

Index: `[agentId]`

#### WorkflowDefinition — Table: `workflow_definitions`
| Field | Type |
|---|---|
| id | String PK |
| tenantId | String |
| name | String |
| description | String? |
| status | WorkflowStatus default DRAFT |
| createdAt | DateTime |
| updatedAt | DateTime @updatedAt |

Index: `[tenantId]`

#### AgentAuditLog — Table: `agent_audit_logs`
| Field | Type |
|---|---|
| id | String PK |
| tenantId | String |
| agentId | String FK→AiAgent |
| action | String |
| result | Json? |
| createdAt | DateTime |

Indexes: `[tenantId]`, `[agentId]`, `[createdAt]`

---

## Model Relation Graph

```
Tenant (1:1)──────────────── Company
  │                              │
  │ (1:1)                        │ (1:many)
  ├── Product ◄──────────────────┘
  │
  │ (1:many)
  ├── Domain[]
  │
  │ (1:many)
  ├── Page[]
  │     │ (1:many, cascade)
  │     ├── ContentBlock[]
  │     │
  │     │ (1:1, cascade)
  │     ├── SeoSetting
  │     │
  │     │ (1:many, cascade)
  │     └── PageVersion[]
  │           └── createdBy → User
  │
  │ (1:1)
  ├── Branding
  │
  │ (1:many)
  ├── SystemSetting[]
  │
  │ (1:many)
  ├── FeatureFlag[]
  │
  │ (1:many)
  ├── ActivityLog[]
  │
  └── (1:many) Notification[]

Company (self-referential)
  ├── parent → Company?
  ├── subsidiaries → Company[]
  ├── users → User[]
  └── products → Product[]

User
  ├── company → Company?
  ├── pageVersions → PageVersion[]
  ├── auditLogs → AuditLog[]
  ├── activityLogs → ActivityLog[]
  ├── notifications → Notification[]
  └── refreshTokens → RefreshToken[] (cascade delete)

McpProvider
  └── connections → McpConnection[]

AiAgent
  ├── permissions → AgentPermission[] (cascade delete)
  └── auditLogs → AgentAuditLog[]
```

---

## Database Write Map

For every Prisma model, which service files can write (create/update/delete) to it.

### `tenants`
| Operation | File | Method |
|---|---|---|
| CREATE | `companies.service.ts` | `create()` — creates Tenant inside nested write |
| CREATE | `products.service.ts` | `create()` — creates Tenant inside nested write |
| — | No direct update/delete of Tenant | Tenant lifecycle tied to Company/Product |

### `companies`
| Operation | File | Method |
|---|---|---|
| CREATE | `companies.service.ts` | `create()` |
| UPDATE | `companies.service.ts` | `update()` |
| SOFT DELETE | `companies.service.ts` | `softDelete()` |

### `products`
| Operation | File | Method |
|---|---|---|
| CREATE | `products.service.ts` | `create()` |
| UPDATE | `products.service.ts` | `update()`, `updateStatus()` |
| SOFT DELETE | `products.service.ts` | `softDelete()` — also sets status=ARCHIVED |

### `domains`
| Operation | File | Method |
|---|---|---|
| CREATE | `domains.service.ts` | `create()` |
| UPDATE | `domains.service.ts` | `update()` |
| HARD DELETE | `domains.service.ts` | `remove()` |

### `pages`
| Operation | File | Method |
|---|---|---|
| CREATE | `pages.service.ts` | `create()` |
| UPDATE | `pages.service.ts` | `update()` — inside transaction |
| UPDATE (isPublished) | `pages.service.ts` | `publish()`, `unpublish()` — inside transaction |
| UPDATE (title) | `versioning.service.ts` | `rollback()`, `restore()` — inside transaction |
| SOFT DELETE | `pages.service.ts` | `softDelete()` |

### `content_blocks`
| Operation | File | Method |
|---|---|---|
| CREATE | `content-blocks.service.ts` | `create()` |
| UPDATE | `content-blocks.service.ts` | `update()`, `reorder()`, `updateVisibility()` |
| SOFT DELETE | `content-blocks.service.ts` | `softDelete()` |
| HARD DELETE | `versioning.service.ts` | `rollback()`, `restore()` — `deleteMany` then recreate from snapshot |

### `page_versions`
| Operation | File | Method |
|---|---|---|
| CREATE | `versioning.service.ts` | `captureVersionInTx()` — inside transactions |
| CREATE | `versioning.service.ts` | `createVersion()` |
| HARD DELETE | `versioning.service.ts` | `deleteVersion()` — SUPER_ADMIN only |

### `seo_settings`
| Operation | File | Method |
|---|---|---|
| UPSERT | `seo.service.ts` | `upsert()` |
| UPSERT | `versioning.service.ts` | `restore()` — inside transaction |
| HARD DELETE | `seo.service.ts` | `remove()` |

### `branding`
| Operation | File | Method |
|---|---|---|
| UPSERT | `branding.service.ts` | `upsert()` |
| HARD DELETE | `branding.service.ts` | `reset()` |

### `users`
| Operation | File | Method |
|---|---|---|
| CREATE | `users.service.ts` | `create()` |
| UPDATE | `users.service.ts` | `update()`, `assignRole()` |
| SOFT DELETE | `users.service.ts` | `softDelete()` — also sets isActive=false |
| UPDATE (lastLoginAt) | `auth.service.ts` | `login()` |

### `refresh_tokens`
| Operation | File | Method |
|---|---|---|
| CREATE | `auth.service.ts` | `signTokenPair()` |
| UPDATE (isRevoked) | `auth.service.ts` | `refresh()` — revokes old token |
| UPDATE (isRevoked) | `auth.service.ts` | `logout()` — revokes all |
| UPDATE (isRevoked) | `users.service.ts` | `softDelete()` — revokes all for deleted user |

### `permissions`
| Operation | File | Method |
|---|---|---|
| UPSERT | `roles.service.ts` | `setPermission()` |
| HARD DELETE | `roles.service.ts` | `removePermission()` |

### `feature_flags`
| Operation | File | Method |
|---|---|---|
| CREATE | `feature-flags.service.ts` | `create()` |
| UPDATE | `feature-flags.service.ts` | `update()`, `toggle()` |
| SOFT DELETE | `feature-flags.service.ts` | `softDelete()` — also sets isEnabled=false |

### `system_settings`
| Operation | File | Method |
|---|---|---|
| CREATE | `settings.service.ts` | `create()` |
| UPDATE | `settings.service.ts` | `update()` |
| SOFT DELETE | `settings.service.ts` | `remove()` |

### `audit_logs`
| Operation | File | Method |
|---|---|---|
| CREATE | `audit-log.service.ts` | `log()` |
| — | Called by: companies, products, domains, pages, content-blocks, seo, branding, feature-flags, settings, users, roles, versioning services | |

### `activity_logs`
| Operation | File | Method |
|---|---|---|
| CREATE | `activity-log.service.ts` | `log()` |
| — | No caller in current codebase | Dead write path |

### `notifications`
| Operation | File | Method |
|---|---|---|
| CREATE | `notifications.service.ts` | `send()` |
| UPDATE (isRead) | `notifications.service.ts` | `markRead()`, `markAllRead()` |
| — | `send()` has no caller in the current codebase | Dead write path |

### MCP / AI tables
No service writes to `mcp_providers`, `mcp_connections`, `ai_agents`, `agent_permissions`, `workflow_definitions`, `agent_audit_logs`. McpService is a stub.

---

## Transactions

All multi-step mutations that require atomicity use `prisma.$transaction(async (tx) => { ... })`.

| Transaction | File | Operations Inside |
|---|---|---|
| Page update | `pages.service.ts:update()` | captureVersionInTx → page.update |
| Page publish | `pages.service.ts:publish()` | captureVersionInTx → page.update(isPublished=true) |
| Page unpublish | `pages.service.ts:unpublish()` | captureVersionInTx → page.update(isPublished=false) |
| Block update | `content-blocks.service.ts:update()` | captureVersionInTx → contentBlock.update |
| Block reorder | `content-blocks.service.ts:reorder()` | captureVersionInTx → contentBlock.update×N |
| Block visibility | `content-blocks.service.ts:updateVisibility()` | captureVersionInTx → contentBlock.update |
| Version create | `versioning.service.ts:createVersion()` | captureVersionInTx |
| Rollback | `versioning.service.ts:rollback()` | contentBlock.deleteMany → contentBlock.create×N → page.update(title) → captureVersionInTx |
| Restore | `versioning.service.ts:restore()` | contentBlock.deleteMany → contentBlock.create×N → page.update(title) → seoSetting.upsert → captureVersionInTx |

`captureVersionInTx(tx, pageId, actorId)` itself uses `Promise.all` internally to fetch page, blocks, seo, and last version number in parallel within the transaction.

---

## Missing Indexes (Technical Observations)

| Table | Column | Why Useful |
|---|---|---|
| `pages` | `deletedAt` | All queries filter `deletedAt: null`; no index on this column alone |
| `users` | `email` | Already covered by `@unique` constraint |
| `users` | `deletedAt` | All queries filter `deletedAt: null`; no dedicated index |
| `companies` | `deletedAt` | Same pattern |
| `products` | `deletedAt` | Same pattern |
| `content_blocks` | `isVisible` | Public rendering queries filter `isVisible: true` |
| `refresh_tokens` | `expiresAt` | Queries filter `expiresAt: { gt: now }` but no index |

---

## Manual SQL Required (Critical)

File: `apps/api/prisma/migrations/manual/partial_unique_indexes.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_global_key_unique
  ON feature_flags(key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS system_settings_global_key_unique
  ON system_settings(key)
  WHERE tenant_id IS NULL;
```

**If this SQL is NOT applied:** Multiple global feature flags or global settings with the same key can be inserted. The `@@unique([key, tenantId])` Prisma constraint does NOT prevent this because PostgreSQL treats `NULL != NULL` in unique index comparisons.
