# 09C — DETAILED PLATFORM SERVICES
## Companies, Products, Domains, Feature Flags, Settings, Audit Log, Activity Log, Tenant, Notifications, MCP

---

# MODULE: Companies

## Folder Tree

```
apps/api/src/modules/companies/
├── companies.module.ts
├── companies.controller.ts
├── companies.service.ts
└── dto/
    ├── create-company.dto.ts
    └── update-company.dto.ts
```

---

## File Details

### `companies.module.ts`

**Location**: `apps/api/src/modules/companies/companies.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [CompaniesService],
  controllers: [CompaniesController],
  exports: [],
})
```

**Who imports this module**: `AppModule`

---

### `companies.controller.ts`

**Location**: `apps/api/src/modules/companies/companies.controller.ts`

**Purpose**: HTTP interface for company management. Companies are the top-level organizational unit in the multi-tenant hierarchy. Every tenant (and by extension every page, product, domain) is ultimately owned by a company.

**Imports**:
```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
```

**Routes**:

#### `GET /companies`
- `@Roles('ADMIN')`
- No query params
- SUPER_ADMIN: all companies. ADMIN: only their own company.
- Calls: `CompaniesService.findAll(user.role, user.companyId)`

#### `GET /companies/:id`
- `@Roles('ADMIN')`
- Calls: `CompaniesService.findById(id, user.role, user.companyId)`
- Returns: Company with tenants, products, user count

#### `POST /companies`
- `@Roles('SUPER_ADMIN')` — only SUPER_ADMIN can create companies
- Body: `CreateCompanyDto`
- Calls: `CompaniesService.create(dto, user.id)`
- Returns: Created company

#### `PATCH /companies/:id`
- `@Roles('ADMIN')`
- Body: `UpdateCompanyDto`
- Calls: `CompaniesService.update(id, dto, user.id, user.role, user.companyId)`

#### `DELETE /companies/:id`
- `@Roles('SUPER_ADMIN')` — only SUPER_ADMIN can delete companies
- Calls: `CompaniesService.softDelete(id, user.id, user.role, user.companyId)`

---

### `companies.service.ts`

**Location**: `apps/api/src/modules/companies/companies.service.ts`

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
```

**Database models used**: `Company` (all CRUD), `Tenant` (read, create on company create), `AuditLog`

---

#### Method: `findAll(actorRole, actorCompanyId)`

```typescript
if (actorRole === 'SUPER_ADMIN') {
  return prisma.company.findMany({
    where: { deletedAt: null },
    include: { tenants: { where: { deletedAt: null } }, _count: { select: { users: true } } },
  });
}

return prisma.company.findMany({
  where: { id: actorCompanyId ?? '__none__', deletedAt: null },
  include: { tenants: { where: { deletedAt: null } }, _count: { select: { users: true } } },
});
```

Non-SUPER_ADMIN sees at most one company — their own. If `actorCompanyId` is null, `'__none__'` sentinel produces empty result.

---

#### Method: `findById(id, actorRole, actorCompanyId)`

1. `prisma.company.findFirst({ where: { id, deletedAt: null }, include: { tenants, products, users count } })`
2. If not found → `NotFoundException`
3. Ownership: non-SUPER_ADMIN → `if (company.id !== actorCompanyId) throw ForbiddenException`

---

#### Method: `create(dto, actorId)`

SUPER_ADMIN only (enforced at controller, not re-checked in service).

1. `prisma.company.findFirst({ where: { slug: dto.slug, deletedAt: null } })` — slug uniqueness check
2. If exists → `ConflictException`
3. `prisma.company.create({ data: { name, slug, description, logoUrl, websiteUrl } })`
4. Create company's default holding tenant:
```typescript
await prisma.tenant.create({
  data: {
    name: `${dto.name} (Holding)`,
    slug: dto.slug,
    plan: 'ENTERPRISE',
    isActive: true,
    companyId: company.id,
  },
});
```
5. `auditLog.log({ action: 'CREATE', resource: 'company', after: { name, slug } })`

**Note**: Company creation automatically creates a Holding tenant. This is the primary tenant for the company itself. Product tenants are created separately via the Products module.

**Slug format issue (DEBT-008)**: Company slug has no format validation — accepts spaces, uppercase, special characters. Should have `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`.

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

1. Load company (findById + ownership check)
2. If `dto.slug` is provided: check uniqueness across non-deleted companies (excluding self)
3. `prisma.company.update({ where: { id }, data: { name, slug, description, logoUrl, websiteUrl } })`
4. `auditLog.log({ action: 'UPDATE', before, after: dto })`

---

#### Method: `softDelete(id, actorId, actorRole, actorCompanyId)`

1. SUPER_ADMIN only (actorRole check in service — redundant with controller but defensive)
2. Load company
3. `prisma.company.update({ where: { id }, data: { deletedAt: new Date() } })`
4. `auditLog.log({ action: 'DELETE', resource: 'company', before: { name, slug } })`

**Note**: Soft-deleting a company does NOT cascade-soft-delete tenants, products, users, or domains. These remain active in the DB. This is a significant gap — cascade soft-delete should be implemented or a blocking check should prevent deletion of companies with active tenants.

---

### Companies DTOs

#### `dto/create-company.dto.ts`

```typescript
export class CreateCompanyDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  slug: string;               // NO slug format validation — accepts any string

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsUrl()
  logoUrl?: string;

  @IsOptional() @IsUrl()
  websiteUrl?: string;
}
```

---

#### `dto/update-company.dto.ts`

```typescript
export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(100)
  slug?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsUrl()
  logoUrl?: string;

  @IsOptional() @IsUrl()
  websiteUrl?: string;
}
```

---

## Companies Dependency Graph

```
CompaniesController
  │
  └─ CompaniesService
        ├─ PrismaService (company, tenant tables)
        └─ AuditLogService
```

---

# MODULE: Products

## Folder Tree

```
apps/api/src/modules/products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
└── dto/
    ├── create-product.dto.ts
    └── update-product.dto.ts
