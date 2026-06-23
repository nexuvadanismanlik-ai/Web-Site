# 07 — PLATFORM SERVICES

---

## Overview

Platform Services covers the infrastructure layer that underpins all tenant operations:

- **Feature Flags** — per-tenant or global feature toggles
- **Settings** — per-tenant or global configuration key-value store
- **Audit Logs** — immutable mutation log consumed by all services
- **Activity Log** — (stub) user activity stream — dead code, no callers
- **Tenant Middleware** — per-request domain resolution with in-memory cache

---

## MODULE: Feature Flags

### Files

```
apps/api/src/modules/feature-flags/
├── feature-flags.module.ts
├── feature-flags.controller.ts
├── feature-flags.service.ts
└── dto/
    ├── create-feature-flag.dto.ts
    ├── toggle-feature-flag.dto.ts
    └── update-feature-flag.dto.ts
```

---

### `feature-flags.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [FeatureFlagsService]
controllers: [FeatureFlagsController]
exports:  []
```

---

### `feature-flags.controller.ts`

**Controller prefix**: `/feature-flags`

#### GET /feature-flags
- Role: `@Roles('ADMIN')`
- Query param: `tenantId?: string`
- Returns: all flags (scoped or global depending on role and tenantId)

#### GET /feature-flags/:id
- Role: `@Roles('ADMIN')`
- Returns: single flag

#### POST /feature-flags
- Role: `@Roles('SUPER_ADMIN')`
- Body: `CreateFeatureFlagDto`
- Creates global or tenant-scoped flag

#### PATCH /feature-flags/:id
- Role: `@Roles('SUPER_ADMIN')`
- Body: `UpdateFeatureFlagDto`
- Updates metadata (key, description, defaultValue)

#### PATCH /feature-flags/:id/toggle
- Role: `@Roles('ADMIN')` — lower requirement than create/update
- Body: `ToggleFeatureFlagDto { isEnabled: boolean }`
- HTTP 200
- Idempotent

#### DELETE /feature-flags/:id
- Role: `@Roles('SUPER_ADMIN')`
- Hard delete

---

### `feature-flags.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

---

#### `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)` — private async

1. `prisma.featureFlag.findUnique({ where: { id }, include: { tenant: TENANT_OWNER_SELECT } })`
2. If not found → `NotFoundException`
3. SUPER_ADMIN → return flag
4. Global flag (`tenantId === null`) → ADMIN can read but not mutate (mutation methods check separately)
5. Tenant-scoped flag → `resolveOwnerCompanyId(flag.tenant) !== actorCompanyId` → `ForbiddenException`
6. Returns flag

---

#### `findAll(actorRole, actorCompanyId, tenantId?)`

- SUPER_ADMIN: `prisma.featureFlag.findMany()` — all flags, optionally filtered by tenantId param
- Others: returns flags where:
  - `tenantId === null` (global flags, visible to all) OR
  - `tenant.company.id === actorCompanyId` OR `tenant.product.companyId === actorCompanyId`

---

#### `findById(id, actorRole, actorCompanyId)`

1. `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)`
2. Returns the flag loaded by `assertFeatureFlagOwnership`

---

#### `create(dto, actorId, actorRole)`

SUPER_ADMIN only (enforced at controller, not re-checked in service).

1. If `dto.tenantId` is provided: verify tenant exists
2. `prisma.featureFlag.create({ data: { key, description, isEnabled, defaultValue, tenantId } })`
3. Catches `P2002` (unique constraint violation on `[key, tenantId]`) → `ConflictException`
4. **Note**: Prisma `@@unique([key, tenantId])` does NOT prevent duplicate global flags (both tenantId=null). Must have the manual partial index from `partial_unique_indexes.sql` applied.
5. `auditLog.log({ action: 'CREATE', resource: 'feature_flag', ... })`

Prisma models touched: `tenant` (conditional read), `feature_flags` (create)

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

SUPER_ADMIN only (controller).

1. `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)`
2. `prisma.featureFlag.update({ data: { ...(dto.key && { key }), ...(dto.description !== undefined && { description }), ...(dto.defaultValue !== undefined && { defaultValue }) } })`
3. `auditLog.log({ action: 'UPDATE', resource: 'feature_flag', before, after })`

