# NEXUVA OS — CURRENT ARCHITECTURE REPORT

> **Purpose:** Source-of-truth technical map before Phase 2 Step 12 (Storage Module).
> **Date:** 2026-06-18
> **Scope:** Full codebase inspection — no assumptions, no modifications.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Folder Structure](#2-folder-structure)
3. [Backend Architecture](#3-backend-architecture)
4. [Database Architecture](#4-database-architecture)
5. [Multi-Tenant Architecture](#5-multi-tenant-architecture)
6. [Authentication System](#6-authentication-system)
7. [Authorization System](#7-authorization-system)
8. [Audit System](#8-audit-system)
9. [CMS Architecture](#9-cms-architecture)
10. [API Map](#10-api-map)
11. [File Ownership Map](#11-file-ownership-map)
12. [Backlog — Unfinished Items](#12-backlog--unfinished-items)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Security Review Summary](#14-security-review-summary)
15. [Recommendations Before Step 12](#15-recommendations-before-step-12)

---

## 1. Executive Summary

Nexuva OS is a **multi-tenant Corporate Operating System** built as a pnpm + Turborepo monorepo. It manages digital holdings, subsidiaries, products, domains, CMS content, SEO, branding, feature flags, and tenant settings from a single backend API.

**Phase 2 completion status (as of this report):**

| Phase 2 Step | Module | Status |
|---|---|---|
| Step 1 | Companies | ✅ Complete |
| Step 2 | Products | ✅ Complete |
| Step 3 | Domains | ✅ Complete |
| Step 4 | Users & Roles | ✅ Complete |
| Step 5 | Branding | ✅ Complete |
| Step 6 | SEO | ✅ Complete |
| Step 7 | Pages | ✅ Complete |
| Step 8 | Content Blocks | ✅ Complete |
| Step 9 | CMS Versioning | ✅ Complete |
| Step 10 | Feature Flags | ✅ Complete |
| Step 11 | Settings | ✅ Complete |
| Step 12 | Storage | ⏳ Pending |

**Key architectural decisions:**
- **NestJS + Fastify** backend (not Express) — all HTTP primitives are Fastify types
- **Prisma ORM** with PostgreSQL + JSONB — no raw SQL except two partial unique index migrations
- **Tenant-First Architecture** — Tenant is primary deployable unit; Company and Product are overlays
- **Global APP_GUARD** — JwtAuthGuard + RolesGuard registered globally; `@Public()` exempts routes
- **argon2id** for password and refresh token hashing
- **JWT** access (15m) + refresh (7d) with full rotation and revocation

---

## 2. Folder Structure

```
nexuva-web/                          ← Monorepo root
├── package.json                     ← Workspace root (Turborepo, pnpm@9.4.0, node>=20)
├── .env.example                     ← Environment variable reference
├── apps/
│   ├── api/                         ← NestJS + Fastify backend (PORT 4000)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        ← Single source-of-truth database schema
│   │   │   └── migrations/
│   │   │       └── manual/
│   │   │           └── partial_unique_indexes.sql  ← Manual SQL for NULL uniqueness
│   │   └── src/
│   │       ├── main.ts              ← Bootstrap: Fastify, multipart, rate-limit, Swagger
│   │       ├── app.module.ts        ← Root module; global guards; TenantMiddleware
│   │       ├── prisma/              ← PrismaModule + PrismaService (singleton)
│   │       ├── config/              ← app / database / jwt / storage / email configs
│   │       ├── common/
│   │       │   ├── decorators/      ← @Public(), @Roles(), @CurrentUser(), @Tenant()
│   │       │   ├── guards/          ← JwtAuthGuard, RolesGuard
│   │       │   ├── middleware/      ← TenantMiddleware (domain → TenantContext)
│   │       │   ├── filters/         ← HttpExceptionFilter (global error shape)
│   │       │   ├── interceptors/    ← AuditInterceptor (HTTP-level mutation logger)
│   │       │   └── pipes/           ← (directory exists, no custom pipes yet)
│   │       └── modules/
│   │           ├── auth/            ← Login, refresh, logout, /me
│   │           ├── companies/       ← Company CRUD (holding/subsidiary)
│   │           ├── products/        ← Product lifecycle management
│   │           ├── domains/         ← Domain mapping + redirect handling
│   │           ├── users/           ← User management + role assignment
│   │           ├── roles/           ← Role hierarchy + permission matrix
│   │           ├── branding/        ← Tenant branding (logo, colors, CSS)
│   │           ├── seo/             ← Per-page SEO metadata
│   │           ├── pages/           ← CMS pages (create, publish, version)
│   │           ├── content-blocks/  ← Ordered content blocks within pages
│   │           ├── versioning/      ← Page version history + rollback/restore
│   │           ├── feature-flags/   ← Tenant-scoped feature switches
│   │           ├── settings/        ← Tenant-scoped key/value configuration
│   │           ├── storage/         ← Cloudflare R2 file upload/delete
│   │           ├── tenant/          ← Domain → Tenant resolution (with cache)
│   │           ├── audit-log/       ← Security audit trail (before/after)
│   │           ├── activity-log/    ← Human-readable event stream
│   │           ├── notifications/   ← In-app notification queue
│   │           ├── email/           ← Email provider abstraction (Resend/SendGrid/SMTP)
│   │           ├── health/          ← GET /health (@Public)
│   │           └── mcp/             ← AI/MCP placeholder (no business logic yet)
│   │
│   ├── admin/                       ← Next.js 14 Super Admin Panel (PORT 3001)
│   │   ├── app/
│   │   │   ├── (auth)/login/        ← Login page (Phase 4 placeholder)
│   │   │   └── (dashboard)/         ← Dashboard shell + route groups
│   │   │       ├── branding/
│   │   │       ├── companies/
│   │   │       ├── domains/
│   │   │       ├── pages/
│   │   │       ├── products/
│   │   │       ├── seo/
│   │   │       ├── settings/
│   │   │       └── users/
│   │   ├── components/
│   │   ├── lib/api.ts               ← adminFetch() wrapper (Bearer token)
│   │   └── middleware.ts
│   │
│   ├── web/                         ← Next.js 14 Public Website (PORT 3000)
│   │   ├── app/[locale]/            ← i18n route group (tr/en)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── lib/api.ts               ← Public API fetch helper
│   │   └── middleware.ts
│   │
│   └── web-legacy/                  ← Archived original Vite+React prototype
│       └── src/                     ← (kept for reference, not in build)
│
├── packages/
│   ├── types/                       ← @nexuva/types — shared TypeScript interfaces
│   │   └── src/
│   │       ├── enums.ts             ← UserRole, BlockType, ProductStatus, etc.
│   │       ├── entities/            ← Entity interfaces (Company, Page, User, …)
│   │       ├── api/                 ← ApiResponse, ApiError, Pagination types
│   │       └── tenant/context.ts   ← TenantContext, TenantResolutionResult
│   │
│   ├── shared/                      ← @nexuva/shared — runtime utilities
│   │   └── src/
│   │       ├── constants/
│   │       │   ├── roles.ts         ← ROLE_HIERARCHY, hasRoleOrHigher()
│   │       │   └── enums.ts         ← BLOCK_TYPES, FEATURE_FLAG_KEYS, SUPPORTED_LOCALES
│   │       ├── utils/index.ts
│   │       └── validators/common.ts
│   │
│   └── ui/                          ← @nexuva/ui — shared React component library
│       └── src/
│           ├── components/          ← (empty — Phase 4 work)
│           └── lib/cn.ts            ← Tailwind class merger (clsx + tailwind-merge)
│
├── tooling/
│   ├── eslint/                      ← Shared ESLint config
│   ├── prettier/                    ← Shared Prettier config
│   └── typescript/
│       ├── base.json                ← Base tsconfig
│       └── nestjs.json              ← NestJS-specific tsconfig overrides
│
└── docker/
    └── postgres/                    ← Docker Compose for local PostgreSQL
```

---

## 3. Backend Architecture

### Framework Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | NestJS (latest) |
| HTTP Adapter | Fastify (not Express) |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 |
| Auth | passport-jwt + argon2 |
| Validation | class-validator + class-transformer |
| API Docs | @nestjs/swagger (dev only) |
| File Uploads | @fastify/multipart (10 MB, 5 files) |
| Rate Limiting | @fastify/rate-limit (100 req/min global) |

### Common Infrastructure (`src/common/`)

**Decorators**

| Decorator | File | Purpose |
|---|---|---|
| `@Public()` | `decorators/public.decorator.ts` | Marks route as unauthenticated (bypasses JwtAuthGuard) |
| `@Roles('ADMIN')` | `decorators/roles.decorator.ts` | Sets minimum role; RolesGuard enforces via `hasRoleOrHigher()` |
| `@CurrentUser()` | `decorators/current-user.decorator.ts` | Extracts `request.user` (or a named field) from JWT-validated request |
| `@Tenant()` | `decorators/tenant.decorator.ts` | Extracts `request.tenantContext` set by TenantMiddleware |

**Guards (globally registered via APP_GUARD)**

| Guard | File | Behavior |
|---|---|---|
| `JwtAuthGuard` | `guards/jwt.guard.ts` | Validates Bearer JWT on every request; skips if `@Public()` is set |
| `RolesGuard` | `guards/roles.guard.ts` | Checks `hasRoleOrHigher(user.role, requiredRole)`; passes through if no `@Roles()` on route |

**Middleware**

| Middleware | File | Behavior |
|---|---|---|
| `TenantMiddleware` | `middleware/tenant.middleware.ts` | Resolves `request.host` → Domain → Tenant; sets `req.tenantContext`; issues 301 for REDIRECT domains; sets `null` (no throw) for unknown domains |

**Filters**

| Filter | File | Behavior |
|---|---|---|
| `HttpExceptionFilter` | `filters/http-exception.filter.ts` | Formats all exceptions to `{ success, statusCode, message, errors, timestamp, path }` matching `@nexuva/types` `ApiError` shape |

**Interceptors**

| Interceptor | File | Behavior |
|---|---|---|
| `AuditInterceptor` | `interceptors/audit.interceptor.ts` | HTTP-level mutation logger (POST/PUT/PATCH/DELETE → logs `method + url + actorId`). **Note:** This is separate from the fine-grained `AuditLogService` used within service methods. |

### Module Table

| Module | Location | Controller | Service | Primary Prisma Models |
|---|---|---|---|---|
| Auth | `modules/auth` | `auth.controller.ts` | `auth.service.ts` | `User`, `RefreshToken` |
| Companies | `modules/companies` | `companies.controller.ts` | `companies.service.ts` | `Company`, `Tenant` |
| Products | `modules/products` | `products.controller.ts` | `products.service.ts` | `Product`, `Tenant` |
| Domains | `modules/domains` | `domains.controller.ts` | `domains.service.ts` | `Domain`, `Tenant` |
| Users | `modules/users` | `users.controller.ts` | `users.service.ts` | `User`, `RefreshToken` |
| Roles | `modules/roles` | `roles.controller.ts` | `roles.service.ts` | `Permission` |
| Branding | `modules/branding` | `branding.controller.ts` | `branding.service.ts` | `Branding`, `Tenant` |
| SEO | `modules/seo` | `seo.controller.ts` | `seo.service.ts` | `SeoSetting`, `Page` |
| Pages | `modules/pages` | `pages.controller.ts` | `pages.service.ts` | `Page`, `PageVersion`, `ContentBlock` |
| Content Blocks | `modules/content-blocks` | `content-blocks.controller.ts` | `content-blocks.service.ts` | `ContentBlock`, `Page` |
| Versioning | `modules/versioning` | `versioning.controller.ts` | `versioning.service.ts` | `PageVersion`, `Page`, `SeoSetting` |
| Feature Flags | `modules/feature-flags` | `feature-flags.controller.ts` | `feature-flags.service.ts` | `FeatureFlag`, `Tenant` |
| Settings | `modules/settings` | `settings.controller.ts` | `settings.service.ts` | `SystemSetting`, `Tenant` |
| Storage | `modules/storage` | `upload.controller.ts` | `storage.service.ts` | *(none — R2 only)* |
| Tenant | `modules/tenant` | `tenant.controller.ts` | `tenant.service.ts` | `Tenant`, `Domain`, `FeatureFlag` |
| Audit Log | `modules/audit-log` | *(none)* | `audit-log.service.ts` | `AuditLog` |
| Activity Log | `modules/activity-log` | *(none)* | `activity-log.service.ts` | `ActivityLog` |
| Notifications | `modules/notifications` | `notifications.controller.ts` | `notifications.service.ts` | `Notification` |
| Email | `modules/email` | *(none)* | `email.service.ts` | *(none — provider only)* |
| Health | `modules/health` | `health.controller.ts` | *(none)* | *(none)* |
| MCP | `modules/mcp` | *(none)* | `mcp.service.ts` | `McpProvider`, `McpConnection`, `AiAgent`, etc. |

---

## 4. Database Architecture

### Schema Overview

**Total models: 22** across business logic, auth, CMS, audit, AI/MCP, and notifications.

---

### Model: `Tenant`
**Purpose:** Primary deployable unit. Every domain resolves to a Tenant. Company and Product are overlays.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| slug | String | @unique |
| type | TenantType | HOLDING \| PRODUCT |
| name | String | |
| description | String? | |
| isActive | Boolean | default true |
| deletedAt | DateTime? | soft delete |

**Relations:** `Company?`, `Product?`, `Domain[]`, `Page[]`, `Branding?`, `SystemSetting[]`, `FeatureFlag[]`, `ActivityLog[]`, `Notification[]`

**Indexes:** `@@index([isActive])`, `@@index([type])`

**Security note:** All tenant-scoped resources resolve ownership through this model.

---

### Model: `Company`
**Purpose:** Legal entity (Holding or Subsidiary). Linked 1:1 to a Tenant.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | @unique FK → Tenant |
| name | String | |
| type | CompanyType | HOLDING \| SUBSIDIARY |
| legalName | String? | |
| taxId | String? | |
| parentId | String? | self-reference for hierarchy |
| deletedAt | DateTime? | soft delete |

**Relations:** `parent Company?`, `subsidiaries Company[]`, `products Product[]`, `users User[]`

**Indexes:** `@@index([parentId])`, `@@index([type])`

**Security note:** `actorCompanyId` in JWT comes from `user.companyId`. All resource queries compare resolved owner company against this value.

---

### Model: `Product`
**Purpose:** Software product. Linked 1:1 to a Tenant and belongs to a Company.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | @unique FK → Tenant |
| companyId | String | FK → Company |
| name, slug | String | slug @unique |
| status | ProductStatus | DRAFT \| ACTIVE \| HIDDEN \| BETA \| ARCHIVED |
| deletedAt | DateTime? | soft delete |

**Indexes:** `@@index([companyId])`, `@@index([status])`

---

### Model: `Domain`
**Purpose:** Maps a domain name to a Tenant. Supports PRIMARY, SUBDOMAIN, REDIRECT, ALIAS types.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | FK → Tenant |
| domainName | String | @unique |
| type | DomainType | PRIMARY \| SUBDOMAIN \| REDIRECT \| ALIAS |
| isActive | Boolean | default true |
| redirectTo | String? | Required when type=REDIRECT |

**Indexes:** `@@index([tenantId])`, `@@index([tenantId, isActive])`

**Security note:** No `deletedAt` — domains are hard-deleted. REDIRECT domains must have `redirectTo` set.

---

### Model: `Page`
**Purpose:** CMS page scoped to a Tenant. Supports localization, publishing, versioning.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | FK → Tenant |
| slug | String | Unique per [tenantId, slug, locale] |
| title | String | |
| isPublished | Boolean | default false |
| locale | String | default 'tr' |
| currentVersion | Int | default 1 (legacy field — version numbering now uses MAX+1) |
| deletedAt | DateTime? | soft delete |

**Relations:** `contentBlocks ContentBlock[]`, `seoSetting SeoSetting?`, `versions PageVersion[]`

**Indexes:** `@@unique([tenantId, slug, locale])`, `@@index([tenantId])`, `@@index([tenantId, isPublished])`, `@@index([tenantId, locale])`

**Security note:** Soft-deleted pages still reserve their `@@unique` slug. This is a known backlog item.

---

### Model: `ContentBlock`
**Purpose:** Ordered, typed content unit within a Page.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| pageId | String | FK → Page (onDelete: Cascade) |
| type | BlockType | HERO \| TEXT \| IMAGE \| GALLERY \| CTA \| FEATURES \| TESTIMONIALS \| FAQ \| CUSTOM |
| content | Json | JSONB payload (max 100 KB validated in service) |
| position | Int | Ordering integer |
| isVisible | Boolean | default true (public filter: isVisible=true AND deletedAt=null) |
| deletedAt | DateTime? | soft delete |

**Indexes:** `@@index([pageId])`, `@@index([pageId, position])`, `@@index([pageId, deletedAt])`

---

### Model: `PageVersion`
**Purpose:** Immutable content snapshot for rollback/restore.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| pageId | String | FK → Page (onDelete: Cascade) |
| versionNumber | Int | Auto-incremented per page (MAX+1 strategy) |
| title | String | Page title at snapshot time |
| contentSnapshot | Json | Array of block objects [{type, content, position, isVisible}] |
| seoSnapshot | Json? | SEO settings at snapshot time (null if no SEO existed) |
| createdById | String | FK → User |
| createdAt | DateTime | |

**Indexes:** `@@unique([pageId, versionNumber])`, `@@index([pageId])`, `@@index([createdById])`

**Security note:** Versions are append-only. Deletion is SUPER_ADMIN only and audit-logged.

---

### Model: `SeoSetting`
**Purpose:** 1:1 with Page. Stores all meta/OG/Twitter SEO fields.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| pageId | String | @unique FK → Page (onDelete: Cascade) |
| metaTitle | String? | max 70 chars (validated in DTO) |
| metaDescription | String? | max 160 chars |
| keywords | String[] | max 20 items |
| ogImage, ogTitle, ogDescription | String? | |
| twitterCard | String? | summary \| summary_large_image \| app \| player |
| canonicalUrl | String? | |
| noIndex | Boolean | default false |

---

### Model: `Branding`
**Purpose:** 1:1 with Tenant. Controls visual identity.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| tenantId | String | @unique FK → Tenant |
| logoUrl, faviconUrl | String? | @IsUrl validated |
| primaryColor, secondaryColor, accentColor | String? | @Matches(/^#[0-9A-Fa-f]{6}$/) |
| fontHeading, fontBody | String? | |
| themePreset | String? | @IsIn(THEME_PRESETS) |
| customCss | String? | max 51200 chars (~50 KB) |
| config | Json? | Additional config |

---

### Model: `User`
**Purpose:** Platform user. Optional company scope.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| email | String | @unique |
| passwordHash | String | argon2id — NEVER returned in responses |
| firstName, lastName | String? | |
| role | UserRole | SUPER_ADMIN \| ADMIN \| PRODUCT_MANAGER \| CONTENT_EDITOR \| VIEWER |
| isActive | Boolean | default true |
| companyId | String? | FK → Company |
| lastLoginAt | DateTime? | |
| deletedAt | DateTime? | soft delete |

**Relations:** `pageVersions PageVersion[]`, `auditLogs AuditLog[]`, `refreshTokens RefreshToken[]`, `notifications Notification[]`

**Indexes:** `@@index([companyId])`, `@@index([role])`

**Security notes:**
- `passwordHash` excluded from all responses via `USER_SELECT` constant
- Last SUPER_ADMIN cannot be demoted or deleted
- Self-role-change blocked
- Soft-delete revokes all active refresh tokens

---

### Model: `RefreshToken`
**Purpose:** Hashed refresh token store for rotation.

| Field | Type | Notes |
|---|---|---|
| tokenHash | String | @unique — argon2id hash of raw token |
| expiresAt | DateTime | 7 days from creation |
| isRevoked | Boolean | default false |
| userId | String | FK → User (onDelete: Cascade) |

**Indexes:** `@@index([userId])`, `@@index([userId, isRevoked])`

**Security note:** Raw token is never stored. Only `argon2.hash(token)` is persisted.

---

### Model: `FeatureFlag`
**Purpose:** Tenant-scoped or global feature switches.

| Field | Type | Notes |
|---|---|---|
| key | String | `@Matches(/^[a-z][a-z0-9_]*$/)`, max 64 chars |
| tenantId | String? | null = global flag |
| isEnabled | Boolean | default false |
| config | Json? | max 10 KB validated |
| deletedAt | DateTime? | soft delete |

**Unique:** `@@unique([key, tenantId])` + partial SQL index for NULL tenantId

**Indexes:** `@@index([tenantId])`, `@@index([tenantId, deletedAt])`, `@@index([isEnabled])`

**Security note:** Global flags (tenantId=null) accessible to SUPER_ADMIN only. Tenant flags scoped via ownership chain.

---

### Model: `SystemSetting`
**Purpose:** Key/value configuration store. Per-tenant or global.

| Field | Type | Notes |
|---|---|---|
| key | String | `@Matches(/^[a-z][a-z0-9_]*$/)`, max 100 chars |
| value | Json | Type-validated in service (max 100 KB) |
| type | SettingType | STRING \| NUMBER \| BOOLEAN \| JSON \| TEXT |
| isPublic | Boolean | default false — public API only returns isPublic=true records |
| tenantId | String? | null = global setting |
| deletedAt | DateTime? | soft delete |

**Unique:** `@@unique([key, tenantId])` + partial SQL index for NULL tenantId

**Indexes:** `@@index([tenantId])`, `@@index([tenantId, deletedAt])`, `@@index([tenantId, isPublic])`

---

### Model: `Permission`
**Purpose:** Dynamic role-resource permission matrix (SUPER_ADMIN managed).

| Field | Type | Notes |
|---|---|---|
| role | UserRole | |
| resource | String | e.g. "company", "page" |
| actions | Json | e.g. `{read: true, write: false}` |

**Unique:** `@@unique([role, resource])`

**Security note:** Stored permissions supplement but do not replace route-level `@Roles()` guards. Deleting a record does NOT unblock access at the route layer.

---

### Model: `AuditLog`
**Purpose:** Immutable security audit trail.

| Field | Type | Notes |
|---|---|---|
| actorId | String | FK → User |
| action | String | e.g. CREATE, UPDATE, ROLE_CHANGE, PUBLISH |
| resource | String | e.g. "page", "user", "feature_flag" |
| resourceId | String? | |
| before | Json? | State before mutation |
| after | Json? | State after mutation |
| ipAddress | String? | (populated by interceptor when available) |
| userAgent | String? | |

**Indexes:** `@@index([actorId])`, `@@index([resource, resourceId])`, `@@index([createdAt])`

---

### Model: `ActivityLog`
**Purpose:** Human-readable event stream (separate from security audit).

| Field | Type | Notes |
|---|---|---|
| actorId | String? | Optional — system events have no actor |
| tenantId | String? | Tenant-scoped events |
| event | String | e.g. "user.login" |
| description | String | Human-readable message |
| metadata | Json? | |

**Indexes:** `@@index([actorId])`, `@@index([tenantId])`, `@@index([event])`, `@@index([createdAt])`

---

### Model: `Notification`
**Purpose:** In-app notification queue.

| Field | Type | Notes |
|---|---|---|
| userId | String | FK → User |
| tenantId | String? | Optional tenant scope |
| type | NotificationType | INFO \| SUCCESS \| WARNING \| ERROR \| SYSTEM |
| isRead | Boolean | default false |
| readAt | DateTime? | |

**Indexes:** `@@index([userId, isRead])`, `@@index([tenantId])`, `@@index([createdAt])`

---

### MCP/AI Models (placeholders — no business logic)

- `McpProvider` — registered AI provider records
- `McpConnection` — tenant ↔ provider link (PENDING/ACTIVE/ERROR/DISABLED)
- `AiAgent` — agent configuration per tenant
- `AgentPermission` — what the agent can do
- `WorkflowDefinition` — workflow blueprint
- `AgentAuditLog` — agent action trail

**Status:** Schema in place so future activation requires zero migrations.

---

### Ownership Relation Map

```
Company
  │
  ├── Tenant (1:1 via Company.tenantId)
  │     ├── Domain[]
  │     ├── Page[]
  │     │     ├── ContentBlock[]
  │     │     ├── SeoSetting (1:1)
  │     │     └── PageVersion[]
  │     ├── Branding (1:1)
  │     ├── FeatureFlag[]
  │     └── SystemSetting[]
  │
  └── Product[]
        │
        └── Tenant (1:1 via Product.tenantId)
              └── (same tree as above)
```

---

## 5. Multi-Tenant Architecture

### Core Principle

**Tenant is the primary deployable unit.** Every HTTP request is domain-resolved to a Tenant. Company and Product are organizational overlays — they exist to determine *who owns* a Tenant, not what a Tenant serves.

### Resolution Flow

```
Incoming HTTP Request (Host: logiops.nexuva.com)
        │
        ▼
TenantMiddleware.use()
        │   reads req.headers.host
        │   calls TenantService.resolveFromDomain(domain)
        │   ┌─ Cache hit (60s TTL) → return cached TenantContext
        │   └─ Cache miss →
        │       prisma.domain.findFirst({ where: { domainName, isActive: true } })
        │       ┌─ Not found    → req.tenantContext = null; next()
        │       ├─ REDIRECT     → res.redirect(301, redirectTo)
        │       └─ Found        → build TenantContext { tenantId, slug, branding, featureFlags, locale }
        │                         req.tenantContext = context; next()
        ▼
JWT Validation (JwtAuthGuard)
        │   Extracts Bearer token → passport-jwt validates → JwtStrategy.validate()
        │   validate() calls usersService.findById(sub)
        │   Returns full User object → req.user = user
        ▼
RolesGuard
        │   Reads @Roles() metadata from handler/class
        │   Calls hasRoleOrHigher(user.role, requiredRole)
        │   Throws 403 if insufficient
        ▼
Controller
        │   @CurrentUser() → extracts req.user
        │   Calls service with (actorId, actorRole, actorCompanyId)
        ▼
Service: Ownership Check
        │   assertTenantOwnership(tenantId, actorRole, actorCompanyId)
        │   OR
        │   assertXxxOwnership(resourceId, actorRole, actorCompanyId)
        │       ┌─ SUPER_ADMIN → bypass (return)
        │       └─ others     →
        │           fetch Resource → Tenant
        │           resolveOwnerCompanyId(tenant):
        │             tenant.company?.id ?? tenant.product?.companyId
        │           if ownerCompanyId !== actorCompanyId → throw 403
        ▼
Prisma Query (scoped to verified tenant/company)
```

### `actorCompanyId` Flow

1. User logs in → `JWT payload = { sub: userId, email, role }` (no companyId in JWT)
2. Every request → `JwtStrategy.validate()` → calls `usersService.findById(sub)` → returns full `User` record including `companyId`
3. `req.user = { id, email, role, companyId, ... }`
4. Controller: `@CurrentUser() user` → passes `user.companyId` to service
5. Service: uses `actorCompanyId` in all ownership comparisons

### `resolveOwnerCompanyId()` — Universal Ownership Helper

Every service that handles tenant-scoped resources implements this identical helper:

```typescript
private resolveOwnerCompanyId(tenant: {
  company: { id: string } | null;
  product: { companyId: string } | null;
}): string | null {
  return tenant.company?.id ?? tenant.product?.companyId ?? null;
}
```

This resolves **both** ownership cases:
- Company-type tenant: `tenant.company.id`
- Product-type tenant: `tenant.product.companyId`

### SUPER_ADMIN Bypass

Every ownership check starts with:
```typescript
if (actorRole === 'SUPER_ADMIN') return; // or return resource
```

SUPER_ADMIN sees all records across all tenants. No company scoping applies.

---

## 6. Authentication System

### Files

| File | Purpose |
|---|---|
| `modules/auth/auth.service.ts` | Login, refresh, logout, signTokenPair |
| `modules/auth/auth.controller.ts` | POST /auth/login, /refresh, /logout, GET /me |
| `modules/auth/auth.module.ts` | Imports JwtModule, PassportModule, UsersModule |
| `modules/auth/strategies/jwt.strategy.ts` | Validates JWT + fetches full user from DB |
| `modules/auth/dto/login.dto.ts` | email, password |
| `modules/auth/dto/refresh.dto.ts` | refreshToken |
| `common/guards/jwt.guard.ts` | Extends AuthGuard('jwt'); honors @Public() |

### Login Flow

```
POST /auth/login { email, password }
        │
        ├── prisma.user.findUnique({ email })
        ├── Check: user exists, isActive=true, deletedAt=null → else 401
        ├── argon2.verify(user.passwordHash, dto.password) → else 401
        ├── prisma.user.update({ lastLoginAt: new Date() })
        ├── signTokenPair({ sub, email, role }, userId)
        │     ├── jwt.sign(payload, accessSecret, '15m')
        │     ├── jwt.sign(payload, refreshSecret, '7d')
        │     ├── argon2.hash(refreshToken) → tokenHash
        │     └── prisma.refreshToken.create({ userId, tokenHash, expiresAt })
        └── return { accessToken, refreshToken, user: { id, email, firstName, lastName, role } }
```

### Refresh Token Flow

```
POST /auth/refresh { refreshToken }
        │
        ├── jwt.verify(refreshToken, refreshSecret) → validate signature + expiry
        ├── prisma.refreshToken.findFirst({ userId, isRevoked: false, expiresAt > now })
        ├── argon2.verify(stored.tokenHash, refreshToken) → validate raw token
        ├── prisma.refreshToken.update({ isRevoked: true }) → revoke old
        ├── Check: user still active
        └── signTokenPair(newPayload, userId) → issue new pair (rotation)
```

### Logout Flow

```
POST /auth/logout (requires auth)
        │
        └── prisma.refreshToken.updateMany({ userId, isRevoked: false }, { isRevoked: true })
            → revokes ALL active sessions for the user
```

### Security Properties

| Property | Implementation |
|---|---|
| Password hashing | argon2id (argon2 library default) |
| Refresh token storage | argon2.hash(rawToken) only — raw never persisted |
| Token rotation | Every refresh revokes old token, issues new pair |
| Startup validation | `process.exit(1)` if JWT secrets missing |
| Soft-deleted user guard | `JwtStrategy.validate()` checks `user.isActive` |
| Session revocation on delete | `usersService.softDelete()` revokes all refresh tokens |

---

## 7. Authorization System

### Role Hierarchy

```
SUPER_ADMIN   weight: 100  — Platform-wide authority, no tenant scope
ADMIN         weight:  80  — Full tenant management
PRODUCT_MANAGER weight: 60  — Product lifecycle management
CONTENT_EDITOR  weight:  40  — CMS content creation/editing
VIEWER          weight:  20  — Read-only access
```

Defined in: `packages/shared/src/constants/roles.ts`

### `hasRoleOrHigher(userRole, requiredRole)`

```typescript
ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
```

A user passes a `@Roles('CONTENT_EDITOR')` check if their role has weight ≥ 40. So ADMIN (80), PRODUCT_MANAGER (60), CONTENT_EDITOR (40) all pass. VIEWER (20) does not.

### `@Roles()` Usage Pattern

```typescript
@Roles('CONTENT_EDITOR')  // anyone ≥ CONTENT_EDITOR can call this
@Roles('ADMIN')           // only ADMIN, SUPER_ADMIN
@Roles('SUPER_ADMIN')     // only SUPER_ADMIN
```

### Privilege Escalation Prevention (Users Module)

```typescript
private assertNoEscalation(actorRole: UserRole, targetRole: UserRole): void {
  if (ROLE_HIERARCHY[targetRole] > ROLE_HIERARCHY[actorRole]) {
    throw new ForbiddenException(`You cannot assign a role higher than your own`);
  }
}
```

### Permission Model (`Permission` table)

- Stored as JSON: `{ role, resource, actions: { read, write, delete, ... } }`
- Managed via `RolesService.setPermission()` / `removePermission()` — SUPER_ADMIN only
- **Current limitation:** The stored `Permission` records are queryable but **not actively enforced** at request time. Route-level `@Roles()` guards are the real enforcement mechanism.
- **Future:** Dynamic permission checks could read `Permission` records to allow per-resource granularity without code changes.

### Self-Mutation Blocks

- User cannot change their own role or `isActive` status
- User cannot delete their own account
- Last SUPER_ADMIN cannot be demoted or deleted

---

## 8. Audit System

### Two-Tier Audit Architecture

| Tier | Component | Granularity | Storage |
|---|---|---|---|
| HTTP-level | `AuditInterceptor` | Method + URL + actorId | Logger only (not DB) |
| Business-level | `AuditLogService` | Resource + before/after state | `AuditLog` table |

### `AuditLogService` Interface

```typescript
interface CreateAuditLogParams {
  actorId: string;
  action: string;       // e.g. "CREATE", "UPDATE", "ROLE_CHANGE", "PUBLISH"
  resource: string;     // e.g. "page", "user", "feature_flag"
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
```

### Audit Coverage by Module

| Module | Actions Audited |
|---|---|
| Companies | CREATE, UPDATE, DELETE |
| Products | CREATE, UPDATE, STATUS_CHANGE, DELETE |
| Domains | CREATE, UPDATE, DELETE |
| Users | CREATE, UPDATE, ROLE_CHANGE, DELETE |
| Roles | CREATE, UPDATE, DELETE (permissions) |
| Branding | CREATE/UPDATE, DELETE (reset) |
| SEO | CREATE, UPDATE, DELETE |
| Pages | CREATE, UPDATE, PUBLISH, UNPUBLISH, DELETE |
| Content Blocks | CREATE, UPDATE, REORDER, VISIBILITY_CHANGE, DELETE |
| Versioning | CREATE_VERSION, ROLLBACK, RESTORE, DELETE_VERSION |
| Feature Flags | CREATE, UPDATE, ENABLE, DISABLE, DELETE |
| Settings | CREATE_SETTING, UPDATE_SETTING, DELETE_SETTING |

### `AuditLogModule`

Exported globally — imported by every module that performs mutations. Does not have a controller. Query methods (`findByActor`, `findByResource`) exist for future admin UI.

---

## 9. CMS Architecture

### Content Hierarchy

```
Tenant
  └── Page (slug, locale, isPublished)
        ├── ContentBlock[] (type, content JSONB, position, isVisible)
        ├── SeoSetting (1:1 — meta, OG, Twitter, canonical)
        └── PageVersion[] (immutable snapshots)

Tenant
  └── Branding (1:1 — logo, colors, fonts, CSS)
```

### CMS Data Flow

**Admin write path:**
```
Admin Panel (apps/admin)
    │  Bearer JWT
    ▼
PATCH /pages/:id       → pages.service.update()
                          → captureVersionInTx() [snapshot BEFORE change]
                          → tx.page.update()
                          → auditLog.log()

PATCH /content-blocks/:id → content-blocks.service.update()
                             → captureVersionInTx() [snapshot BEFORE change]
                             → tx.contentBlock.update()
                             → auditLog.log()
```

**Public read path:**
```
Browser/SSR (apps/web)
    │  No auth
    ▼
GET /pages/public/:tenantId/:locale/:slug
    → pages.service.findBySlug()
    → prisma.page.findFirst({
        where: { tenantId, slug, locale, deletedAt: null, isPublished: true },
        include: {
          contentBlocks: { where: { isVisible: true, deletedAt: null }, orderBy: position },
          seoSetting: true
        }
      })
```

### Versioning Strategy

- Versions are captured **before** mutations (pre-mutation snapshots)
- Every snapshot includes: blocks (type/content/position/isVisible), SEO, page title
- Version numbers use `MAX(versionNumber) + 1` per page — never reuse
- Rollback: applies old snapshot content → creates new version at top
- Restore: same as rollback + restores SEO from seoSnapshot

### Public Routes (no auth)

| Route | Module | Purpose |
|---|---|---|
| `GET /pages/public/:tenantId/:locale/:slug` | Pages | Published page content |
| `GET /seo/public/:pageId` | SEO | Published page SEO (meta tags) |
| `GET /feature-flags/check/:tenantId/:key` | Feature Flags | Feature enabled check |
| `GET /settings/public/:tenantId` | Settings | Public tenant settings |
| `GET /health` | Health | Liveness probe |

### Domain Resolution for SSR

The `apps/web` Next.js app reads the incoming hostname and fetches the resolved tenant context from the API. The Tenant context carries `branding`, `featureFlags`, and `locale` — used for per-tenant rendering without additional API calls.

---

## 10. API Map

Base URL: `http://localhost:4000/api/v1`

### Auth

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | @Public | Login → access + refresh tokens |
| POST | `/auth/refresh` | @Public | Rotate refresh token |
| POST | `/auth/logout` | Any auth | Revoke all sessions |
| GET | `/auth/me` | Any auth | Current user profile |

### Companies

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/companies` | ADMIN | List (SUPER_ADMIN: all; ADMIN: own + subsidiaries) |
| GET | `/companies/:id` | ADMIN | Get with branding, domains, products |
| POST | `/companies` | SUPER_ADMIN | Create company + nested Tenant |
| PATCH | `/companies/:id` | ADMIN | Update metadata |
| DELETE | `/companies/:id` | SUPER_ADMIN | Soft delete |

### Products

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/products` | ADMIN | List (scoped) |
| GET | `/products/:id` | ADMIN | Get with full detail |
| POST | `/products` | ADMIN | Create + nested Tenant |
| PATCH | `/products/:id` | ADMIN | Update metadata |
| PATCH | `/products/:id/status` | ADMIN | Change product status |
| DELETE | `/products/:id` | ADMIN | Soft delete |

### Domains

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/domains` | ADMIN | List (scoped) |
| GET | `/domains/:id` | ADMIN | Get single |
| POST | `/domains` | ADMIN | Create (validates REDIRECT requires redirectTo) |
| PATCH | `/domains/:id` | ADMIN | Update (tenantId reassign: SUPER_ADMIN only) |
| DELETE | `/domains/:id` | ADMIN | Hard delete |

### Users

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/users` | ADMIN | List (scoped to company) |
| GET | `/users/:id` | ADMIN | Get single |
| POST | `/users` | ADMIN | Create user (no escalation) |
| PATCH | `/users/:id` | ADMIN | Update profile/role/status |
| PATCH | `/users/:id/role` | ADMIN | Assign role (dedicated endpoint) |
| DELETE | `/users/:id` | ADMIN | Soft delete + revoke tokens |

### Roles

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/roles/hierarchy` | ADMIN | Static role weights |
| GET | `/roles/matrix` | SUPER_ADMIN | All stored permissions |
| GET | `/roles/:role/permissions` | ADMIN | Permissions for a role |
| PUT | `/roles/:role/permissions/:resource` | SUPER_ADMIN | Set permission |
| DELETE | `/roles/:role/permissions/:resource` | SUPER_ADMIN | Remove permission |

### Branding

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/branding/:tenantId` | ADMIN | Get branding |
| PATCH | `/branding/:tenantId` | ADMIN | Upsert (partial) |
| DELETE | `/branding/:tenantId` | ADMIN | Reset (delete record) |

### SEO

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/seo` | CONTENT_EDITOR | List all (scoped) |
| GET | `/seo/page/:pageId` | CONTENT_EDITOR | Get for page |
| GET | `/seo/public/:pageId` | @Public | Published page SEO |
| PUT | `/seo/page/:pageId` | CONTENT_EDITOR | Upsert (partial) |
| DELETE | `/seo/page/:pageId` | ADMIN | Remove SEO |

### Pages

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/pages` | CONTENT_EDITOR | List by tenantId query param |
| GET | `/pages/:id` | CONTENT_EDITOR | Get with blocks, SEO, 10 latest versions |
| GET | `/pages/public/:tenantId/:locale/:slug` | @Public | Published page for SSR |
| POST | `/pages` | CONTENT_EDITOR | Create (starts DRAFT) |
| PATCH | `/pages/:id` | CONTENT_EDITOR | Update title (+ version snapshot) |
| POST | `/pages/:id/publish` | CONTENT_EDITOR | Publish (+ version snapshot) |
| POST | `/pages/:id/unpublish` | CONTENT_EDITOR | Unpublish (+ version snapshot) |
| DELETE | `/pages/:id` | ADMIN | Soft delete |

### Content Blocks

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/content-blocks/page/:pageId` | CONTENT_EDITOR | List blocks (admin — includes hidden) |
| GET | `/content-blocks/:id` | CONTENT_EDITOR | Get single block |
| POST | `/content-blocks` | CONTENT_EDITOR | Create (auto-position if omitted) |
| PATCH | `/content-blocks/page/:pageId/reorder` | CONTENT_EDITOR | Reorder (+ version snapshot) |
| PATCH | `/content-blocks/:id/visibility` | CONTENT_EDITOR | Toggle visibility (+ version snapshot) |
| PATCH | `/content-blocks/:id` | CONTENT_EDITOR | Update type/content (+ version snapshot) |
| DELETE | `/content-blocks/:id` | ADMIN | Soft delete |

### Versioning

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/pages/:pageId/versions` | CONTENT_EDITOR | List versions (newest first) |
| POST | `/pages/:pageId/versions` | CONTENT_EDITOR | Manual snapshot |
| GET | `/versions/:id` | CONTENT_EDITOR | Get version with full snapshot |
| POST | `/pages/:pageId/rollback` | CONTENT_EDITOR | Rollback (blocks + title) |
| POST | `/pages/:pageId/restore` | CONTENT_EDITOR | Restore (blocks + title + SEO) |
| DELETE | `/versions/:id` | SUPER_ADMIN | Permanent delete (audit logged) |

### Feature Flags

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/feature-flags` | ADMIN | List (scoped; SUPER_ADMIN: all) |
| GET | `/feature-flags/:id` | ADMIN | Get single |
| POST | `/feature-flags` | ADMIN | Create (global: SUPER_ADMIN only) |
| PATCH | `/feature-flags/:id` | ADMIN | Update name/description/config |
| PATCH | `/feature-flags/:id/toggle` | ADMIN | Enable/disable (idempotent) |
| DELETE | `/feature-flags/:id` | SUPER_ADMIN | Soft delete |
| GET | `/feature-flags/check/:tenantId/:key` | @Public | Boolean enabled check |

### Settings

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/settings/public/:tenantId` | @Public | Public settings (key+value only) |
| GET | `/settings` | ADMIN | List (scoped) |
| GET | `/settings/:id` | ADMIN | Get single |
| POST | `/settings` | ADMIN | Create (global: SUPER_ADMIN only) |
| PATCH | `/settings/:id` | ADMIN | Update value/type/description/isPublic |
| DELETE | `/settings/:id` | SUPER_ADMIN | Soft delete |

### Storage

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/storage/upload` | CONTENT_EDITOR | Upload file to Cloudflare R2 |

### Health / Utility

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/health` | @Public | Liveness probe |

---

## 11. File Ownership Map

### Authentication & Sessions

```
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/auth.controller.ts
apps/api/src/modules/auth/auth.module.ts
apps/api/src/modules/auth/strategies/jwt.strategy.ts
apps/api/src/modules/auth/dto/login.dto.ts
apps/api/src/modules/auth/dto/refresh.dto.ts
apps/api/src/common/guards/jwt.guard.ts
apps/api/src/common/decorators/public.decorator.ts
```

### Tenant Resolution & Security

```
apps/api/src/modules/tenant/tenant.service.ts
apps/api/src/modules/tenant/tenant.module.ts
apps/api/src/modules/tenant/tenant.controller.ts
apps/api/src/common/middleware/tenant.middleware.ts
apps/api/src/common/decorators/tenant.decorator.ts
```

### Authorization & RBAC

```
apps/api/src/common/guards/roles.guard.ts
apps/api/src/common/decorators/roles.decorator.ts
apps/api/src/common/decorators/current-user.decorator.ts
apps/api/src/modules/roles/roles.service.ts
apps/api/src/modules/roles/roles.controller.ts
apps/api/src/modules/roles/roles.module.ts
packages/shared/src/constants/roles.ts        ← ROLE_HIERARCHY, hasRoleOrHigher()
```

### CMS Core

```
apps/api/src/modules/pages/pages.service.ts
apps/api/src/modules/pages/pages.controller.ts
apps/api/src/modules/pages/pages.module.ts
apps/api/src/modules/content-blocks/content-blocks.service.ts
apps/api/src/modules/content-blocks/content-blocks.controller.ts
apps/api/src/modules/content-blocks/content-blocks.module.ts
apps/api/src/modules/versioning/versioning.service.ts
apps/api/src/modules/versioning/versioning.controller.ts
apps/api/src/modules/versioning/versioning.module.ts
apps/api/src/modules/seo/seo.service.ts
apps/api/src/modules/seo/seo.controller.ts
apps/api/src/modules/branding/branding.service.ts
apps/api/src/modules/branding/branding.controller.ts
```

### Business Structure

```
apps/api/src/modules/companies/companies.service.ts
apps/api/src/modules/companies/companies.controller.ts
apps/api/src/modules/products/products.service.ts
apps/api/src/modules/products/products.controller.ts
apps/api/src/modules/domains/domains.service.ts
apps/api/src/modules/domains/domains.controller.ts
apps/api/src/modules/users/users.service.ts
apps/api/src/modules/users/users.controller.ts
```

### Feature Management

```
apps/api/src/modules/feature-flags/feature-flags.service.ts
apps/api/src/modules/feature-flags/feature-flags.controller.ts
apps/api/src/modules/settings/settings.service.ts
apps/api/src/modules/settings/settings.controller.ts
```

### Storage

```
apps/api/src/modules/storage/storage.service.ts    ← R2 upload/delete/signedUrl
apps/api/src/modules/storage/upload.controller.ts  ← POST /storage/upload
apps/api/src/modules/storage/storage.module.ts
```

### Audit & Observability

```
apps/api/src/modules/audit-log/audit-log.service.ts
apps/api/src/modules/audit-log/audit-log.module.ts
apps/api/src/modules/activity-log/activity-log.service.ts
apps/api/src/modules/activity-log/activity-log.module.ts
apps/api/src/common/interceptors/audit.interceptor.ts
```

### Database

```
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/manual/partial_unique_indexes.sql
```

### Shared Packages

```
packages/types/src/enums.ts              ← UserRole, BlockType, etc.
packages/types/src/entities/            ← TypeScript entity interfaces
packages/types/src/api/                 ← ApiResponse, ApiError, Pagination
packages/types/src/tenant/context.ts    ← TenantContext, TenantResolutionResult
packages/shared/src/constants/roles.ts  ← ROLE_HIERARCHY, hasRoleOrHigher()
packages/shared/src/constants/enums.ts  ← BLOCK_TYPES, FEATURE_FLAG_KEYS, etc.
packages/ui/src/lib/cn.ts               ← Tailwind class merger
```

### Configuration

```
.env.example                             ← All required environment variables
apps/api/src/config/app.config.ts
apps/api/src/config/database.config.ts
apps/api/src/config/jwt.config.ts
apps/api/src/config/storage.config.ts
apps/api/src/config/email.config.ts
apps/api/src/main.ts                     ← Bootstrap + startup guards
```

---

## 12. Backlog — Unfinished Items

### 🔴 Critical / Security Risk

None currently. All Phase 2 tenant isolation backlog items have been resolved (Feature Flags: Step 10, Settings: Step 11).

### 🟡 Architecture Issues

| Item | Location | Notes |
|---|---|---|
| **Page slug reserved after soft delete** | `pages.service.ts` | `@@unique([tenantId, slug, locale])` does not exclude soft-deleted rows. A deleted page permanently reserves its slug for that tenant+locale combination. `create()` has a pre-check + P2002 catch but no clean resolution. Requires partial unique index. |
| **`currentVersion` field is stale** | `schema.prisma` → `Page.currentVersion` | Version numbering now uses `MAX(versionNumber)+1` in `VersioningService.captureVersionInTx()`. The `currentVersion` field on Page is no longer updated but still exists in schema. It's harmless but misleading. |
| **`tenant.locale` field missing from schema** | `tenant.service.ts` line 84 | `(tenant as unknown as { locale?: string }).locale` — the `locale` field is cast unsafely. `Tenant` model does not have a `locale` field in schema. Falls back to `'tr'` always. |

### 🟠 Incomplete Implementations

| Item | Location | Status |
|---|---|---|
| **Storage — no tenant ownership validation** | `upload.controller.ts` | `tenantSlug` is accepted as a query param with no verification that the caller owns that tenant. Step 12 must fix this. |
| **Storage — no database tracking** | `storage.service.ts` | Files are uploaded to R2 but no DB record tracks what was uploaded (no `StorageFile` model). No delete API. No listing. Step 12 must add this. |
| **Email — SendGrid/SMTP not implemented** | `email.service.ts` | `sendViaSendGrid()` and `sendViaSMTP()` throw `NotImplementedException`. Only Resend works. |
| **MCP/AI module** | `mcp.service.ts` | Explicit placeholder: "Implementation deferred to AI phase." All 6 MCP models are in schema but service is empty. |
| **Admin UI (apps/admin)** | `apps/admin/app/` | Only auth layout and dashboard shell exist. All section directories (companies, domains, pages, etc.) exist as folders but have **no page.tsx files** — Phase 4 work. Login page shows placeholder text. |
| **Public website (apps/web)** | `apps/web/app/[locale]/` | Only `layout.tsx` and `page.tsx` scaffold exists. No real CMS rendering connected. Phase 5 work. |
| **`@nexuva/ui` component library** | `packages/ui/src/components/` | Directory exists but is empty. No components built yet. |
| **`ActivityLog` — no controller** | `activity-log/` | Service is complete but no HTTP API to query it. Admin UI cannot view activity logs. |
| **`AuditLog` — no controller** | `audit-log/` | Service has `findByActor()` and `findByResource()` but no controller exposes them. |
| **Notifications — no real trigger** | `notifications/` | Service and controller exist but nothing in the codebase calls `notificationsService.send()`. |
| **Login rate limiting** | `main.ts` | Comment says "Login endpoint has a tighter limit applied via route-level override" but no route-level override exists. Only global 100/min applies to login. |
| **Expired RefreshToken cleanup** | `schema.prisma` | Revoked/expired `RefreshToken` rows accumulate indefinitely. No cleanup job. |
| **`Permission` table** | `modules/roles/` | Records are managed but not consulted at request time. Permission matrix is stored but not actively enforced. |
| **Partial unique indexes not applied** | `migrations/manual/partial_unique_indexes.sql` | SQL file exists but must be applied manually after first `prisma migrate dev`. The Prisma `@@unique` alone does not prevent duplicate global (tenantId=NULL) keys. |

### 🔵 Minor / Code Smell

| Item | Location | Notes |
|---|---|---|
| `SUPER_ADMIN` bypass logic duplicated | Every service | Each service re-implements identical `resolveOwnerCompanyId()` and ownership patterns. Could be extracted to a shared `OwnershipService`, but current duplication is intentional per-module isolation. |
| `as never` type casts | Multiple services | `type: dto.type as never` used to bypass Prisma enum typing in several places. Should use proper type mapping. |
| `NULL as unknown as string` in old code | Replaced but was in `feature-flags.service.ts` (old) | All replaced in Phase 2. No longer present. |

---

## 13. Deployment Architecture

### Current State

Nexuva OS is **local development only** — no production deployment has been configured.

### Environment Variables

All defined in `.env.example`. Required at runtime:

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | ✅ |
| `JWT_ACCESS_SECRET` | Access token signing (min 32 chars) | ✅ (enforced at startup) |
| `JWT_REFRESH_SECRET` | Refresh token signing (min 32 chars) | ✅ (enforced at startup) |
| `JWT_ACCESS_EXPIRY` | Access token TTL (default: 15m) | Optional |
| `JWT_REFRESH_EXPIRY` | Refresh token TTL (default: 7d) | Optional |
| `API_PORT` | API listen port (default: 4000) | Optional |
| `NODE_ENV` | development/production | Optional |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | Optional |
| `R2_ACCOUNT_ID` | Cloudflare R2 account | Storage feature |
| `R2_ACCESS_KEY_ID` | R2 access key | Storage feature |
| `R2_SECRET_ACCESS_KEY` | R2 secret | Storage feature |
| `R2_BUCKET_NAME` | R2 bucket (default: nexuva-os) | Storage feature |
| `R2_PUBLIC_URL` | R2 public CDN URL | Storage feature |
| `EMAIL_PROVIDER` | resend / sendgrid / smtp | Email feature |
| `RESEND_API_KEY` | Resend.com API key | If provider=resend |

### Database

- PostgreSQL via Docker Compose: `docker/docker-compose.yml`
- Commands: `pnpm docker:up`, `pnpm docker:down`, `pnpm docker:logs`
- Default: `postgresql://nexuva:nexuva_secret@localhost:5432/nexuva_os`
- Migrations: `pnpm db:migrate:dev` (runs `prisma migrate dev` in apps/api)
- Studio: `pnpm db:studio`
- **Manual step required after first migration:** run `apps/api/prisma/migrations/manual/partial_unique_indexes.sql`

### Build Process

```bash
pnpm build      # turbo run build — builds all apps and packages
pnpm dev        # turbo run dev — starts all apps in watch mode
pnpm typecheck  # turbo run typecheck
pnpm lint       # turbo run lint
```

### App Ports (Local)

| App | Port | Framework |
|---|---|---|
| API (NestJS) | 4000 | Fastify |
| Admin (Next.js) | 3001 | Next.js 14 App Router |
| Web (Next.js) | 3000 | Next.js 14 App Router |

### Deployment (Not Configured)

No CI/CD pipeline, Dockerfile, Kubernetes manifests, or cloud provider configuration exists. Production deployment strategy is undefined.

---

## 14. Security Review Summary

| Area | Status | Notes |
|---|---|---|
| **Tenant Isolation** | ✅ PASS | All Phase 2 modules enforce ownership chain. `resolveOwnerCompanyId()` covers both company-type and product-type tenants. SUPER_ADMIN bypass is explicit and consistent. |
| **RBAC** | ✅ PASS | Global APP_GUARD (JwtAuthGuard + RolesGuard) on all routes. `hasRoleOrHigher()` enforces hierarchy. `@Public()` is explicit and reviewed. |
| **Authentication** | ✅ PASS | argon2id hashing, JWT access+refresh with rotation, startup secrets validation, soft-delete session revocation, last-SUPER_ADMIN protection. |
| **Privilege Escalation** | ✅ PASS | `assertNoEscalation()` blocks role promotion above actor's level. Self-role-change blocked. |
| **Audit Logging** | ✅ PASS | All mutations in all Phase 2 modules are audit-logged with before/after state. |
| **Public API Safety** | ✅ PASS | Public routes (`@Public()`) are explicitly whitelisted. Public endpoints never expose internal config, private settings, unpublished content, or deleted records. |
| **Storage** | ⚠️ WARNING | `tenantSlug` accepted without ownership verification. No `StorageFile` DB model. Step 12 must resolve. |
| **Database** | ⚠️ WARNING | Partial unique indexes SQL must be applied manually. Page slug reserved after soft delete. Expired refresh tokens accumulate (no cleanup job). |
| **Email** | ⚠️ WARNING | Only Resend provider implemented. SendGrid/SMTP throw `NotImplementedException`. |
| **Permission Matrix** | ⚠️ WARNING | `Permission` records are stored but not enforced at request time. Route-level `@Roles()` is the only active enforcement. |
| **TenantMiddleware Cache** | ℹ️ INFO | 60s in-memory cache. Cache is per-process — multiple API replicas would not share it. Invalidation is available but not triggered by domain updates. |
| **`tenant.locale` field** | ℹ️ INFO | Unsafe cast `as unknown as { locale?: string }` — field doesn't exist in schema. Always falls back to `'tr'`. |

---

## 15. Recommendations Before Step 12

### Must Fix in Step 12

1. **Add `StorageFile` Prisma model** — track every uploaded file with `tenantId`, `key`, `url`, `mimetype`, `size`, `uploadedById`, `createdAt`
2. **Enforce tenant ownership on upload** — validate that caller's `actorCompanyId` owns the tenant identified by `tenantSlug`
3. **Add file delete endpoint** — `DELETE /storage/:id` with ownership check + R2 deletion + audit log
4. **Audit UPLOAD and DELETE actions** — `AuditLogService` must be imported into StorageModule

### Should Fix Soon

5. **Page slug partial unique index** — add SQL migration: `CREATE UNIQUE INDEX pages_active_slug_unique ON pages(tenant_id, slug, locale) WHERE deleted_at IS NULL`
6. **Login rate limit** — apply `@fastify/rate-limit` route-level override (e.g. 5 req/min) to `POST /auth/login`
7. **Expired refresh token cleanup** — add scheduled job or on-login cleanup: `deleteMany({ expiresAt: { lt: new Date() } })`
8. **`Page.currentVersion`** — remove or document clearly that it's a legacy unused field
9. **`tenant.locale`** — add `locale String @default("tr")` to `Tenant` model in schema

### Consider for Phase 3+

10. **ActivityLog + AuditLog controllers** — expose admin-queryable endpoints
11. **Permission enforcement** — implement dynamic `Permission` table lookup in `RolesGuard`
12. **Notification triggers** — wire `NotificationsService.send()` to real events
13. **Multi-instance cache** — replace in-memory TenantService cache with Redis for horizontal scaling
14. **CI/CD pipeline** — Dockerfile, GitHub Actions, deployment targets