```

---

## File Details

### `products.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [],
})
```

---

### `products.controller.ts`

**Location**: `apps/api/src/modules/products/products.controller.ts`

**Purpose**: HTTP interface for product management. Products are sub-entities under Companies. Each product gets its own tenant for CMS and domain management.

**Note**: `UpdateStatusDto` is defined inline in this file (DEBT-009):
```typescript
// Inline DTO — should be in dto/update-status.dto.ts
class UpdateStatusDto {
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
```

**Routes**:

#### `GET /products`
- `@Roles('ADMIN')`
- Query: `companyId?: string`
- SUPER_ADMIN: all products. Others: own company's products only.

#### `GET /products/:id`
- `@Roles('ADMIN')`

#### `POST /products`
- `@Roles('ADMIN')` — ADMIN can create products (unlike companies which require SUPER_ADMIN)
- Body: `CreateProductDto`

#### `PATCH /products/:id`
- `@Roles('ADMIN')`
- Body: `UpdateProductDto`

#### `PATCH /products/:id/status`
- `@Roles('PRODUCT_MANAGER')` — lower than general update
- Body: `UpdateStatusDto { status: ProductStatus }`
- Calls: `ProductsService.updateStatus(id, dto.status, user.id, user.role, user.companyId)`

#### `DELETE /products/:id`
- `@Roles('ADMIN')`

---

### `products.service.ts`

**Location**: `apps/api/src/modules/products/products.service.ts`

**Database models used**: `Product` (all CRUD), `Company` (read for ownership), `Tenant` (create on product create), `AuditLog`

---

#### Method: `assertOwnership(productId, actorRole, actorCompanyId)` — private

```typescript
const product = await this.prisma.product.findFirst({
  where: { id: productId, deletedAt: null },
  include: { company: { select: { id: true } } },
});
if (!product) throw new NotFoundException();
if (actorRole === 'SUPER_ADMIN') return product;
if (product.company.id !== actorCompanyId) throw new ForbiddenException();
return product;
```

Different ownership chain from Page: Products are directly under Company (not via Tenant). So ownership check is `product.company.id !== actorCompanyId` — simpler than page ownership.

---

#### Method: `create(dto, actorId, actorRole, actorCompanyId)`

1. Load company: `prisma.company.findFirst({ where: { id: dto.companyId, deletedAt: null } })`
2. If not found → `NotFoundException`
3. Ownership: `company.id !== actorCompanyId` → `ForbiddenException` (non-SUPER_ADMIN)
4. Slug uniqueness within company: `prisma.product.findFirst({ where: { slug: dto.slug, companyId: dto.companyId, deletedAt: null } })`
5. If exists → `ConflictException`
6. `prisma.product.create({ data: { name, slug, description, companyId, status: 'DRAFT', logoUrl } })`
7. Create product's tenant:
```typescript
await prisma.tenant.create({
  data: {
    name: dto.name,
    slug: dto.slug,
    plan: 'STARTER',        // default plan for product tenants
    isActive: true,
    productId: product.id,  // linked to product, not company
  },
});
```
8. `auditLog.log({ action: 'CREATE', resource: 'product', after: { name, slug, companyId } })`

**Product status flow**: Products start as `DRAFT`. Can be moved to `ACTIVE` or `ARCHIVED` via `updateStatus()`.

---

#### Method: `updateStatus(id, status, actorId, actorRole, actorCompanyId)`

1. `const product = await this.assertOwnership(id, actorRole, actorCompanyId)`
2. If `product.status === status` → return `{ id, status, changed: false }` (idempotent)
3. `prisma.product.update({ where: { id }, data: { status } })`
4. `auditLog.log({ action: 'STATUS_CHANGE', before: { status: old }, after: { status } })`

**ProductStatus enum**: `DRAFT | ACTIVE | ARCHIVED`

---

### Products DTOs

#### `dto/create-product.dto.ts`

```typescript
export class CreateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  slug: string;                  // NO slug format validation (DEBT-008)

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsString() @IsNotEmpty()
  companyId: string;

  @IsOptional() @IsUrl()
  logoUrl?: string;
}
```

---

#### `dto/update-product.dto.ts`

```typescript
export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsUrl()
  logoUrl?: string;
  // slug and companyId NOT updatable after create
}
```

---

## Products Dependency Graph

```
ProductsController
  │
  └─ ProductsService
        ├─ PrismaService (product, company, tenant tables)
        └─ AuditLogService
```

---

# MODULE: Domains

## Folder Tree

```
apps/api/src/modules/domains/
├── domains.module.ts
├── domains.controller.ts
├── domains.service.ts
└── dto/
    ├── create-domain.dto.ts
    └── update-domain.dto.ts
```

---

## File Details

### `domains.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [],
})
```

---

### `domains.controller.ts`

**Location**: `apps/api/src/modules/domains/domains.controller.ts`

**Purpose**: HTTP interface for domain management. Domains link a hostname to a tenant. Each domain has a type (PRIMARY, SECONDARY, REDIRECT) and an optional verification status.

**Routes**:

#### `GET /domains`
- `@Roles('ADMIN')`
- Query: `tenantId?: string`

#### `GET /domains/:id`
- `@Roles('ADMIN')`

#### `POST /domains`
- `@Roles('ADMIN')`
- Body: `CreateDomainDto`

#### `PATCH /domains/:id`
- `@Roles('ADMIN')`
- Body: `UpdateDomainDto`

#### `POST /domains/:id/verify`
- `@Roles('ADMIN')`
- HTTP 200
- Sets `isVerified: true`

#### `DELETE /domains/:id`
- `@Roles('SUPER_ADMIN')` — hard delete
- Hard delete (not soft delete — domain records do not have `deletedAt`)

---

### `domains.service.ts`

**Location**: `apps/api/src/modules/domains/domains.service.ts`

**Database models used**: `Domain` (create, read, update, delete — HARD DELETE), `Tenant` (ownership chain), `Company`, `Product`, `AuditLog`

---

#### Method: `assertTenantOwnership(tenantId, actorRole, actorCompanyId)` — private

Standard pattern. Loads tenant with company + product. SUPER_ADMIN bypass. Company match check.

---

#### Method: `assertDomainOwnership(domainId, actorRole, actorCompanyId)` — private

```typescript
const domain = await this.prisma.domain.findFirst({
  where: { id: domainId, deletedAt: null },
  include: {
    tenant: {
      select: {
        company: { select: { id: true } },
        product: { select: { companyId: true } },
      },
    },
  },
});
if (!domain) throw new NotFoundException();
if (actorRole === 'SUPER_ADMIN') return domain;