Note: `isEnabled` is not updatable via this endpoint — use `/toggle`.

---

#### `toggle(id, isEnabled, actorId, actorRole, actorCompanyId)`

1. `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)` → `before`
2. If `before.isEnabled === isEnabled` → return `{ id, isEnabled, changed: false }` (idempotent)
3. `prisma.featureFlag.update({ data: { isEnabled } })`
4. `auditLog.log({ action: isEnabled ? 'ENABLE' : 'DISABLE', resource: 'feature_flag', before, after })`
5. Return `{ id, isEnabled, changed: true }`

**Cache invalidation gap**: Toggling does NOT call `tenantService.invalidateCache()`. Changes are reflected after 60s TTL expires.

---

#### `remove(id, actorId, actorRole, actorCompanyId)`

1. `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)` → `before`
2. `prisma.featureFlag.delete({ where: { id } })` — hard delete
3. `auditLog.log({ action: 'DELETE', resource: 'feature_flag', before })`

---

### DTOs

#### `create-feature-flag.dto.ts`

```typescript
class CreateFeatureFlagDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  key: string;                  // no format validation; any string

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsBoolean()
  isEnabled?: boolean;          // default false if omitted

  @IsOptional() @IsString()
  tenantId?: string;            // null → global flag

  @IsOptional() @IsObject()
  defaultValue?: Record<string, unknown>;   // arbitrary JSON config
}
```

---

#### `toggle-feature-flag.dto.ts`

```typescript
class ToggleFeatureFlagDto {
  @IsBoolean()
  isEnabled: boolean;
}
```

---

#### `update-feature-flag.dto.ts`

```typescript
class UpdateFeatureFlagDto {
  @IsOptional() @IsString() @MaxLength(100)
  key?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsObject()
  defaultValue?: Record<string, unknown>;
}
```

---

## MODULE: Settings

### Files

```
apps/api/src/modules/settings/
├── settings.module.ts
├── settings.controller.ts
├── settings.service.ts
└── dto/
    ├── create-setting.dto.ts
    └── update-setting.dto.ts
```

---

### `settings.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [SettingsService]
controllers: [SettingsController]
exports:  []
```

---

### `settings.controller.ts`

**Controller prefix**: `/settings`

#### GET /settings
- Role: `@Roles('ADMIN')`
- Query param: `tenantId?: string`

#### GET /settings/:id
- Role: `@Roles('ADMIN')`

#### GET /settings/key/:key
- Role: `@Roles('ADMIN')`
- Query param: `tenantId?: string`
- Resolves a setting by key with fallback to global

#### POST /settings
- Role: `@Roles('SUPER_ADMIN')`
- Body: `CreateSettingDto`

#### PATCH /settings/:id
- Role: `@Roles('ADMIN')`
- Body: `UpdateSettingDto`

#### DELETE /settings/:id
- Role: `@Roles('SUPER_ADMIN')`

---

### `settings.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### Data Model for SystemSetting

```
key: string              // setting identifier
value: JsonValue         // Prisma JSON type
tenantId: string | null  // null = global default
isPublic: boolean        // if true, visible without auth (future use)
description: string | null
```

---

#### `assertSettingOwnership(id, actorRole, actorCompanyId)` — private async

Identical pattern to feature flag ownership check:
1. Load setting with tenant chain
2. SUPER_ADMIN → pass
3. Global (tenantId null) → pass for read, block for mutation
4. Tenant-scoped → company ownership check

---

#### `findAll(actorRole, actorCompanyId, tenantId?)`

Same scoping pattern as feature flags. Returns global + own-tenant settings.

---

#### `findByKey(key, tenantId?, actorRole, actorCompanyId)`

Resolution with fallback:
1. If `tenantId` is provided, look for tenant-specific setting first
2. `prisma.systemSetting.findFirst({ where: { key, tenantId }, orderBy: { tenantId: 'desc' } })` — prefers tenant-specific over global

Actually implemented as:
```typescript
// Try tenant-specific first
const tenantSetting = tenantId
  ? await prisma.systemSetting.findFirst({ where: { key, tenantId } })
  : null;

if (tenantSetting) return tenantSetting;

// Fall back to global
return prisma.systemSetting.findFirst({ where: { key, tenantId: null } });
```

3. If neither found → `NotFoundException`

