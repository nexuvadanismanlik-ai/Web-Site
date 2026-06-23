# 04 — MODULES: COMPANIES, PRODUCTS, DOMAINS

---

## MODULE: Companies

### Files

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

### `companies.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [CompaniesService]
controllers: [CompaniesController]
exports:  [] — CompaniesService is NOT exported
```

CompaniesModule does not export CompaniesService. No other module imports CompaniesModule. Companies are self-contained — other modules reach company ownership via the User's `companyId` field, not by injecting CompaniesService.

---

### `companies.controller.ts`

**Controller prefix**: `/companies`

**Dependencies injected**: `CompaniesService`

**All routes require authentication** (no `@Public()`).

#### GET /companies
- Role: `@Roles('ADMIN')` → minimum ADMIN (80)
- No body, no params
- Calls: `CompaniesService.findAll(user.role, user.companyId)`
- Returns: list of companies scoped by role

#### GET /companies/:id
- Role: `@Roles('ADMIN')`
- Param: `id` (company ID)
- Calls: `CompaniesService.findById(id, user.role, user.companyId)`
- Returns: single company with subsidiaries, parent, products, tenant, branding, domains

#### POST /companies
- Role: `@Roles('SUPER_ADMIN')` → only SUPER_ADMIN (100)
- Body: `CreateCompanyDto`
- Calls: `CompaniesService.create(dto, user.id)`
- Returns: created company with tenant

#### PATCH /companies/:id
- Role: `@Roles('ADMIN')`
- Param: `id`
- Body: `UpdateCompanyDto`
- Calls: `CompaniesService.update(id, dto, user.id, user.role, user.companyId)`
- Returns: updated company

#### DELETE /companies/:id
- Role: `@Roles('SUPER_ADMIN')`
- Param: `id`
- Calls: `CompaniesService.softDelete(id, user.id)`
- Returns: soft-deleted company record

---

### `companies.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### COMPANY_INCLUDE constant

```typescript
const COMPANY_INCLUDE = {
  subsidiaries: { where: { deletedAt: null } },
  parent: true,
  products: { where: { deletedAt: null } },
  tenant: { include: { branding: true, domains: { where: { isActive: true } } } },
}
```

Used only by `findById()`.

---

#### `findAll(actorRole, actorCompanyId)`

Inputs: `actorRole: UserRole`, `actorCompanyId?: string | null`

Behavior by role:
- `SUPER_ADMIN`: `prisma.company.findMany({ where: { deletedAt: null } })` — all companies
- Others: `prisma.company.findMany({ where: { deletedAt: null, OR: [{ id: actorCompanyId }, { parentId: actorCompanyId }] } })` — own company + direct subsidiaries only
- If `actorCompanyId` is null/undefined for non-SUPER_ADMIN: returns `[]`

Includes: `subsidiaries`, `tenant.id`, `tenant.slug`

No ownership check method called — scoping is inline in the query.

---

#### `findById(id, actorRole, actorCompanyId)`

Inputs: `id: string`, `actorRole: UserRole`, `actorCompanyId?: string | null`