const ownerCompanyId = domain.tenant.company?.id ?? domain.tenant.product?.companyId ?? null;
if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();
return domain;
```

---

#### Method: `findAll(actorRole, actorCompanyId, tenantId?)`

```typescript
if (actorRole === 'SUPER_ADMIN') {
  return prisma.domain.findMany({
    where: { deletedAt: null, ...(tenantId && { tenantId }) },
    include: { tenant: { select: { id, name, slug } } },
  });
}

return prisma.domain.findMany({
  where: {
    deletedAt: null,
    ...(tenantId && { tenantId }),
    tenant: {
      OR: [
        { company: { id: actorCompanyId } },
        { product: { companyId: actorCompanyId } },
      ],
    },
  },
  include: { tenant: { select: { id, name, slug } } },
});
```

---

#### Method: `create(dto, actorId, actorRole, actorCompanyId)`

1. `assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId)`
2. Global uniqueness: `prisma.domain.findFirst({ where: { name: dto.name, deletedAt: null } })`
3. If exists → `ConflictException('Domain already registered')`
4. `prisma.domain.create({ data: { tenantId, name, type, targetDomain, isVerified: false } })`
5. `auditLog.log({ action: 'CREATE', resource: 'domain', after: { name, type, tenantId } })`

**Domain type enum**: `PRIMARY | SECONDARY | REDIRECT`
- `PRIMARY`: Main domain for the tenant
- `SECONDARY`: Alias — resolves same tenant but not canonical
- `REDIRECT`: Issues 301 to `targetDomain` (handled by TenantMiddleware)

**`targetDomain` field**: Only meaningful for `REDIRECT` type. For PRIMARY/SECONDARY, should be null.

**Cache invalidation gap**: Creating a new domain does NOT invalidate TenantService cache. If a tenant had been resolved via another domain and cached, the new domain will not be recognized until cache TTL expires.

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `assertDomainOwnership(id, actorRole, actorCompanyId)`
2. If `dto.name` is being changed: uniqueness check for new name
3. `prisma.domain.update({ where: { id }, data: { name, type, targetDomain } })`
4. `auditLog.log({ action: 'UPDATE', before, after: dto })`

**Cache invalidation gap**: Updating a domain does NOT call `tenantService.invalidateCache()`. The old domain name may still be cached and resolve to this tenant for up to 60 seconds. The new domain name won't resolve until the first request with it arrives and misses the cache.

---

#### Method: `verify(id, actorId, actorRole, actorCompanyId)`

1. `assertDomainOwnership(id, actorRole, actorCompanyId)`
2. If already verified → return `{ id, isVerified: true, changed: false }`
3. `prisma.domain.update({ where: { id }, data: { isVerified: true, verifiedAt: new Date() } })`
4. `auditLog.log({ action: 'VERIFY', resource: 'domain', after: { isVerified: true } })`

**Note**: Verification is manual — no DNS TXT record check or automated verification. ADMIN just sets `isVerified: true`. This is a placeholder for a future DNS verification flow.

---

#### Method: `remove(id, actorId, actorRole, actorCompanyId)`

1. SUPER_ADMIN check (in service)
2. `assertDomainOwnership(id, actorRole, actorCompanyId)` → loads domain
3. `prisma.domain.delete({ where: { id } })` — HARD DELETE (no `deletedAt` on Domain)
4. `auditLog.log({ action: 'DELETE', resource: 'domain', before: { name, type, tenantId } })`

**Cache invalidation gap**: Hard-deleting a domain does NOT invalidate TenantService cache. If the deleted domain is cached, incoming requests for it will continue to resolve to the (now domainless) tenant for up to 60 seconds.

---

#### Method: `findByDomainName(name)` — dead code

```typescript
async findByDomainName(name: string) {
  return this.prisma.domain.findFirst({
    where: { name, deletedAt: null },
    include: { tenant: true },
  });
}
```

**Status**: DEAD CODE — no route, no service-to-service caller. TenantService does its own domain lookup independently.

---

### Domains DTOs

#### `dto/create-domain.dto.ts`

```typescript
export class CreateDomainDto {
  @IsString() @IsNotEmpty()
  tenantId: string;

  @IsString() @IsNotEmpty() @MaxLength(253)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9-]+)*(?:\.[a-zA-Z]{2,})$/, {
    message: 'name must be a valid domain name',
  })
  name: string;                  // validates domain name format

  @IsEnum(DomainType)
  type: DomainType;              // PRIMARY | SECONDARY | REDIRECT

  @IsOptional() @IsString()
  targetDomain?: string;         // required for REDIRECT type, not enforced at DTO level
}
```

**Note**: `targetDomain` should be required when `type === 'REDIRECT'` but this conditional validation is not enforced at DTO level. The service should validate this but currently does not.

---

#### `dto/update-domain.dto.ts`

```typescript
export class UpdateDomainDto {
  @IsOptional() @IsString() @MaxLength(253)
  name?: string;

  @IsOptional() @IsEnum(DomainType)
  type?: DomainType;

  @IsOptional() @IsString()
  targetDomain?: string;
  // tenantId NOT updatable after create
}
```

---

## Domains Dependency Graph

```
DomainsController
  │
  └─ DomainsService
        ├─ PrismaService (domain, tenant, company, product tables)
        └─ AuditLogService

TenantMiddleware → TenantService.resolveFromDomain()
  └─ prisma.domain.findFirst() (separate query, NOT via DomainsService)
```

---

# MODULE: Feature Flags

## Folder Tree

```
apps/api/src/modules/feature-flags/
├── feature-flags.module.ts
├── feature-flags.controller.ts
├── feature-flags.service.ts
└── dto/
    ├── create-feature-flag.dto.ts
    ├── update-feature-flag.dto.ts
    └── toggle-feature-flag.dto.ts