This is the resolution order used by `TenantService.resolveFromDomain()` for feature flags (same pattern applied separately in `TenantService`).

---

#### `create(dto, actorId, actorRole)`

1. Verify tenantId if provided
2. `prisma.systemSetting.create({ data: { key, value, tenantId, isPublic, description } })`
3. Catches P2002 → `ConflictException`
4. `auditLog.log({ action: 'CREATE', resource: 'system_setting', ... })`

Same NULL uniqueness bug applies as FeatureFlag.

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `assertSettingOwnership(id, actorRole, actorCompanyId)`
2. `prisma.systemSetting.update({ data: { ...(dto.value !== undefined && { value }), ...(dto.description !== undefined && { description }), ...(dto.isPublic !== undefined && { isPublic }) } })`
3. `auditLog.log({ action: 'UPDATE', resource: 'system_setting', before, after })`

Note: ADMIN can update tenant-scoped settings they own. `key` and `tenantId` are not updatable after creation.

---

#### `remove(id, actorId, actorRole, actorCompanyId)`

1. `assertSettingOwnership(id, actorRole, actorCompanyId)`
2. `prisma.systemSetting.delete({ where: { id } })` — hard delete
3. `auditLog.log({ action: 'DELETE', resource: 'system_setting', before })`

---

### DTOs

#### `create-setting.dto.ts`

```typescript
class CreateSettingDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  key: string;

  @IsNotEmpty()
  value: unknown;            // any JSON value

  @IsOptional() @IsString()
  tenantId?: string;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
}
```

---

#### `update-setting.dto.ts`

```typescript
class UpdateSettingDto {
  @IsOptional()
  value?: unknown;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
}
```

---

## MODULE: Audit Log

### Files

```
apps/api/src/modules/audit-log/
├── audit-log.module.ts
├── audit-log.controller.ts
├── audit-log.service.ts
└── dto/
    └── create-audit-log.dto.ts
```

---

### `audit-log.module.ts`

```typescript
imports:  []                 ← no external module dependencies
providers: [AuditLogService]
controllers: [AuditLogController]
exports:  [AuditLogService]  ← exported for use by all other modules
```

AuditLogModule is imported by every service-bearing module. It is the most widely imported module in the codebase.

---

### `audit-log.service.ts`

**Dependencies injected**: `PrismaService`

AuditLogService is used in fire-and-forget mode by all other services — no awaiting of the log call in most callers (see Technical Debt report).

#### `log(dto)` — public

```typescript
async log({
  action: string,
  resource: string,
  resourceId?: string,
  actorId?: string,
  tenantId?: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  metadata?: Record<string, unknown>,
})
```

```typescript
prisma.auditLog.create({
  data: {
    action,
    resource,
    resourceId,
    actorId,
    tenantId,
    before: before ?? Prisma.DbNull,
    after: after ?? Prisma.DbNull,
    metadata: metadata ?? Prisma.DbNull,
    createdAt: new Date(),
  }
})
```

No batching. Every mutation event → 1 INSERT into `audit_logs`. High mutation rate pages (reorder with N blocks) could produce N audit records per user action.

---

#### `findByTenant(tenantId, actorRole, actorCompanyId, options?)`

1. SUPER_ADMIN: query all audit_logs for tenant, most recent first, with pagination
2. Others: ownership check on tenant, then query

```typescript
prisma.auditLog.findMany({
  where: { tenantId },
  orderBy: { createdAt: 'desc' },
  skip: options?.skip ?? 0,
  take: options?.take ?? 50,
})
```

No filtering by resource or action type — returns all audit records for tenant.

---

#### `findByResource(resource, resourceId, actorRole, actorCompanyId)`

1. Loads the first audit log record to extract tenantId for ownership check
2. Ownership check via tenantId
3. Returns all records for that resource+resourceId

---

#### `findAll(actorRole)` — SUPER_ADMIN only

```typescript
if (actorRole !== 'SUPER_ADMIN') throw ForbiddenException
prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
```

Hard-coded limit of 100 records. No pagination params. No cursor-based pagination. Poor scalability as audit log grows.

---

### `audit-log.controller.ts`

**Controller prefix**: `/audit-logs`

#### GET /audit-logs
- Role: `@Roles('SUPER_ADMIN')`
- Returns: last 100 audit records (hard limit)