1. `prisma.company.findFirst({ where: { id, deletedAt: null }, include: COMPANY_INCLUDE })`
2. If not found: throw `NotFoundException`
3. Ownership check (inline):
   - SUPER_ADMIN: pass
   - Others: if `actorCompanyId !== id AND company.parentId !== actorCompanyId` → throw `ForbiddenException`
   - Rule: actor can see their own company OR their parent company (if they are a subsidiary's admin)

Prisma models touched: `company` (read)

---

#### `create(dto, actorId)`

Inputs: `dto: CreateCompanyDto`, `actorId: string`

Note: No role check in this method — enforced at controller level (`@Roles('SUPER_ADMIN')`).

1. `prisma.company.create({ data: { ...company fields, tenant: { create: { slug, type, name, description } } } })`
   - Creates Company AND Tenant in a single nested write (atomic)
   - `TenantType` derived from `CompanyType`: `HOLDING` → `HOLDING`, `SUBSIDIARY` → `PRODUCT`
2. `auditLog.log({ action: 'CREATE', resource: 'company', ... })`

Prisma models touched: `company` (create), `tenant` (create via nested write)

Audit fields logged: `id`, `name`, `type`, `slug`

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

Inputs: `id: string`, `dto: UpdateCompanyDto`, `actorId: string`, `actorRole: UserRole`, `actorCompanyId?: string | null`

1. `this.findById(id, actorRole, actorCompanyId)` — ownership check
2. `prisma.company.update({ where: { id }, data: { name, legalName, taxId, description, parentId } })`
3. `auditLog.log({ action: 'UPDATE', resource: 'company', before, after })`

Prisma models touched: `company` (read in findById, update)

Fields that can be updated: `name`, `legalName`, `taxId`, `description`, `parentId`

Fields that CANNOT be updated via this endpoint: `type`, `slug`, `tenantId`

No transaction — the findById and update are separate queries. Not atomic.

---

#### `softDelete(id, actorId)`

Inputs: `id: string`, `actorId: string`

Note: No role check in method — enforced at controller level (`@Roles('SUPER_ADMIN')`). No actorRole/actorCompanyId passed — SUPER_ADMIN can delete any company.

1. `prisma.company.findFirst({ where: { id, deletedAt: null } })` — verify exists
2. `prisma.company.update({ where: { id }, data: { deletedAt: new Date() } })`
3. `auditLog.log({ action: 'DELETE', resource: 'company', before })`

Side effects NOT handled:
- Does NOT soft-delete the linked Tenant
- Does NOT soft-delete subsidiaries
- Does NOT soft-delete Products
- Does NOT deactivate Users scoped to this company
- Does NOT revoke refresh tokens of company users

This is a significant gap — deleting a company leaves orphaned tenants, products, and users still active.

Prisma models touched: `company` (read, update)

---

### `dto/create-company.dto.ts`

```typescript
class CreateCompanyDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  slug: string;           // used for Tenant.slug — no format validation (no regex check!)

  @IsEnum(['HOLDING', 'SUBSIDIARY'])
  type: CompanyType;

  @IsOptional() @IsString()
  legalName?: string;

  @IsOptional() @IsString()
  taxId?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  parentId?: string;      // no validation that parentId exists or belongs to the caller
}
```

Technical debt: `slug` has no format validation (no regex, no min/maxLength). An invalid slug like `"My Company!"` would be inserted into `tenant.slug` without error.

---

### `dto/update-company.dto.ts`

All fields optional:
- `name?: string`
- `legalName?: string`
- `taxId?: string`
- `description?: string`
- `parentId?: string`

Technical debt: `parentId` can be set to an arbitrary string — no validation that the parent company exists or belongs to the same hierarchy.

---

## MODULE: Products

### Files

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

### `products.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [ProductsService]
controllers: [ProductsController]
exports:  []
```

---

### `products.controller.ts`

**Controller prefix**: `/products`

**Inline DTO** defined in controller file:
```typescript
class UpdateStatusDto {
  @IsEnum(['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'])
  status: string;
}
```
This is a technical debt item — DTO defined inside controller rather than in a dedicated dto/ file.

#### GET /products
- Role: `@Roles('ADMIN')`
- Calls: `ProductsService.findAll(user.role, user.companyId)`

#### GET /products/:id
- Role: `@Roles('PRODUCT_MANAGER')` → minimum PRODUCT_MANAGER (60)
- Calls: `ProductsService.findById(id, user.role, user.companyId)`

#### POST /products
- Role: `@Roles('ADMIN')`
- Body: `CreateProductDto`
- Calls: `ProductsService.create(dto, user.id)`

#### PATCH /products/:id/status
- Role: `@Roles('PRODUCT_MANAGER')`
- Body: `UpdateStatusDto { status: string }`
- Calls: `ProductsService.updateStatus(id, dto.status, user.id, user.role, user.companyId)`

#### PATCH /products/:id
- Role: `@Roles('PRODUCT_MANAGER')`
- Body: `UpdateProductDto`
- Calls: `ProductsService.update(id, dto, user.id, user.role, user.companyId)`

#### DELETE /products/:id
- Role: `@Roles('SUPER_ADMIN')`
- Calls: `ProductsService.softDelete(id, user.id)`

---

### `products.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### Include constants

```typescript
const PRODUCT_LIST_INCLUDE = {
  company: { select: { id, name, type } },
  tenant: {
    select: {
      id, slug,
      branding: { select: { logoUrl, primaryColor } },
      domains: { where: { isActive: true, type: 'PRIMARY' }, select: { domainName } }
    }
  }
}

const PRODUCT_DETAIL_INCLUDE = {
  company: true,
  tenant: { include: { branding, domains, featureFlags, settings: { where: { isPublic: true } } } }
}
```

---

#### `findAll(actorRole, actorCompanyId)`

- SUPER_ADMIN: all non-deleted products
- Others: `companyId: actorCompanyId ?? '__none__'`

Note: The fallback `'__none__'` string is used when `actorCompanyId` is null — this ensures no products are returned (no company ID will ever equal `'__none__'`). Same pattern used in Users, Branding, FeatureFlags, Settings. This is a recurring convention.

---

#### `findById(id, actorRole, actorCompanyId)`

1. `prisma.product.findFirst({ where: { id, deletedAt: null }, include: PRODUCT_DETAIL_INCLUDE })`
2. If not found: throw `NotFoundException`
3. Inline ownership check: `product.companyId !== actorCompanyId` → throw `ForbiddenException` (SUPER_ADMIN bypasses)

Includes full tenant with branding, domains, featureFlags, public settings.

---

#### `create(dto, actorId)`

No role check in method — controlled by `@Roles('ADMIN')` at controller.

1. `prisma.product.create({ data: { ...product fields, tenant: { create: { slug, type: 'PRODUCT', name, description } } } })`
   - Nested write: creates Product + Tenant atomically
   - Product.tenantId and Tenant are created in one operation
2. `auditLog.log({ action: 'CREATE', resource: 'product', after: { id, name, slug, status, companyId, tenantId } })`

Prisma models touched: `product` (create), `tenant` (create via nested write)

---

#### `updateStatus(id, status, actorId, actorRole, actorCompanyId)`

1. `this.findById(id, actorRole, actorCompanyId)` — ownership check
2. `prisma.product.update({ where: { id }, data: { status: status as never } })` — `as never` cast bypasses type check; status is a raw string from the inline DTO
3. `auditLog.log({ action: 'UPDATE_STATUS', resource: 'product', before, after })`

The `as never` cast is a technical debt item — ProductStatus enum casting should be explicit.

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `this.findById(id, actorRole, actorCompanyId)` — ownership check
2. `prisma.product.update({ where: { id }, data: { name, description, status } })`
3. `auditLog.log({ action: 'UPDATE', resource: 'product', before, after })`

Fields that can be updated: `name`, `description`, `status`

Fields that CANNOT be updated: `slug`, `companyId`, `tenantId`

---

#### `softDelete(id, actorId)`

No role check in method — controlled by `@Roles('SUPER_ADMIN')`.

1. `prisma.product.findFirst({ where: { id, deletedAt: null } })`
2. `prisma.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } })`
3. `auditLog.log({ action: 'DELETE', resource: 'product', before })`

Side effects NOT handled:
- Does NOT deactivate the linked Tenant
- Does NOT delete/unpublish Pages scoped to this product's tenant
- Does NOT delete Domains pointing to this product's tenant

---

### `dto/create-product.dto.ts`

```typescript
class CreateProductDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  slug: string;           // globally unique; no format validation

  @IsOptional() @IsString()
  description?: string;

  @IsEnum(['DRAFT','ACTIVE','HIDDEN','BETA','ARCHIVED']) @IsOptional()
  status?: ProductStatus; // default DRAFT

  @IsString() @IsNotEmpty()
  companyId: string;      // no validation that caller owns this company
}
```

Technical debt: `slug` has no format validation (no regex). An arbitrary string including spaces or special characters would be accepted and inserted into `product.slug` and `tenant.slug`.

---

### `dto/update-product.dto.ts`

```typescript
class UpdateProductDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(['DRAFT','ACTIVE','HIDDEN','BETA','ARCHIVED'])
  status?: ProductStatus;
}
```

---

## MODULE: Domains

### Files

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

### `domains.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [DomainsService]
controllers: [DomainsController]
exports:  []
```

---

### `domains.controller.ts`

**Controller prefix**: `/domains`

#### GET /domains
- Role: `@Roles('ADMIN')`
- Calls: `DomainsService.findAll(user.role, user.companyId)`

#### GET /domains/:id
- Role: `@Roles('ADMIN')`
- Calls: `DomainsService.findById(id, user.role, user.companyId)`

#### POST /domains
- Role: `@Roles('ADMIN')`
- Body: `CreateDomainDto`
- Calls: `DomainsService.create(dto, user.id, user.role, user.companyId)`

#### PATCH /domains/:id
- Role: `@Roles('ADMIN')`
- Body: `UpdateDomainDto`
- Calls: `DomainsService.update(id, dto, user.id, user.role, user.companyId)`

#### DELETE /domains/:id
- Role: `@Roles('SUPER_ADMIN')`
- Calls: `DomainsService.remove(id, user.id)`
- **Hard delete** — no soft delete for domains

---

### `domains.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

#### Include constant

```typescript
const DOMAIN_WITH_OWNER = {
  tenant: {
    include: {
      company: { select: { id } },
      product: { select: { companyId } },
    }
  }
}
```

Used to resolve ownership chain for ownership checks.

---

#### Ownership Helpers

**`resolveOwnerCompanyId(tenant)`**:
```typescript
return tenant.company?.id ?? tenant.product?.companyId ?? null;
```

**`assertDomainOwnership(domain, actorRole, actorCompanyId)`**:
- SUPER_ADMIN: return
- else: if `resolveOwnerCompanyId(domain.tenant) !== actorCompanyId` → throw `ForbiddenException('Access denied to this domain')`
- Synchronous — no DB call; the domain object must already have tenant included

**`assertTenantOwnership(tenantId, actorRole, actorCompanyId)`** — async:
- SUPER_ADMIN: return
- Loads tenant from DB with company + product relations
- If tenant not found: throw `NotFoundException`
- Resolves ownerCompanyId; if mismatch: throw `ForbiddenException`

---

#### `findAll(actorRole, actorCompanyId)`

- SUPER_ADMIN: all domains with tenant info
- Others: domains where `tenant.company.id = actorCompanyId OR tenant.product.companyId = actorCompanyId`

This query uses nested relation filtering:
```typescript
where: {
  tenant: {
    OR: [
      { company: { id: actorCompanyId } },
      { product: { companyId: actorCompanyId } }
    ]
  }
}
```

---

#### `findById(id, actorRole, actorCompanyId)`

1. `prisma.domain.findUnique({ where: { id }, include: DOMAIN_WITH_OWNER })`
2. If not found: throw `NotFoundException`
3. `assertDomainOwnership(domain, actorRole, actorCompanyId)`
4. Return domain (with tenant owner data included — tenant company/product IDs are visible in response)

Note: The response includes the full ownership chain (`tenant.company.id`, `tenant.product.companyId`). This is internal data that may not need to be in the API response.

---

#### `findByDomainName(domainName, actorRole, actorCompanyId)`

Same as `findById` but looks up by `domainName` (unique). This method exists in the service but is NOT exposed via any controller route. It is currently unreachable from the API.

---

#### `create(dto, actorId, actorRole, actorCompanyId)`

1. Validate: if `dto.type === 'REDIRECT'` and no `dto.redirectTo` → throw `BadRequestException`
2. Validate: if `dto.type !== 'REDIRECT'` and `dto.redirectTo` exists → throw `BadRequestException`
3. `assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId)`
4. `prisma.domain.findUnique({ where: { domainName: dto.domainName } })` — duplicate check
5. If duplicate: throw `ConflictException`
6. `prisma.domain.create({ data: { domainName, type, tenantId, redirectTo, isActive } })`
7. `auditLog.log({ action: 'CREATE', resource: 'domain', after })`

Prisma models touched: `domain` (create)

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `this.findById(id, actorRole, actorCompanyId)` — loads and ownership-checks the domain
2. If `dto.tenantId !== domain.tenantId` and actor is not SUPER_ADMIN → throw `ForbiddenException('Only SUPER_ADMIN can reassign a domain')`
3. Determine effective type and redirectTo (merge dto with existing values)
4. Validate REDIRECT consistency on effective values
5. `prisma.domain.update({ where: { id }, data: { type, tenantId, redirectTo, isActive } })`
6. `auditLog.log({ action: 'UPDATE', resource: 'domain', before, after })`

Note: `domainName` itself CANNOT be changed via update. Only type, tenantId (SUPER_ADMIN), redirectTo, isActive can change.

Side effect: Does NOT call `TenantService.invalidateCache()` after updating a domain. If a domain is deactivated or its redirectTo changes, the 60-second TTL cache in TenantService will serve stale data for up to 60 seconds.

---

#### `remove(id, actorId)`

Hard delete — SUPER_ADMIN only (enforced at controller).

1. `prisma.domain.findUnique({ where: { id }, include: { tenant } })`
2. If not found: throw `NotFoundException`
3. `prisma.domain.delete({ where: { id } })`
4. `auditLog.log({ action: 'DELETE', resource: 'domain', before })`

Side effect: Does NOT invalidate TenantService cache after deletion.

---

### `dto/create-domain.dto.ts`

```typescript
class CreateDomainDto {
  @IsString() @IsNotEmpty()
  domainName: string;     // e.g. "nexuva.com" — no format/regex validation

  @IsOptional() @IsEnum(['PRIMARY','SUBDOMAIN','REDIRECT','ALIAS'])
  type?: DomainType;      // default PRIMARY

  @IsString() @IsNotEmpty()
  tenantId: string;

  @IsOptional() @IsString()
  redirectTo?: string;    // required when type=REDIRECT (enforced in service, not DTO)

  @IsOptional() @IsBoolean()
  isActive?: boolean;     // default true
}
```

Technical debt: REDIRECT/redirectTo consistency is validated in the service, not in the DTO. This means the DTO is technically valid for `type=REDIRECT, redirectTo=undefined` — the error only surfaces after the DTO validation passes.

---

### `dto/update-domain.dto.ts`

All fields optional:
- `type?: DomainType`
- `tenantId?: string`
- `redirectTo?: string`
- `isActive?: boolean`

---

## Dependency Graphs

### CompaniesModule

```
CompaniesController
  └── CompaniesService
        ├── PrismaService (global)
        └── AuditLogService
              └── PrismaService (global)
```

### ProductsModule

```
ProductsController
  └── ProductsService
        ├── PrismaService (global)
        └── AuditLogService
              └── PrismaService (global)
```

### DomainsModule

```
DomainsController
  └── DomainsService
        ├── PrismaService (global)
        └── AuditLogService
              └── PrismaService (global)
```

---

## Cross-Module Interactions

| Action | Affects |
|---|---|
| `CompaniesService.create()` | Creates Tenant (nested write) |
| `ProductsService.create()` | Creates Tenant (nested write) |
| `TenantService.resolveFromDomain()` | Reads Domain, Tenant, Branding, FeatureFlags |
| `TenantMiddleware` | Calls TenantService on every request |
| Domain create/update/delete | Should invalidate TenantService cache — currently DOES NOT |

---

## Route Access Matrix

| Route | VIEWER | CONTENT_EDITOR | PRODUCT_MANAGER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| GET /companies | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ (all) |
| GET /companies/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| POST /companies | ✗ | ✗ | ✗ | ✗ | ✓ |
| PATCH /companies/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| DELETE /companies/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /products | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ (all) |
| GET /products/:id | ✗ | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ |
| POST /products | ✗ | ✗ | ✗ | ✓ | ✓ |
| PATCH /products/:id/status | ✗ | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ |
| PATCH /products/:id | ✗ | ✗ | ✓ (scoped) | ✓ (scoped) | ✓ |
| DELETE /products/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /domains | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ (all) |
| GET /domains/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| POST /domains | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| PATCH /domains/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| DELETE /domains/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