```

---

## File Details

### `feature-flags.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [FeatureFlagsService],
  controllers: [FeatureFlagsController],
  exports: [],
})
```

---

### `feature-flags.controller.ts`

**Location**: `apps/api/src/modules/feature-flags/feature-flags.controller.ts`

**Routes**:

#### `GET /feature-flags`
- `@Roles('ADMIN')`
- Query: `tenantId?: string`

#### `GET /feature-flags/:id`
- `@Roles('ADMIN')`

#### `POST /feature-flags`
- `@Roles('SUPER_ADMIN')`

#### `PATCH /feature-flags/:id`
- `@Roles('SUPER_ADMIN')` — updates metadata (key, description, defaultValue)

#### `PATCH /feature-flags/:id/toggle`
- `@Roles('ADMIN')` — lower than create/update; ADMIN can toggle flags for their tenant
- Body: `ToggleFeatureFlagDto { isEnabled: boolean }`

#### `DELETE /feature-flags/:id`
- `@Roles('SUPER_ADMIN')`

---

### `feature-flags.service.ts`

**Location**: `apps/api/src/modules/feature-flags/feature-flags.service.ts`

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
```

**Database models used**: `FeatureFlag` (all CRUD), `Tenant` (read for ownership), `Company`, `Product`, `AuditLog`

---

#### Private Method: `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)`

```typescript
private async assertFeatureFlagOwnership(id: string, actorRole: string, actorCompanyId: string | null) {
  const flag = await this.prisma.featureFlag.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          company: { select: { id: true } },
          product: { select: { companyId: true } },
        },
      },
    },
  });
  if (!flag) throw new NotFoundException(`FeatureFlag ${id} not found`);
  if (actorRole === 'SUPER_ADMIN') return flag;

  // Global flags (tenantId === null): any ADMIN can read, only SUPER_ADMIN can mutate
  // Tenant-scoped flags: only owning company can access
  if (flag.tenantId === null) {
    // For reads this is fine, for mutations the controller already requires SUPER_ADMIN
    return flag;
  }

  const ownerCompanyId = flag.tenant?.company?.id ?? flag.tenant?.product?.companyId ?? null;
  if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();
  return flag;
}
```

---

#### Method: `findAll(actorRole, actorCompanyId, tenantId?)`

```typescript
if (actorRole === 'SUPER_ADMIN') {
  return prisma.featureFlag.findMany({
    where: tenantId ? { tenantId } : undefined,
    include: { tenant: { select: { id, name, slug } } },
  });
}

// ADMIN: sees global flags + their tenant's flags
return prisma.featureFlag.findMany({
  where: {
    OR: [
      { tenantId: null },  // global flags visible to all
      {
        tenant: {
          OR: [
            { company: { id: actorCompanyId } },
            { product: { companyId: actorCompanyId } },
          ],
        },
      },
    ],
    ...(tenantId && { tenantId }),
  },
  include: { tenant: { select: { id, name, slug } } },
});
```

---

#### Method: `create(dto, actorId, actorRole)`

SUPER_ADMIN only.

1. If `dto.tenantId`: `prisma.tenant.findUnique({ where: { id: dto.tenantId } })` — verify tenant exists
2. `prisma.featureFlag.create({ data: { key, description, isEnabled: false, defaultValue, tenantId } })`
3. Catch P2002 → `ConflictException('Flag with this key already exists for this tenant')`
4. `auditLog.log({ action: 'CREATE', resource: 'feature_flag', after: { key, tenantId } })`

**Known issue (DEBT-001)**: Prisma `@@unique([key, tenantId])` doesn't prevent two global flags (tenantId=NULL) with the same key. The manual partial unique index must be applied. Without it, P2002 is never thrown for duplicate global flags.

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

SUPER_ADMIN only (controller).

1. `assertFeatureFlagOwnership(id, actorRole, actorCompanyId)` → `before`
2. `prisma.featureFlag.update({ where: { id }, data: { ...(dto.key && { key }), ...(dto.description !== undefined && { description }), ...(dto.defaultValue !== undefined && { defaultValue }) } })`
3. `auditLog.log({ action: 'UPDATE', resource: 'feature_flag', before: { key }, after: dto })`

`isEnabled` is NOT in `UpdateFeatureFlagDto` — use `/toggle` endpoint for that.

---

#### Method: `toggle(id, isEnabled, actorId, actorRole, actorCompanyId)`

1. `const before = await this.assertFeatureFlagOwnership(id, actorRole, actorCompanyId)`
2. `if (before.isEnabled === isEnabled) return { id, isEnabled, changed: false }` — idempotent
3. `prisma.featureFlag.update({ where: { id }, data: { isEnabled } })`
4. `auditLog.log({ action: isEnabled ? 'ENABLE' : 'DISABLE', resource: 'feature_flag', before: { isEnabled: !isEnabled }, after: { isEnabled } })`
5. Return `{ id, isEnabled, changed: true }`

**Cache invalidation gap**: Does NOT call `tenantService.invalidateCache()`. Flag changes take effect only after TenantService cache TTL expires (60 seconds).

---

#### Method: `remove(id, actorId, actorRole, actorCompanyId)`

1. `const before = await this.assertFeatureFlagOwnership(id, actorRole, actorCompanyId)`
2. `prisma.featureFlag.delete({ where: { id } })` — hard delete
3. `auditLog.log({ action: 'DELETE', resource: 'feature_flag', before: { key, isEnabled } })`

---

### Feature Flags DTOs

#### `dto/create-feature-flag.dto.ts`

```typescript
export class CreateFeatureFlagDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  key: string;                  // no format enforcement (any string)

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsBoolean()
  isEnabled?: boolean;          // defaults to false

  @IsOptional() @IsString()
  tenantId?: string;            // null = global flag

  @IsOptional() @IsObject()
  defaultValue?: Record<string, unknown>;  // arbitrary JSON config object
}
```

---

#### `dto/toggle-feature-flag.dto.ts`

```typescript
export class ToggleFeatureFlagDto {
  @IsBoolean()
  isEnabled: boolean;
}
```

---

#### `dto/update-feature-flag.dto.ts`

```typescript
export class UpdateFeatureFlagDto {
  @IsOptional() @IsString() @MaxLength(100)
  key?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsObject()
  defaultValue?: Record<string, unknown>;
  // isEnabled NOT here — use /toggle
}
```

---

# MODULE: Settings

## Folder Tree

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

## File Details

