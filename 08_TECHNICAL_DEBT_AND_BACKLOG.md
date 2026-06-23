# 08 — TECHNICAL DEBT AND BACKLOG

---

## Overview

This report catalogs every identified bug, dead code path, missing safeguard, architectural smell, and risk item found across the entire Nexuva OS codebase. Items are grouped by severity and type, with precise file locations.

---

## CRITICAL BUGS (will cause runtime failures or data corruption)

---

### BUG-001: JwtStrategy calls `findById()` without required args — throws ForbiddenException for every authenticated user

**File**: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
**Severity**: CRITICAL — makes the entire app unusable in production

**What happens**:
```typescript
// jwt.strategy.ts — validate()
const user = await this.usersService.findById(payload.sub);  // no role/companyId args
```

`UsersService.findById(id, actorRole, actorCompanyId)` has an ownership check:
```typescript
// users.service.ts — findById()
if (user.companyId !== actorCompanyId) throw new ForbiddenException();
```

When called from JwtStrategy: `actorCompanyId` is `undefined`. `user.companyId !== undefined` is `true` for every user who has a `companyId`. This throws `ForbiddenException` on every authenticated request.

**Impact**: No authenticated user can access any protected route. Every request with a valid JWT returns 403.

**Likely reason this isn't caught**: The app has no integration tests. The bug exists at the interface between two methods and doesn't manifest during compilation or unit tests that mock dependencies.

**Fix**: JwtStrategy should call `findById(payload.sub, 'SUPER_ADMIN', null)` or a dedicated `findByIdForAuth()` method that skips ownership checks entirely.

---

### BUG-002: `refresh()` computes `tokenHash` but never uses it — token hash verification skipped

**File**: `apps/api/src/modules/auth/auth.service.ts`
**Severity**: HIGH — security vulnerability

**What happens**:
```typescript
async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
  // ...
  const tokenHash = await argon2.hash(dto.refreshToken); // computed but never used below

  const storedToken = await this.prisma.refreshToken.findFirst({
    where: { userId: payload.sub, isRevoked: false }
    // missing: hash verification
  });
  // ...
  const isValid = await argon2.verify(storedToken.tokenHash, dto.refreshToken); // this line IS correct
```

Wait — looking more carefully: `argon2.hash(dto.refreshToken)` is computed into `tokenHash` at the top, but the actual verification happens via `argon2.verify(storedToken.tokenHash, dto.refreshToken)` later, which IS the correct approach. The unused `tokenHash` variable is dead code (the hash is not needed to verify, only `argon2.verify` is needed). This is not a security bug — verification does happen — but the dead variable suggests the implementation was written with confusion about argon2 hash vs verify semantics.

**Actual issue**: The dead `tokenHash` variable will trigger a TypeScript `@typescript-eslint/no-unused-vars` warning if linting is enforced.

**Revised severity**: LOW — dead variable, no security impact.

---

### BUG-003: `expiresAt` hardcoded to 7 days, ignores `JWT_REFRESH_EXPIRY` config

**File**: `apps/api/src/modules/auth/auth.service.ts` → `signTokenPair()`
**Severity**: MEDIUM — config drift

**What happens**:
```typescript
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7); // hardcoded, ignores config
```

`JWT_REFRESH_EXPIRY` is read from env and passed to `JwtModule.registerAsync()`, so the JWT signature respects it. But the database record `refreshToken.expiresAt` is always 7 days regardless of what `JWT_REFRESH_EXPIRY` is set to.

If `JWT_REFRESH_EXPIRY` is changed to `'1d'` (short session), the JWT expires in 1 day but the DB record stays valid for 7 days. An expired JWT cannot be verified (correct), but the stale DB record remains and is not cleaned up.

If `JWT_REFRESH_EXPIRY` is changed to `'30d'`, the JWT is valid 30 days but the DB record expires in 7, causing premature `RefreshToken not found` errors.

**Fix**: Parse `JWT_REFRESH_EXPIRY` config value and compute `expiresAt` from it.

---

### BUG-004: Soft-deleted page ContentBlocks not cascade-soft-deleted

**File**: `apps/api/src/modules/pages/pages.service.ts` → `softDelete()`
**Severity**: MEDIUM — orphaned data