#### GET /audit-logs/tenant/:tenantId
- Role: `@Roles('ADMIN')`
- Returns: paginated audit records for tenant (default 50)

#### GET /audit-logs/resource/:resource/:resourceId
- Role: `@Roles('ADMIN')`
- Returns: all audit records for a specific resource instance

---

### `dto/create-audit-log.dto.ts`

This DTO is defined but used only internally (service-to-service, not via HTTP). No controller endpoint accepts this DTO from external clients.

```typescript
class CreateAuditLogDto {
  @IsString() @IsNotEmpty()
  action: string;

  @IsString() @IsNotEmpty()
  resource: string;

  @IsOptional() @IsString()
  resourceId?: string;

  @IsOptional() @IsString()
  actorId?: string;

  @IsOptional() @IsString()
  tenantId?: string;

  @IsOptional() @IsObject()
  before?: Record<string, unknown>;

  @IsOptional() @IsObject()
  after?: Record<string, unknown>;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
```

---

## MODULE: Activity Log

### Files

```
apps/api/src/modules/activity-log/
├── activity-log.module.ts
├── activity-log.service.ts
└── (no controller)
```

**Status: DEAD CODE** — ActivityLogService has no callers in the codebase. No controller. No module imports ActivityLogModule.

---

### `activity-log.module.ts`

```typescript
imports:  []
providers: [ActivityLogService]
exports:  [ActivityLogService]
```

This module is NOT imported by AppModule or any other module. It exists as an exported module but is never wired in.

---

### `activity-log.service.ts`

**Dependencies injected**: `PrismaService`

#### `log(dto)`

```typescript
async log({
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  tenantId?: string,
  metadata?: Record<string, unknown>
})
```

```typescript
prisma.activityLog.create({ data: { userId, action, resource, resourceId, tenantId, metadata, createdAt: new Date() } })
```

#### `findByTenant(tenantId, options?)`

```typescript
prisma.activityLog.findMany({
  where: { tenantId },
  orderBy: { createdAt: 'desc' },
  skip: options?.skip ?? 0,
  take: options?.take ?? 50,
  include: { user: { select: { id, firstName, lastName, email } } }
})
```

#### `findRecent(userId, limit?)`

```typescript
prisma.activityLog.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  take: limit ?? 20,
})
```

**All three methods are unreachable** — no caller in the application.

---

## MODULE: Tenant Middleware

### Files

```
apps/api/src/modules/tenant/
├── tenant.module.ts
├── tenant.service.ts
└── (middleware in common/)

apps/api/src/common/middleware/
└── tenant.middleware.ts
```

---

### `tenant.module.ts`

```typescript
imports:  []
providers: [TenantService]
controllers: [TenantController]
exports:  [TenantService]
```

TenantModule is imported by AppModule, and TenantService is used by TenantMiddleware (injected via DI).

---

### `tenant.middleware.ts`

Registered in AppModule: `consumer.apply(TenantMiddleware).forRoutes('*')`

Runs on EVERY incoming request before any guard or controller.

---

#### Implementation