### `settings.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [],
})
```

---

### `settings.controller.ts`

**Location**: `apps/api/src/modules/settings/settings.controller.ts`

**Routes**:

#### `GET /settings`
- `@Roles('ADMIN')`
- Query: `tenantId?: string`

#### `GET /settings/:id`
- `@Roles('ADMIN')`

#### `GET /settings/key/:key`
- `@Roles('ADMIN')`
- Query: `tenantId?: string`
- Resolves setting by key with tenant → global fallback

#### `POST /settings`
- `@Roles('SUPER_ADMIN')`

#### `PATCH /settings/:id`
- `@Roles('ADMIN')` — ADMIN can update their tenant's settings

#### `DELETE /settings/:id`
- `@Roles('SUPER_ADMIN')`

---

### `settings.service.ts`

**Location**: `apps/api/src/modules/settings/settings.service.ts`

**Database models used**: `SystemSetting` (all CRUD), `Tenant` (ownership), `Company`, `Product`, `AuditLog`

---

#### Method: `findByKey(key, tenantId?, actorRole, actorCompanyId)`

**Resolves with fallback** — tenant-specific setting overrides global default.

```typescript
async findByKey(key: string, tenantId: string | undefined, actorRole: string, actorCompanyId: string | null) {
  // 1. Try tenant-specific setting first
  let setting: SystemSetting | null = null;

  if (tenantId) {
    // Verify access to this tenant
    await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    setting = await this.prisma.systemSetting.findFirst({
      where: { key, tenantId },
    });
  }

  // 2. Fall back to global setting if no tenant-specific found
  if (!setting) {
    setting = await this.prisma.systemSetting.findFirst({
      where: { key, tenantId: null },
    });
  }

  if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
  return setting;
}
```

**Resolution order**: tenant-specific → global. This mirrors TenantService's feature flag merge logic.

---

#### Method: `create(dto, actorId, actorRole)`

SUPER_ADMIN only.

1. Verify tenantId if provided
2. `prisma.systemSetting.create({ data: { key, value, tenantId, isPublic, description } })`
3. Catch P2002 → `ConflictException`
4. `auditLog.log`

**Same NULL uniqueness issue as FeatureFlag (DEBT-001)**: `@@unique([key, tenantId])` doesn't prevent duplicate global settings. Manual partial index required.

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

ADMIN can update tenant-scoped settings for their own tenant. SUPER_ADMIN can update anything.

1. `assertSettingOwnership(id, actorRole, actorCompanyId)`
2. Partial update:
```typescript
prisma.systemSetting.update({
  where: { id },
  data: {
    ...(dto.value !== undefined && { value: dto.value }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
  },
})
```
3. `auditLog.log({ action: 'UPDATE', before, after: dto })`

Note: `key` and `tenantId` are NOT updatable after creation.

---

### Settings DTOs

#### `dto/create-setting.dto.ts`

```typescript
export class CreateSettingDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  key: string;

  @IsNotEmpty()
  value: unknown;                // any JSON value — boolean, string, number, object, array

  @IsOptional() @IsString()
  tenantId?: string;             // null = global

  @IsOptional() @IsBoolean()
  isPublic?: boolean;            // not currently used by any route

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
}
```

---

#### `dto/update-setting.dto.ts`

```typescript
export class UpdateSettingDto {
  @IsOptional()
  value?: unknown;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
}
```

---

# MODULE: Audit Log

## Folder Tree

```
apps/api/src/modules/audit-log/
├── audit-log.module.ts
├── audit-log.controller.ts
├── audit-log.service.ts
└── dto/
    └── create-audit-log.dto.ts
```

---

## File Details

### `audit-log.module.ts`

**Location**: `apps/api/src/modules/audit-log/audit-log.module.ts`

```typescript
@Module({
  imports: [PrismaModule],        // no other module dependencies
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],     // exported for ALL other modules
})
```

**This is the most widely imported module in the codebase.**

**Imported by**: `AuthModule`, `UsersModule`, `RolesModule`, `CompaniesModule`, `ProductsModule`, `DomainsModule`, `PagesModule`, `ContentBlocksModule`, `SeoModule`, `BrandingModule`, `VersioningModule`, `FeatureFlagsModule`, `SettingsModule`, `TenantModule` — 14 modules total.

---

### `audit-log.controller.ts`

**Location**: `apps/api/src/modules/audit-log/audit-log.controller.ts`

**Routes**:

#### `GET /audit-logs`
- `@Roles('SUPER_ADMIN')`
- Returns: last 100 records — HARD-CODED limit, no pagination
- Calls: `AuditLogService.findAll(user.role)`

#### `GET /audit-logs/tenant/:tenantId`
- `@Roles('ADMIN')`
- Query: `skip?: number, take?: number` (defaults: skip=0, take=50)
- Calls: `AuditLogService.findByTenant(tenantId, user.role, user.companyId, { skip, take })`

#### `GET /audit-logs/resource/:resource/:resourceId`
- `@Roles('ADMIN')`
- Returns all audit records for a specific resource instance
- Calls: `AuditLogService.findByResource(resource, resourceId, user.role, user.companyId)`

---

### `audit-log.service.ts`

**Location**: `apps/api/src/modules/audit-log/audit-log.service.ts`

**Imports**:
```typescript
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
```

**Exports**: `AuditLogService` class

**Who calls this file**: EVERY service in the application (14 modules)

**Database models used**: `AuditLog` (create, read), `Tenant` (read for ownership check)

---

#### Method: `log(dto)` — PRIMARY METHOD, called by all services

**Input**:
```typescript
interface CreateAuditLogInput {
  action: string;               // e.g. 'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'LOGIN'
  resource: string;             // e.g. 'page', 'user', 'company', 'feature_flag'
  resourceId?: string;          // ID of the affected record
  actorId?: string;             // who performed the action (null for system actions)
  tenantId?: string;            // which tenant context
  before?: Record<string, unknown>;  // state before mutation
  after?: Record<string, unknown>;   // state after mutation
  metadata?: Record<string, unknown>; // additional context
}
```

**Calls**:
```typescript
await this.prisma.auditLog.create({
  data: {
    action: dto.action,
    resource: dto.resource,
    resourceId: dto.resourceId,
    actorId: dto.actorId,
    tenantId: dto.tenantId,
    before: dto.before ?? Prisma.DbNull,
    after: dto.after ?? Prisma.DbNull,
    metadata: dto.metadata ?? Prisma.DbNull,
    createdAt: new Date(),
  },
});
```

**Usage pattern across services**: Most services call `auditLogService.log()` WITHOUT awaiting it:
```typescript
// Typical (fire-and-forget):
this.auditLogService.log({ action: 'UPDATE', ... });  // not awaited — DEBT-012