**What happens**:
```typescript
// pages.service.ts softDelete()
await this.prisma.page.update({
  where: { id },
  data: { deletedAt: new Date(), isPublished: false }
});
```

ContentBlocks, SeoSettings, and PageVersions associated with the soft-deleted page are not soft-deleted. They remain queryable in the DB. Prisma's `onDelete: Cascade` only fires on hard deletes, not soft deletes.

**Impact**:
- ContentBlocks for deleted pages can still appear in raw DB queries
- `findBySlug()` is safe because it filters `isPublished: true`
- `findByPage()` in ContentBlocks service filters `deletedAt: null` on the page join — this DOES prevent access correctly
- But `prisma.contentBlock.findMany({ where: { pageId } })` (without the page filter) would return orphaned blocks

**Fix**: In `pages.softDelete()` transaction: also `contentBlock.updateMany({ where: { pageId }, data: { deletedAt: new Date() } })`.

---

### BUG-005: Rollback uses hard `deleteMany` — wipes ALL blocks including soft-deleted ones

**File**: `apps/api/src/modules/versioning/versioning.service.ts` → `rollback()`
**Severity**: MEDIUM — data loss on rollback

**What happens**:
```typescript
await tx.contentBlock.deleteMany({ where: { pageId } });  // hard delete, no filter
```

This permanently deletes ALL ContentBlocks for the page including ones with `deletedAt` set (soft-deleted blocks). These blocks had been intentionally soft-deleted and retained in DB for audit purposes. After a rollback, they are gone.

**Impact**: Audit trail for soft-deleted blocks on that page is permanently destroyed.

**Fix**: Only hard-delete non-soft-deleted blocks: `{ where: { pageId, deletedAt: null } }`. OR accept this as intentional (rollback = full reset) and document it.

---

## HIGH SEVERITY — Security / Data Integrity

---

### DEBT-001: `@@unique([key, tenantId])` does not prevent duplicate global flags/settings