```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: FastifyRequest, res: FastifyReply, next: NextFunction) {
    const host = req.headers.host ?? '';
    const domain = host.split(':')[0]; // strip port

    if (!domain) {
      req.tenantContext = null;
      return next();
    }

    const result = await this.tenantService.resolveFromDomain(domain);

    if (!result) {
      req.tenantContext = null;
      return next();
    }

    if (result.type === 'REDIRECT') {
      return res.redirect(301, `https://${result.target}${req.url}`);
    }

    req.tenantContext = result.tenant;
    return next();
  }
}
```

Behavior on failure: sets `req.tenantContext = null` without throwing. No routes currently enforce `req.tenantContext !== null`. This means all routes are reachable even if the domain is unrecognized. Tenant context is informational, not a gate.

**Domain port stripping**: `host.split(':')[0]` — strips port from `localhost:3000` → `localhost`. Works in development. In production, host header should not contain port for standard HTTPS.

**REDIRECT handling**: If a domain is configured as `REDIRECT` type, issues an HTTP 301 to the canonical domain preserving the request path.

---

### `tenant.service.ts`

**Dependencies injected**: `PrismaService`

---

#### In-Memory Cache

```typescript
private cache = new Map<string, { tenant: TenantWithFlags; expiresAt: Date }>();
private readonly TTL_MS = 60_000; // 60 seconds
```

The cache is process-local. In a multi-instance deployment, each instance has its own cache. Cache invalidation by one instance doesn't propagate to others.

---

#### `resolveFromDomain(domain)` — public

Main resolution method. Called by TenantMiddleware on every request.

```typescript
async resolveFromDomain(domain: string): Promise<ResolveResult | null>
```

1. Check `cache.get(domain)` — if found and `expiresAt > now`, return cached value
2. `prisma.domain.findFirst({ where: { name: domain, deletedAt: null }, include: { tenant: { include: { domains, featureFlags, branding, company, product } } } })`
3. If not found → return `null`
4. If `domain.type === 'REDIRECT'` → return `{ type: 'REDIRECT', target: domain.targetDomain }`
5. Merge feature flags: global flags first, then tenant-specific flags on top
6. `cache.set(domain, { tenant: merged, expiresAt: new Date(Date.now() + TTL_MS) })`
7. Return `{ type: 'TENANT', tenant: merged }`

---

#### Feature Flag Merge Logic

```typescript
const globalFlags = await prisma.featureFlag.findMany({ where: { tenantId: null } });
const tenantFlags = tenant.featureFlags; // already loaded in include

// Build merged map: global defaults, overridden by tenant-specific
const flagMap = new Map<string, FeatureFlag>();
for (const flag of globalFlags) flagMap.set(flag.key, flag);
for (const flag of tenantFlags) flagMap.set(flag.key, flag);  // tenant wins

const mergedFlags = Array.from(flagMap.values());
```

This `findMany` for global flags is an additional DB query outside the main domain query. Every cache miss results in 2 DB queries: domain+tenant query + global flags query.

After merging, the result is cached with TTL. Subsequent requests for the same domain within 60 seconds return the merged result without any DB access.

---

#### `invalidateCache(domain?)` — public

```typescript
invalidateCache(domain?: string): void {
  if (domain) {
    this.cache.delete(domain);
  } else {
    this.cache.clear();
  }
}
```

This method exists but is **never called** by any service in the codebase. Domain create, update, and delete operations do not call `invalidateCache()`. Branding changes do not call it. Feature flag toggles do not call it.

---

#### `resolveOwnerCompanyId(tenant)` — private

```typescript
return tenant.company?.id ?? tenant.product?.companyId ?? null;
```

Exists inside TenantService for internal use. Each other service has its own copy of this logic. There are 10+ copies of this function across the codebase.

---

#### Caching Flow Diagram

```
Incoming request: host=app.nexuva.com
  │
  └─ TenantMiddleware.use()
        │
        └─ tenantService.resolveFromDomain('app.nexuva.com')
              │
              ├─ cache.get('app.nexuva.com') → HIT?
              │     └─ YES + not expired → return { type:'TENANT', tenant: cached }
              │
              └─ MISS or expired:
                    ├─ prisma.domain.findFirst({ name: 'app.nexuva.com' })
                    ├─ prisma.featureFlag.findMany({ tenantId: null })   ← extra query
                    ├─ merge global + tenant flags
                    ├─ cache.set('app.nexuva.com', { tenant, expiresAt: now+60s })
                    └─ return { type:'TENANT', tenant: merged }
```

---

#### `TenantWithFlags` type

The resolved TenantContext includes:
- `id`, `name`, `slug`, `plan`, `isActive`
- `domains: Domain[]` — all domains for this tenant
- `featureFlags: FeatureFlag[]` — merged (global + tenant-specific)
- `branding: Branding | null`
- `company: Company | null`
- `product: (Product & { company: Company }) | null`

---

### Tenant Module Controller — `tenant.controller.ts`

Not part of middleware flow. Separate HTTP controller for tenant CRUD.

**Controller prefix**: `/tenants`

#### GET /tenants
- Role: `@Roles('ADMIN')`

#### GET /tenants/:id
- Role: `@Roles('ADMIN')`

#### POST /tenants
- Role: `@Roles('SUPER_ADMIN')`

#### PATCH /tenants/:id
- Role: `@Roles('SUPER_ADMIN')`

#### DELETE /tenants/:id
- Role: `@Roles('SUPER_ADMIN')`
- Soft delete

---

## Platform Services Dependency Graph

```
AppModule
  ├─ AuditLogModule  ← imported by all service modules
  │    └─ AuditLogService (singleton, shared)
  │
  ├─ TenantModule
  │    └─ TenantService (used by TenantMiddleware, applied globally)
  │
  ├─ FeatureFlagsModule
  │    └─ AuditLogModule
  │
  ├─ SettingsModule
  │    └─ AuditLogModule
  │
  └─ ActivityLogModule  ← NOT imported by AppModule (dead module)