// Some services DO await (inconsistent):
await this.auditLogService.log({ action: 'DELETE', ... });
```

The fire-and-forget pattern means: if the audit log INSERT fails (DB down, constraint violation), the mutation has already succeeded and the error is silently swallowed. There is no error handling in `log()` itself.

---

#### Method: `findByTenant(tenantId, actorRole, actorCompanyId, options?)`

```typescript
async findByTenant(
  tenantId: string,
  actorRole: string,
  actorCompanyId: string | null,
  options?: { skip?: number; take?: number }
) {
  if (actorRole !== 'SUPER_ADMIN') {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        company: { select: { id: true } },
        product: { select: { companyId: true } },
      },
    });
    if (!tenant) throw new NotFoundException();
    const ownerCompanyId = tenant.company?.id ?? tenant.product?.companyId ?? null;
    if (ownerCompanyId !== actorCompanyId) throw new ForbiddenException();
  }

  return this.prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    skip: options?.skip ?? 0,
    take: options?.take ?? 50,
  });
}
```

No filtering by resource type or date range. Returns ALL audit records for the tenant, newest first, with default page size 50.

---

#### Method: `findByResource(resource, resourceId, actorRole, actorCompanyId)`

```typescript
async findByResource(resource: string, resourceId: string, actorRole: string, actorCompanyId: string | null) {
  // Load first record to get tenantId for ownership check
  const first = await this.prisma.auditLog.findFirst({
    where: { resource, resourceId },
    select: { tenantId: true },
  });

  if (!first) throw new NotFoundException(`No audit records for ${resource}/${resourceId}`);

  if (actorRole !== 'SUPER_ADMIN' && first.tenantId) {
    // Verify actor has access to the tenant this resource belongs to
    await this.findByTenant(first.tenantId, actorRole, actorCompanyId, { skip: 0, take: 0 });
    // ^ using findByTenant with take:0 just for the ownership side-effect
    // This is a design smell — ownership should be a separate helper
  }

  return this.prisma.auditLog.findMany({
    where: { resource, resourceId },
    orderBy: { createdAt: 'desc' },
  });
}
```

---

#### Method: `findAll(actorRole)`

SUPER_ADMIN only.

```typescript
async findAll(actorRole: string) {
  if (actorRole !== 'SUPER_ADMIN') throw new ForbiddenException();

  return this.prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,  // HARDCODED — no pagination
  });
}
```

---

### `dto/create-audit-log.dto.ts`

**Location**: `apps/api/src/modules/audit-log/dto/create-audit-log.dto.ts`

```typescript
export class CreateAuditLogDto {
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

**Note**: This DTO is used internally (service-to-service). No HTTP endpoint accepts it from external clients.

---

## Audit Log Dependency Graph

```
ALL 14 service modules
  │
  └─ AuditLogService.log()
        └─ PrismaService.auditLog.create()

AuditLogController
  └─ AuditLogService
        ├─ findAll() → prisma.auditLog.findMany (take:100)
        ├─ findByTenant() → prisma.tenant.findUnique + auditLog.findMany
        └─ findByResource() → prisma.auditLog.findFirst + findMany
```

---

# MODULE: Activity Log (Dead Module)

## Folder Tree

```
apps/api/src/modules/activity-log/
├── activity-log.module.ts
└── activity-log.service.ts
(no controller)
```

---

## File Details

### `activity-log.module.ts`

**Location**: `apps/api/src/modules/activity-log/activity-log.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
```

**Status**: NOT imported by AppModule. Not reachable from anywhere.

---

### `activity-log.service.ts`

**Location**: `apps/api/src/modules/activity-log/activity-log.service.ts`

**Status**: DEAD CODE — no callers anywhere

**Methods**:

```typescript
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        userId: dto.userId,
        action: dto.action,
        resource: dto.resource,
        resourceId: dto.resourceId,
        tenantId: dto.tenantId,
        metadata: dto.metadata ?? Prisma.DbNull,
        createdAt: new Date(),
      },
    });
  }

  async findByTenant(tenantId: string, options?: { skip?: number; take?: number }) {
    return this.prisma.activityLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip: options?.skip ?? 0,
      take: options?.take ?? 50,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async findRecent(userId: string, limit = 20) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
```

Distinction from `AuditLogService`: ActivityLog is user-centric (tracks what a specific user did), while AuditLog is resource-centric (tracks what happened to a resource). Neither is currently fully implemented.

---

# MODULE: Tenant

## Folder Tree

```
apps/api/src/modules/tenant/
├── tenant.module.ts
├── tenant.controller.ts
└── tenant.service.ts
apps/api/src/common/middleware/
└── tenant.middleware.ts
```

---

## File Details

### `tenant.module.ts`

```typescript
@Module({
  imports: [PrismaModule, AuditLogModule],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],  // exported so TenantMiddleware can inject it
})
```

**Who imports this module**: `AppModule`

**TenantMiddleware usage**: The middleware is registered in `AppModule.configure()` — NestJS resolves `TenantService` via the DI container, which requires `TenantModule` to be imported by `AppModule`.

---

### `tenant.service.ts`

**Location**: `apps/api/src/modules/tenant/tenant.service.ts`

**Purpose**: Domain-to-tenant resolution with in-process cache. Also provides standard tenant CRUD for admin operations.

**Imports**:
```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
```

**Database models used**: `Tenant` (all CRUD), `Domain` (read for resolution), `FeatureFlag` (read for resolution), `Branding` (read via include), `Company` (read via include), `Product` (read via include), `AuditLog`

---

#### In-Memory Cache

```typescript
private readonly cache = new Map<string, {
  tenant: TenantWithFlags;
  expiresAt: Date;
}>();
private readonly TTL_MS = 60_000; // 60 seconds
```

**Process-local**: Each running instance of the API has its own Map. Cache cannot be shared between multiple pods. In horizontal scaling, each pod resolves its own cache independently — 60-second lag before any pod picks up config changes.

---

#### Method: `resolveFromDomain(domain)` — PRIMARY METHOD

**Called by**: `TenantMiddleware.use()` on every request

**Input**: `domain: string` — the hostname (port already stripped by middleware)

**Output**: `{ type: 'TENANT', tenant: TenantWithFlags } | { type: 'REDIRECT', target: string } | null`

```typescript
async resolveFromDomain(domain: string): Promise<ResolveResult | null> {
  // 1. Cache lookup
  const cached = this.cache.get(domain);
  if (cached && cached.expiresAt > new Date()) {
    return { type: 'TENANT', tenant: cached.tenant };
  }

  // 2. DB lookup
  const domainRecord = await this.prisma.domain.findFirst({
    where: { name: domain, deletedAt: null },
    include: {
      tenant: {
        include: {
          domains: { where: { deletedAt: null } },
          featureFlags: true,       // tenant-specific flags
          branding: true,           // full branding record
          company: true,            // owning company
          product: {                // owning product (if product tenant)
            include: { company: true },
          },
        },
      },
    },
  });

  if (!domainRecord) return null;

  // 3. Handle REDIRECT type
  if (domainRecord.type === 'REDIRECT') {
    return { type: 'REDIRECT', target: domainRecord.targetDomain };
  }

  // 4. Merge global feature flags with tenant-specific
  const globalFlags = await this.prisma.featureFlag.findMany({
    where: { tenantId: null },
  });

  const flagMap = new Map<string, typeof globalFlags[0]>();
  for (const flag of globalFlags) flagMap.set(flag.key, flag);       // global defaults
  for (const flag of domainRecord.tenant.featureFlags) {              // tenant overrides
    flagMap.set(flag.key, flag);
  }

  const mergedTenant = {
    ...domainRecord.tenant,
    featureFlags: Array.from(flagMap.values()),
  };

  // 5. Cache result
  this.cache.set(domain, {
    tenant: mergedTenant,
    expiresAt: new Date(Date.now() + this.TTL_MS),
  });

  return { type: 'TENANT', tenant: mergedTenant };
}
```

**DB queries on cache miss**: 2 queries — domain+tenant query + global flags query.

**Cache hit**: 0 DB queries. Map.get() is O(1).

---

#### Method: `invalidateCache(domain?)` — NEVER CALLED

```typescript
invalidateCache(domain?: string): void {
  if (domain) {
    this.cache.delete(domain);
  } else {
    this.cache.clear();
  }
}
```

Exists but is never called by any code. See DEBT-004 for full impact analysis.

---

#### Method: `findAll(actorRole, actorCompanyId)`

```typescript
if (actorRole === 'SUPER_ADMIN') {
  return prisma.tenant.findMany({
    where: { deletedAt: null },
    include: { company: true, product: true, domains: true, _count: { select: { pages: true } } },
  });
}

return prisma.tenant.findMany({
  where: {
    deletedAt: null,
    OR: [
      { company: { id: actorCompanyId } },
      { product: { companyId: actorCompanyId } },
    ],
  },
  include: { company: true, product: true, domains: true },
});
```

---

#### Method: `findById(id, actorRole, actorCompanyId)`

1. `prisma.tenant.findFirst({ where: { id, deletedAt: null }, include: { ... } })`
2. If not found → `NotFoundException`
3. Ownership check

---

#### Method: `create(dto, actorId)` — SUPER_ADMIN only

1. Slug uniqueness check: `prisma.tenant.findFirst({ where: { slug: dto.slug, deletedAt: null } })`
2. `prisma.tenant.create({ data: { name, slug, plan, isActive, companyId, productId } })`
3. `auditLog.log({ action: 'CREATE', resource: 'tenant' })`

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

1. Load + ownership check
2. Partial update of `name`, `plan`, `isActive`
3. `auditLog.log`

**Cache invalidation gap**: Updating tenant metadata does NOT invalidate the domain-to-tenant cache.

---

#### Method: `softDelete(id, actorId, actorRole, actorCompanyId)`

1. SUPER_ADMIN only
2. `prisma.tenant.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })`
3. `auditLog.log`

**Cache invalidation gap**: Soft-deleting a tenant does NOT invalidate the cache. If a domain pointed to this tenant was cached, it continues to resolve to the (now deleted) tenant for up to 60 seconds. This could serve content for a deleted tenant.

---

### `tenant.controller.ts`

**Location**: `apps/api/src/modules/tenant/tenant.controller.ts`

**Routes**:

#### `GET /tenants`
- `@Roles('ADMIN')`

#### `GET /tenants/:id`
- `@Roles('ADMIN')`

#### `POST /tenants`
- `@Roles('SUPER_ADMIN')`
- Body: `CreateTenantDto`

#### `PATCH /tenants/:id`
- `@Roles('SUPER_ADMIN')`
- Body: `UpdateTenantDto`

#### `DELETE /tenants/:id`
- `@Roles('SUPER_ADMIN')`

---

## Tenant Dependency Graph

```
TenantMiddleware (every request)
  │
  └─ TenantService.resolveFromDomain(domain)
        ├─ Map<string, CacheEntry> (in-memory, 60s TTL)
        └─ PrismaService
              ├─ domain.findFirst (+ tenant, flags, branding, company, product includes)
              └─ featureFlag.findMany (global flags — extra query on cache miss)

TenantController
  └─ TenantService (CRUD methods)
        ├─ PrismaService (tenant CRUD)
        └─ AuditLogService
```

---

## Tenant Resolution Runtime Flow

```
Incoming request: Authorization: Bearer <jwt>, Host: app.mycompany.com
  │
  STEP 1: TenantMiddleware
    │
    host = 'app.mycompany.com' (port already stripped)
    │
    tenantService.resolveFromDomain('app.mycompany.com')
      │
      Cache HIT (within 60s):
        └─ req.tenantContext = cached TenantWithFlags
        └─ next() → proceed to guards
      │
      Cache MISS:
        │
        query 1: prisma.domain.findFirst({
          where: { name: 'app.mycompany.com', deletedAt: null },
          include: { tenant: { include: { featureFlags, branding, company, product } } }
        })
        │
        NOT FOUND → req.tenantContext = null → next() (does NOT block request)
        │
        FOUND, type = REDIRECT:
          └─ res.redirect(301, `https://${targetDomain}${req.url}`)
          └─ (request ends here — no guard execution)
        │
        FOUND, type = PRIMARY/SECONDARY:
          query 2: prisma.featureFlag.findMany({ where: { tenantId: null } })
          │
          Merge: global flags + tenant-specific flags (tenant wins)
          │
          cache.set('app.mycompany.com', { tenant: merged, expiresAt: now+60s })
          req.tenantContext = merged
          next()