**Files**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/manual/partial_unique_indexes.sql`
**Severity**: HIGH — data integrity failure for global configuration

**Issue**: In PostgreSQL, `NULL != NULL` in unique index comparisons. Two rows with `key='feature_x', tenantId=NULL` do NOT violate the `@@unique([key, tenantId])` constraint because `NULL != NULL`. Multiple identical global flags can be created.

**Current mitigation**: A manual SQL file `partial_unique_indexes.sql` exists:
```sql
CREATE UNIQUE INDEX feature_flags_key_global_unique
  ON feature_flags (key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX system_settings_key_global_unique
  ON system_settings (key)
  WHERE tenant_id IS NULL;
```

**Status**: This file must be applied MANUALLY after each `prisma migrate`. It is not part of Prisma's managed migration history. It will be lost if the database is reset and only `prisma migrate deploy` is run.

**Fix**: Convert the manual SQL into a Prisma migration file, or add a post-migrate hook in CI/CD that always applies `partial_unique_indexes.sql`.

---

### DEBT-002: `resolveOwnerCompanyId()` duplicated 10+ times across services

**Files**: Every service file that does ownership checks
**Severity**: HIGH — maintenance risk

The pattern:
```typescript
private resolveOwnerCompanyId(tenant: TenantWithOwners): string | null {
  return tenant.company?.id ?? tenant.product?.companyId ?? null;
}
```

appears independently in:
- `pages.service.ts`
- `content-blocks.service.ts`
- `seo.service.ts`
- `branding.service.ts`
- `versioning.service.ts`
- `companies.service.ts`
- `products.service.ts`
- `domains.service.ts`
- `users.service.ts`
- `feature-flags.service.ts`
- `settings.service.ts`
- `tenant.service.ts`

If the ownership model changes (e.g., a third ownership type is added), 12 files must be updated consistently. Any missed update creates a security gap.

**Fix**: Extract to `@nexuva/shared` as `resolveOwnerCompanyId(tenant)` utility, or into a `OwnershipService` that can be injected.

---

### DEBT-003: `assertXxxOwnership()` duplicated across every service

**Files**: All service files
**Severity**: HIGH — copy-paste ownership logic, inconsistent error messages

Each service has its own implementation of the `assertXxxOwnership` pattern with slight variations. For example, `assertTenantOwnership` in `pages.service.ts` vs `branding.service.ts` vs `settings.service.ts` are structurally identical but independently maintained.

If a security rule changes (e.g., PRODUCT_MANAGER should bypass ownership on read), each file must be updated.

**Fix**: Create an `OwnershipGuard` or `OwnershipService` with a standardized `assertTenantOwnership(tenantId, actorRole, actorCompanyId)` method that all services call.

---

### DEBT-004: TenantService cache is never invalidated by mutation operations

**File**: `apps/api/src/modules/tenant/tenant.service.ts`
**Severity**: HIGH — stale data served after config changes

`TenantService.invalidateCache()` exists but is never called by:
- `DomainsService.update()` / `DomainsService.delete()` — domain changes don't clear cache
- `BrandingService.upsert()` / `BrandingService.reset()` — branding changes don't clear cache
- `FeatureFlagsService.toggle()` — flag changes take up to 60s to take effect
- `TenantService.update()` — tenant metadata changes don't clear cache

**Impact**:
- Delete a domain → it continues to route requests for up to 60 seconds
- Change branding colors → old colors served to incoming requests for 60 seconds
- Toggle a feature flag → feature remains in old state for up to 60 seconds

**Fix**: Each mutation method in the relevant services should call `tenantService.invalidateCache(domain)` for every domain associated with the affected tenant. Requires injecting TenantService into those services (creates potential circular dependency — use `forwardRef()` or event-based invalidation).

---

### DEBT-005: Permission table has no runtime enforcement

**Files**: `apps/api/src/modules/roles/roles.service.ts`, `apps/api/prisma/schema.prisma`
**Severity**: HIGH — access control model incomplete

The `Permission` table stores `{ userId, resource, action, scope }` records. `RolesService` has methods to `setPermission()` and `removePermission()`. But `RolesGuard` in `roles.guard.ts` only checks `user.role` (the enum weight), never reads the `Permission` table.

**Impact**: All fine-grained permissions set via the Roles API are stored but never enforced. The permission system is a dead schema feature.

**Fix**: Extend `RolesGuard` or create a `PermissionsGuard` that reads `Permission` records. Define `@RequirePermission('page', 'publish')` decorator and evaluate against Permission table.

---

## MEDIUM SEVERITY — Missing Safeguards / Logic Gaps

---

### DEBT-006: `CreateVersionDto.reason` field accepted but never stored

**File**: `apps/api/src/modules/versioning/dto/create-version.dto.ts`, `versioning.service.ts`
**Severity**: MEDIUM — API surface lie

The DTO accepts a `reason` string (e.g., "Manual checkpoint before major edit"). The `PageVersion` model has no `reason` column. The field is silently discarded.

**Fix**: Add `reason String?` to `PageVersion` model in `schema.prisma` and store it in `captureVersionInTx()`.

---

### DEBT-007: `Page.currentVersion` field is vestigial

**File**: `apps/api/prisma/schema.prisma`, `pages.service.ts`
**Severity**: MEDIUM — misleading schema

`Page.currentVersion` is set to `1` on create and never updated. The actual version count is determined by querying `PageVersion` with `orderBy: { versionNumber: 'desc' }`. The field implies the current active version number but is always stale after the first version is created.

**Fix**: Either remove the field from the schema, or update it in `captureVersionInTx()` as part of the version snapshot transaction.

---

### DEBT-008: No slug format validation on Company and Product DTOs

**Files**: `apps/api/src/modules/companies/dto/create-company.dto.ts`, `apps/api/src/modules/products/dto/create-product.dto.ts`
**Severity**: MEDIUM — data quality

`CreatePageDto` enforces:
```typescript
@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
slug: string;
```

But `CreateCompanyDto` and `CreateProductDto` accept any string for `slug`. Mixed-case, spaces, special characters are all accepted and stored. This breaks URL construction, slug-based lookups, and tenant resolution.

**Fix**: Add `@Matches(SLUG_REGEX)` to `slug` fields in all DTOs that accept slugs.

---

### DEBT-009: `UpdateStatusDto` defined inline in `products.controller.ts`

**File**: `apps/api/src/modules/products/products.controller.ts`
**Severity**: LOW — code organization

```typescript
// Defined directly in controller file, not in dto/
class UpdateStatusDto {
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
```

All other DTOs are in `dto/` subdirectories. This breaks the established convention and makes the DTO untestable in isolation.

**Fix**: Move to `apps/api/src/modules/products/dto/update-status.dto.ts`.

---

### DEBT-010: `findById()` in ContentBlocksService makes 2 DB queries

**File**: `apps/api/src/modules/content-blocks/content-blocks.service.ts`
**Severity**: LOW — performance

`assertBlockOwnership()` loads the block with full ownership chain. Then `findById()` calls `prisma.contentBlock.findUnique({ where: { id } })` again to get the "clean" block without ownership data. Two round trips to the database for a single block read.

**Fix**: Return the block from `assertBlockOwnership()` and strip the `page.tenant` chain from the response, or define a separate Prisma select without ownership fields.

---

### DEBT-011: Branding cache not invalidated after reset

**File**: `apps/api/src/modules/branding/branding.service.ts` → `reset()`
**Severity**: MEDIUM (duplicate of DEBT-004 from branding angle)

After `BrandingService.reset()` hard-deletes a branding record, `TenantService` cache still holds the old branding data. Requests hitting the same tenant within 60 seconds will still see the deleted branding.

---

### DEBT-012: AuditLog writes are fire-and-forget (unawaited)

**Files**: All service files that call `auditLogService.log()`
**Severity**: MEDIUM — audit gap on failure

Pattern in most services:
```typescript
// Note: not awaited
this.auditLogService.log({ action: 'UPDATE', resource: 'page', ... });
```

If the audit log INSERT fails (DB down, constraint violation), the main operation has already succeeded. The audit record is silently lost. The caller has no way to know.

In some services, `auditLog.log()` IS awaited, inconsistently.

**Fix**: Define a policy — either always await (audit is mandatory, fail the request if logging fails), or always fire-and-forget and accept the gap. If fire-and-forget, add error handling inside `log()` with a catch-and-log-to-console fallback.

---

### DEBT-013: Hard-coded audit log limit of 100

**File**: `apps/api/src/modules/audit-log/audit-log.service.ts` → `findAll()`
**Severity**: MEDIUM — scalability

```typescript
prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
```

No pagination. No cursor. No filtering by date range. In a production system with hundreds of operations per day, this endpoint becomes useless quickly.

**Fix**: Add `skip`, `take`, `startDate`, `endDate`, `resource`, `action` query params with cursor-based pagination.

---

### DEBT-014: No index on `audit_logs.tenantId` or `audit_logs.createdAt`

**File**: `apps/api/prisma/schema.prisma` → `AuditLog` model
**Severity**: MEDIUM — query performance

`AuditLog` is queried frequently by `tenantId` and ordered by `createdAt`. Without indexes:
- Full table scan on every `findByTenant()` call
- Grows worse as audit log volume increases

The `AuditLog` model has no `@@index` directives.

**Fix**:
```prisma
@@index([tenantId])
@@index([createdAt])
@@index([resource, resourceId])
```

---

### DEBT-015: No index on `page_versions.pageId`

**File**: `apps/api/prisma/schema.prisma` → `PageVersion` model
**Severity**: MEDIUM — query performance

`captureVersionInTx` does:
```typescript
tx.pageVersion.findFirst({ where: { pageId }, orderBy: { versionNumber: 'desc' } })
```

This runs inside every CMS mutation transaction. Without an index on `pageId` and `versionNumber`, it's a full scan of the `page_versions` table filtered in memory.

**Fix**:
```prisma
@@index([pageId, versionNumber(sort: Desc)])
```

---

### DEBT-016: No index on `content_blocks.pageId` + `position`

**File**: `apps/api/prisma/schema.prisma` → `ContentBlock` model
**Severity**: MEDIUM — query performance

`captureVersionInTx` does:
```typescript
tx.contentBlock.findMany({ where: { pageId, deletedAt: null }, orderBy: { position: 'asc' } })
```

Every CMS mutation triggers this query. Without a composite index, each call does a full scan filtered by pageId.

**Fix**:
```prisma
@@index([pageId, position])
```

---

### DEBT-017: `@nexuva/shared` `hasRoleOrHigher` semantics unclear for edge case

**File**: `packages/shared/src/utils/roles.ts`
**Severity**: LOW — potential guard bypass

`hasRoleOrHigher(userRole, requiredRole)` uses weight comparison. `RolesGuard`:
```typescript
if (!hasRoleOrHigher(user.role, requiredRole)) throw ForbiddenException
```

If `user.role` is `null` or `undefined` (which shouldn't happen but could if a bug in user creation omits the role), the behavior of `hasRoleOrHigher` with null input is undefined. If it returns `true`, the user bypasses all role checks.

**Fix**: Add explicit null/undefined guard: `if (!user.role) throw ForbiddenException` before the role check.

---

## LOW SEVERITY — Dead Code, Stubs, and Organizational Issues

---

### DEAD-001: `ActivityLogModule` is not imported by AppModule — entire module is dead

**File**: `apps/api/src/modules/activity-log/activity-log.module.ts`
**Severity**: LOW — wasted code

The module, service, and all its methods (`log`, `findByTenant`, `findRecent`) are defined but unreachable. No service injects `ActivityLogService`. `ActivityLogModule` is not in AppModule's imports.

**Action**: Either wire it into AppModule and add callers, or delete it.

---

### DEAD-002: `AuditInterceptor` is never registered

**File**: `apps/api/src/common/interceptors/audit.interceptor.ts`
**Severity**: LOW — dead code

The interceptor is defined and injectable but not registered in AppModule providers, not applied to any controller, not referenced anywhere.

**Action**: Either register it globally (`APP_INTERCEPTOR` provider), apply it selectively, or delete it.

---

### DEAD-003: `NotificationsService.send()` is never called

**File**: `apps/api/src/modules/notifications/notifications.service.ts`
**Severity**: LOW — stub

Notifications writes to DB but has no delivery mechanism and no callers.

**Action**: Document as deferred, add a `// TODO: wire up delivery` comment if keeping, or delete until AI phase.

---

### DEAD-004: `McpService` — complete stub

**File**: `apps/api/src/modules/mcp/mcp.service.ts`
**Severity**: LOW — placeholder

All methods throw `NotImplementedException`. Six Prisma models exist solely for this future feature.

**Action**: Mark module as `@Module({ providers: [], controllers: [] })` and remove the controller from AppModule routing until the AI phase begins.

---

### DEAD-005: `DomainsService.findByDomainName()` — no route exposure

**File**: `apps/api/src/modules/domains/domains.service.ts`
**Severity**: LOW — dead public method

`findByDomainName(name: string)` is a public service method with no corresponding controller route and no service-to-service callers. Used only by `TenantMiddleware` indirectly (TenantService does the domain lookup). The method in DomainsService itself is never called.

**Action**: Remove or add a route if needed.

---

### DEAD-006: `@TenantContext()` decorator defined but never used in controllers

**File**: `apps/api/src/common/decorators/tenant-context.decorator.ts`
**Severity**: LOW — dead decorator

```typescript
export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.tenantContext;
  }
);
```

This decorator is defined to extract `req.tenantContext` into a controller parameter. No controller in the codebase uses `@TenantContext()`. All controllers use `@Req() req` or `@CurrentUser()`.

**Action**: Either adopt it in controllers or delete it.

---

### DEAD-007: `roles.service.ts` `Permission` methods have no guard integration

**File**: `apps/api/src/modules/roles/roles.service.ts`
**Severity**: MEDIUM (overlaps with DEBT-005)

`setPermission()` and `removePermission()` are wired to API routes and store data. But nothing reads this data at request time. The admin UI shows permissions, users can be assigned them, but they have zero effect on access control.

---

## Missing Indexes Summary

| Table | Missing Index | Query Affected |
|---|---|---|
| `audit_logs` | `tenantId` | `findByTenant()` |
| `audit_logs` | `createdAt` | `findAll()` ORDER BY |
| `audit_logs` | `(resource, resourceId)` | `findByResource()` |
| `page_versions` | `(pageId, versionNumber DESC)` | `captureVersionInTx` |
| `content_blocks` | `(pageId, position)` | Every CMS mutation |
| `refresh_tokens` | `(userId, isRevoked)` | `logout()` revocation |
| `domains` | `(name, deletedAt)` | `resolveFromDomain()` on cache miss |
| `activity_logs` | `(userId)` | `findRecent()` (if ever enabled) |

---

## Circular Dependency Risk

No circular dependencies currently exist in the module graph. All module import directions are:

```
Feature modules → AuditLogModule → (no imports)
Feature modules → VersioningModule → AuditLogModule
TenantModule → (no imports)
AuthModule → UsersModule, JwtModule
UsersModule → (no feature module imports)
```

**Potential circular dependency**: If `DomainsService` ever needs to inject `TenantService` for cache invalidation, or if `FeatureFlagsService` needs `TenantService` — this creates:
```
FeatureFlagsModule → TenantModule → (already imports nothing)
```
Not circular. However:
```
TenantModule ← AppModule imports both ← FeatureFlagsModule
```
If TenantModule ever imports FeatureFlagsModule: circular. Use `forwardRef()` if this happens.

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-001 | BUG-001 crashes all authenticated requests | Certain if app is started | CRITICAL | Fix JwtStrategy.validate() |
| R-002 | Duplicate global flags break feature resolution | Medium (requires SUPER_ADMIN create) | HIGH | Apply partial_unique_indexes.sql |
| R-003 | Stale tenant cache serves deleted domains | Medium | HIGH | Wire invalidateCache() |
| R-004 | Rollback destroys soft-deleted block audit trail | Low (requires rollback) | MEDIUM | Filter deleteMany |
| R-005 | Audit log fills disk with no archival strategy | Certain (long term) | HIGH | Add TTL/archival job |
| R-006 | Permission table gives false confidence in RBAC | Certain (admin uses it) | HIGH | Implement PermissionsGuard |
| R-007 | No integration tests — bugs like BUG-001 survive CI | Certain | HIGH | Add e2e tests with real DB |
| R-008 | Multi-instance deployment: each instance has own cache | Certain if scaled | MEDIUM | Use Redis for shared cache |
| R-009 | Manual SQL migration lost on DB reset | Medium | HIGH | Automate in migration pipeline |
| R-010 | `captureVersionInTx` runs inside every mutation tx, slowing writes | Certain at scale | MEDIUM | Async versioning queue |

---

## TODO / FIXME Inventory

| Location | Comment | Type |
|---|---|---|
| `mcp.service.ts` | `// Implementation deferred to AI phase.` | Stub |
| `notifications.service.ts` | `// TODO: implement push/email delivery` | TODO |
| `versioning.dto.ts (create)` | `reason` field accepted but unused | Schema gap |
| `auth.service.ts` | `tokenHash` variable computed but dead | Dead var |
| `tenant.service.ts` | `invalidateCache()` exists but never called | Wiring gap |
| `audit.interceptor.ts` | Interceptor defined, never registered | Dead code |
| `activity-log.service.ts` | Module not imported by AppModule | Dead module |
| Multiple service files | `resolveOwnerCompanyId()` duplicated | Refactor |
| Multiple service files | `assertXxxOwnership()` duplicated | Refactor |
| `pages.service.ts` | `currentVersion` never updated | Vestigial field |

---

## Recommended Fix Priority

### Immediate (before any user-facing deployment)

1. **BUG-001** — Fix JwtStrategy to not pass ownership args to findById
2. **DEBT-001** — Apply `partial_unique_indexes.sql` and automate it
3. **BUG-003** — Fix `expiresAt` to respect `JWT_REFRESH_EXPIRY` config

### Short-term (next sprint)

4. **DEBT-004** — Wire `invalidateCache()` to domain/branding/flag mutations
5. **DEBT-015 + DEBT-016** — Add missing indexes on `page_versions` and `content_blocks`
6. **DEBT-014** — Add indexes on `audit_logs`
7. **BUG-004** — Cascade soft-delete to ContentBlocks when Page is soft-deleted
8. **DEBT-006** — Add `reason` column to `PageVersion` and store it

### Medium-term (architectural cleanup)

9. **DEBT-002 + DEBT-003** — Extract `resolveOwnerCompanyId` and `assertOwnership` to shared utility
10. **DEBT-005** — Implement `PermissionsGuard` to enforce Permission table
11. **DEBT-008** — Add slug validation to Company and Product DTOs
12. **DEBT-012** — Define consistent await/fire-and-forget policy for audit log calls
13. **DEAD-001, DEAD-002** — Wire or delete ActivityLogModule and AuditInterceptor

### Long-term (AI phase)

14. Implement McpService (deferred)
15. Implement NotificationsService delivery
16. Add Redis-based distributed cache for TenantService
17. Add integration/e2e test suite