```

---

## Platform Services Route Access Matrix

| Route | VIEWER | CONTENT_EDITOR | PRODUCT_MANAGER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| GET /feature-flags | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /feature-flags/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| POST /feature-flags | ✗ | ✗ | ✗ | ✗ | ✓ |
| PATCH /feature-flags/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| PATCH /feature-flags/:id/toggle | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| DELETE /feature-flags/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /settings | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /settings/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /settings/key/:key | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| POST /settings | ✗ | ✗ | ✗ | ✗ | ✓ |
| PATCH /settings/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| DELETE /settings/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /audit-logs | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /audit-logs/tenant/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| GET /audit-logs/resource/:r/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |

---

## Audit Log Write Map — Which Services Write Audit Logs

| Service | Actions Logged |
|---|---|
| AuthService | `LOGIN`, `LOGOUT`, `REFRESH_TOKEN` |
| UsersService | `CREATE`, `UPDATE`, `DELETE`, `ASSIGN_ROLE`, `DEACTIVATE` |
| RolesService | `SET_PERMISSION`, `REMOVE_PERMISSION` |
| CompaniesService | `CREATE`, `UPDATE`, `DELETE` |
| ProductsService | `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE` |
| DomainsService | `CREATE`, `UPDATE`, `DELETE`, `VERIFY` |
| PagesService | `CREATE`, `UPDATE`, `PUBLISH`, `UNPUBLISH`, `DELETE` |
| ContentBlocksService | `CREATE`, `UPDATE`, `DELETE`, `REORDER`, `VISIBILITY_CHANGE` |
| SeoService | `CREATE`, `UPDATE`, `DELETE` |
| BrandingService | `CREATE`, `UPDATE`, `DELETE` |
| VersioningService | `CREATE_VERSION`, `ROLLBACK`, `RESTORE`, `DELETE_VERSION` |
| FeatureFlagsService | `CREATE`, `UPDATE`, `ENABLE`, `DISABLE`, `DELETE` |
| SettingsService | `CREATE`, `UPDATE`, `DELETE` |
| TenantService | `CREATE`, `UPDATE`, `DELETE` |

ActivityLogService: 0 write sites (dead code).
NotificationsService: 0 write sites for actual notification delivery (stub).
AuditInterceptor: 0 write sites — interceptor exists but is never registered.

---

## Notifications Module — Stub

```
apps/api/src/modules/notifications/
├── notifications.module.ts
├── notifications.service.ts
└── (no controller, no dto)
```

`NotificationsService.send()` exists but contains only:

```typescript
async send(userId: string, title: string, body: string, metadata?: unknown): Promise<void> {
  // TODO: implement push/email delivery
  await this.prisma.notification.create({
    data: { userId, title, body, metadata: metadata ?? Prisma.DbNull, isRead: false }
  });
}
```

The `notification.create` writes to the `notifications` table, but there is no delivery mechanism. No push, no email, no websocket. The records accumulate unread in the database. `send()` is never called by any other service.

---

## MCP Module — Stub

```
apps/api/src/modules/mcp/
├── mcp.module.ts
├── mcp.service.ts
├── mcp.controller.ts
└── dto/
    ├── create-mcp-provider.dto.ts
    └── create-mcp-connection.dto.ts
```

`McpService` comment: `// Implementation deferred to AI phase.`

All service methods are defined with correct signatures but return empty objects or throw `NotImplementedException`. Controller routes are wired but call into these stubs.

Prisma models that exist for this module: `McpProvider`, `McpConnection`, `AiAgent`, `AgentPermission`, `WorkflowDefinition`, `AgentAuditLog` — all defined in schema with full relations but unused.