  STEP 2: JwtAuthGuard
  STEP 3: RolesGuard
  STEP 4: Controller → Service
```

---

# MODULE: Notifications (Stub)

## Folder Tree

```
apps/api/src/modules/notifications/
├── notifications.module.ts
└── notifications.service.ts
(no controller, no dto)
```

---

## File Details

### `notifications.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  providers: [NotificationsService],
  exports: [],
})
```

Imported by: `AppModule`

---

### `notifications.service.ts`

**Location**: `apps/api/src/modules/notifications/notifications.service.ts`

**Status**: Stub — the `send()` method writes to DB but has no delivery mechanism and no callers.

```typescript
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async send(userId: string, title: string, body: string, metadata?: unknown): Promise<void> {
    // TODO: implement push/email delivery
    // Currently just persists to database — no actual notification sent
    await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        metadata: metadata ? (metadata as Prisma.JsonObject) : Prisma.DbNull,
        isRead: false,
        createdAt: new Date(),
      },
    });
  }
}
```

The `Notification` table accumulates records that are never delivered. No `GET /notifications` endpoint exists. No WebSocket, email, or push integration.

---

# MODULE: MCP (Stub)

## Folder Tree

```
apps/api/src/modules/mcp/
├── mcp.module.ts
├── mcp.controller.ts
├── mcp.service.ts
└── dto/
    ├── create-mcp-provider.dto.ts
    └── create-mcp-connection.dto.ts
```

---

## File Details

### `mcp.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  providers: [McpService],
  controllers: [McpController],
  exports: [],
})
```

---

### `mcp.service.ts`

**Location**: `apps/api/src/modules/mcp/mcp.service.ts`

**Status**: Complete stub.

```typescript
@Injectable()
export class McpService {
  // Implementation deferred to AI phase.

  async createProvider(dto: CreateMcpProviderDto) {
    throw new NotImplementedException('MCP implementation deferred to AI phase');
  }

  async createConnection(dto: CreateMcpConnectionDto) {
    throw new NotImplementedException('MCP implementation deferred to AI phase');
  }

  async listProviders() {
    return [];
  }

  async listConnections() {
    return [];
  }
}
```

**Prisma models defined** (schema exists, never written to by service):
- `McpProvider` — external AI model providers
- `McpConnection` — connections between tenants and providers
- `AiAgent` — autonomous agents
- `AgentPermission` — permissions for agents
- `WorkflowDefinition` — agent workflow definitions
- `AgentAuditLog` — agent action log

---

### MCP DTOs

#### `dto/create-mcp-provider.dto.ts`

```typescript
export class CreateMcpProviderDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  type: string;              // e.g. 'openai', 'anthropic', 'azure'

  @IsObject()
  config: Record<string, unknown>;  // API keys, base URLs — stored as JSON

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
```

#### `dto/create-mcp-connection.dto.ts`

```typescript
export class CreateMcpConnectionDto {
  @IsString() @IsNotEmpty()
  providerId: string;

  @IsString() @IsNotEmpty()
  tenantId: string;

  @IsObject()
  settings: Record<string, unknown>;
}
```

---

## Platform Services Runtime Flow: Feature Flag Toggle

```
PATCH /feature-flags/:id/toggle { isEnabled: true }
  │
  1. TenantMiddleware → req.tenantContext
  2. JwtAuthGuard → req.user
  3. RolesGuard → @Roles('ADMIN') required
  │
  4. FeatureFlagsController.toggle(id, dto, user)
     └─ FeatureFlagsService.toggle(id, dto.isEnabled, user.id, user.role, user.companyId)
           │
           a. prisma.featureFlag.findUnique({ id, include: { tenant: {company, product} } })
              [assertFeatureFlagOwnership]
              └─ NOT FOUND → 404
              └─ SUPER_ADMIN → pass
              └─ tenantId===null (global) → pass (for ADMIN read/toggle)
              └─ ownerCompanyId !== user.companyId → 403
           │
           b. before.isEnabled === dto.isEnabled → RETURN { id, isEnabled, changed:false }
           │
           c. prisma.featureFlag.update({ id }, { isEnabled: dto.isEnabled })
           │
           d. auditLogService.log({ action: 'ENABLE'|'DISABLE', resource: 'feature_flag' })
           │
           e. RETURN { id, isEnabled: dto.isEnabled, changed: true }
           │
           [NOTE: TenantService.invalidateCache() NOT called here]
           [Cached tenant contexts will serve stale flag value for up to 60 seconds]
```

---

## Platform Services: DB Query Reference

### Per-Request Overhead (TenantMiddleware)

| Condition | Queries | Tables |
|---|---|---|
| Cache HIT | 0 | — |
| Cache MISS, domain found | 2 | `domain` + `tenant` + `featureFlag` (global) |
| Cache MISS, domain not found | 1 | `domain` |
| REDIRECT type | 1 | `domain` |

### Audit Log Writes Per Mutation Type

| Operation | AuditLog INSERTs |
|---|---|
| Page create | 1 |
| Page update | 1 |
| Page publish/unpublish | 1 |
| ContentBlock update | 1 |
| ContentBlock reorder (N blocks) | 1 (logged once for the reorder operation) |
| Rollback | 1 |
| Feature flag toggle | 1 |
| User create | 1 |
| Login | 1 |
| Logout | 1 |

### Version Snapshots Per CMS Operation

| Operation | PageVersion INSERTs |
|---|---|
| Page update (title) | 1 |
| Page publish | 1 |
| Page unpublish | 1 |
| ContentBlock update | 1 |
| ContentBlock reorder | 1 |
| ContentBlock visibility change | 1 |
| Manual version create | 1 |
| Rollback | 1 (the restored state snapshot) |
| Restore | 1 (the restored state snapshot) |
| Page/block create | 0 |
| Page/block delete | 0 |
