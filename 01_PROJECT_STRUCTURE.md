# 01 — PROJECT STRUCTURE

## Monorepo Layout

```
nexuva-web/                          ← pnpm workspace root
├── apps/
│   ├── api/                         ← NestJS backend (primary)
│   ├── admin/                       ← Next.js admin panel (Phase 4, stub)
│   ├── web/                         ← Next.js public site (Phase 5, stub)
│   └── web-legacy/                  ← React/Vite legacy marketing site
├── packages/
│   ├── shared/                      ← Runtime constants, validators, utils
│   ├── types/                       ← TypeScript type definitions (no runtime)
│   └── ui/                          ← Shared React component library
├── tooling/
│   ├── eslint/                      ← Shared ESLint config
│   ├── prettier/                    ← Shared Prettier config
│   └── typescript/                  ← Shared tsconfig presets
├── docker/
│   ├── docker-compose.yml
│   └── postgres/init.sql
├── package.json                     ← Workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Complete File Inventory

### apps/api — NestJS Backend

```
apps/api/
├── nest-cli.json
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma                          [ACTIVE]
│   └── migrations/
│       └── manual/
│           └── partial_unique_indexes.sql     [ACTIVE — must be applied manually]
└── src/
    ├── main.ts                                [ACTIVE]
    ├── app.module.ts                          [ACTIVE]
    ├── config/
    │   ├── app.config.ts                      [ACTIVE]
    │   ├── database.config.ts                 [ACTIVE]
    │   ├── email.config.ts                    [ACTIVE]
    │   ├── jwt.config.ts                      [ACTIVE]
    │   └── storage.config.ts                  [ACTIVE]
    ├── prisma/
    │   ├── prisma.module.ts                   [ACTIVE]
    │   └── prisma.service.ts                  [ACTIVE]
    ├── common/
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts      [ACTIVE]
    │   │   ├── public.decorator.ts            [ACTIVE]
    │   │   ├── roles.decorator.ts             [ACTIVE]
    │   │   └── tenant.decorator.ts            [ACTIVE — used in middleware but no controller currently uses @Tenant()]
    │   ├── filters/
    │   │   └── http-exception.filter.ts       [ACTIVE]
    │   ├── guards/
    │   │   ├── jwt.guard.ts                   [ACTIVE]
    │   │   └── roles.guard.ts                 [ACTIVE]
    │   ├── interceptors/
    │   │   └── audit.interceptor.ts           [ACTIVE — defined but NOT registered globally in AppModule]
    │   └── middleware/
    │       └── tenant.middleware.ts           [ACTIVE]
    └── modules/
        ├── activity-log/
        │   ├── activity-log.module.ts         [ACTIVE]
        │   └── activity-log.service.ts        [ACTIVE — no controller; internal use only]
        ├── audit-log/
        │   ├── audit-log.module.ts            [ACTIVE]
        │   └── audit-log.service.ts           [ACTIVE — no controller; called by all mutation services]
        ├── auth/
        │   ├── auth.controller.ts             [ACTIVE]
        │   ├── auth.module.ts                 [ACTIVE]
        │   ├── auth.service.ts                [ACTIVE]
        │   ├── dto/
        │   │   ├── login.dto.ts               [ACTIVE]
        │   │   └── refresh.dto.ts             [ACTIVE]
        │   └── strategies/
        │       └── jwt.strategy.ts            [ACTIVE]
        ├── branding/
        │   ├── branding.controller.ts         [ACTIVE]
        │   ├── branding.module.ts             [ACTIVE]
        │   ├── branding.service.ts            [ACTIVE]
        │   └── dto/
        │       └── upsert-branding.dto.ts     [ACTIVE]
        ├── companies/
        │   ├── companies.controller.ts        [ACTIVE]
        │   ├── companies.module.ts            [ACTIVE]
        │   ├── companies.service.ts           [ACTIVE]
        │   └── dto/
        │       ├── create-company.dto.ts      [ACTIVE]
        │       └── update-company.dto.ts      [ACTIVE]
        ├── content-blocks/
        │   ├── content-blocks.controller.ts   [ACTIVE]
        │   ├── content-blocks.module.ts       [ACTIVE]
        │   ├── content-blocks.service.ts      [ACTIVE]
        │   └── dto/
        │       ├── create-content-block.dto.ts [ACTIVE]
        │       ├── reorder-blocks.dto.ts      [ACTIVE]
        │       ├── update-content-block.dto.ts [ACTIVE]
        │       └── visibility.dto.ts          [ACTIVE]
        ├── domains/
        │   ├── domains.controller.ts          [ACTIVE]
        │   ├── domains.module.ts              [ACTIVE]
        │   ├── domains.service.ts             [ACTIVE]
        │   └── dto/
        │       ├── create-domain.dto.ts       [ACTIVE]
        │       └── update-domain.dto.ts       [ACTIVE]
        ├── email/
        │   ├── email.module.ts                [ACTIVE]
        │   └── email.service.ts               [ACTIVE — no controller; internal use only; sendgrid/smtp NOT implemented]
        ├── feature-flags/
        │   ├── feature-flags.controller.ts    [ACTIVE]
        │   ├── feature-flags.module.ts        [ACTIVE]
        │   ├── feature-flags.service.ts       [ACTIVE]
        │   └── dto/
        │       ├── create-feature-flag.dto.ts [ACTIVE]
        │       ├── toggle-flag.dto.ts         [ACTIVE]
        │       └── update-feature-flag.dto.ts [ACTIVE]
        ├── health/
        │   ├── health.controller.ts           [ACTIVE]
        │   └── health.module.ts               [ACTIVE]
        ├── mcp/
        │   ├── mcp.module.ts                  [ACTIVE — registered but McpService is a stub]
        │   ├── mcp.service.ts                 [STUB — no implementation]
        │   └── interfaces/
        │       └── mcp-provider.interface.ts  [ACTIVE — type definitions only]
        ├── notifications/
        │   ├── notifications.controller.ts    [ACTIVE]
        │   ├── notifications.module.ts        [ACTIVE]
        │   └── notifications.service.ts       [ACTIVE]
        ├── pages/
        │   ├── pages.controller.ts            [ACTIVE]
        │   ├── pages.module.ts                [ACTIVE]
        │   ├── pages.service.ts               [ACTIVE]
        │   └── dto/
        │       ├── create-page.dto.ts         [ACTIVE]
        │       └── update-page.dto.ts         [ACTIVE]
        ├── products/
        │   ├── products.controller.ts         [ACTIVE]
        │   ├── products.module.ts             [ACTIVE]
        │   ├── products.service.ts            [ACTIVE]
        │   └── dto/
        │       ├── create-product.dto.ts      [ACTIVE]
        │       └── update-product.dto.ts      [ACTIVE]
        ├── roles/
        │   ├── roles.controller.ts            [ACTIVE]
        │   ├── roles.module.ts                [ACTIVE]
        │   ├── roles.service.ts               [ACTIVE]
        │   └── dto/
        │       └── set-permission.dto.ts      [ACTIVE]
        ├── seo/
        │   ├── seo.controller.ts              [ACTIVE]
        │   ├── seo.module.ts                  [ACTIVE]
        │   ├── seo.service.ts                 [ACTIVE]
        │   └── dto/
        │       └── upsert-seo.dto.ts          [ACTIVE]
        ├── settings/
        │   ├── settings.controller.ts         [ACTIVE]
        │   ├── settings.module.ts             [ACTIVE]
        │   ├── settings.service.ts            [ACTIVE]
        │   └── dto/
        │       ├── create-setting.dto.ts      [ACTIVE]
        │       └── update-setting.dto.ts      [ACTIVE]
        ├── storage/
        │   ├── storage.module.ts              [ACTIVE]
        │   ├── storage.service.ts             [ACTIVE — Cloudflare R2 via AWS S3 SDK]
        │   └── upload.controller.ts           [ACTIVE]
        ├── tenant/
        │   ├── tenant.controller.ts           [ACTIVE]
        │   ├── tenant.module.ts               [ACTIVE]
        │   └── tenant.service.ts              [ACTIVE]
        ├── users/
        │   ├── users.controller.ts            [ACTIVE]
        │   ├── users.module.ts                [ACTIVE]
        │   ├── users.service.ts               [ACTIVE]
        │   └── dto/
        │       ├── assign-role.dto.ts         [ACTIVE]
        │       ├── create-user.dto.ts         [ACTIVE]
        │       └── update-user.dto.ts         [ACTIVE]
        └── versioning/
            ├── versioning.controller.ts       [ACTIVE]
            ├── versioning.module.ts           [ACTIVE]
            ├── versioning.service.ts          [ACTIVE]
            └── dto/
                ├── create-version.dto.ts      [ACTIVE]
                └── rollback.dto.ts            [ACTIVE]
```

### apps/admin — Next.js Admin Panel

```
apps/admin/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── middleware.ts                    [ACTIVE — cookie-based auth guard]
├── lib/
│   └── api.ts                      [ACTIVE — adminFetch() helper]
└── app/
    ├── globals.css                  [ACTIVE]
    ├── (auth)/
    │   ├── layout.tsx               [ACTIVE — unauthenticated layout shell]
    │   └── login/
    │       └── page.tsx             [STUB — "Phase 4 implementation pending"]
    └── (dashboard)/
        ├── layout.tsx               [ACTIVE — authenticated layout shell]
        └── page.tsx                 [STUB — static stat cards, no API calls]
```

### apps/web — Next.js Public Site

```
apps/web/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── middleware.ts                    [ACTIVE — locale detection + redirect]
├── lib/
│   └── api.ts                      [ACTIVE — apiFetch() + resolveTenant()]
└── app/
    ├── globals.css
    └── [locale]/
        ├── layout.tsx               [ACTIVE — locale-aware shell]
        └── page.tsx                 [STUB — "Phase 5 implementation pending"]
```

### apps/web-legacy — React/Vite Legacy Site

```
apps/web-legacy/
├── package.json
├── vite.config.js
├── index.html
├── public/
│   └── assets/                     [SVG banners, logos]
└── src/
    ├── App.jsx                      [ACTIVE]
    ├── main.jsx                     [ACTIVE]
    ├── index.css
    ├── components/
    │   ├── Navbar.jsx               [ACTIVE]
    │   └── Footer.jsx               [ACTIVE]
    └── pages/
        ├── Home.jsx                 [ACTIVE]
        ├── About.jsx                [ACTIVE]
        ├── Services.jsx             [ACTIVE]
        ├── Product.jsx              [ACTIVE]
        ├── CaseStudies.jsx          [ACTIVE]
        └── Contact.jsx              [ACTIVE]
```

### packages/shared

```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     [ACTIVE — re-exports all]
    ├── constants/
    │   ├── enums.ts                 [ACTIVE — TENANT_TYPES, BLOCK_TYPES, FEATURE_FLAG_KEYS, etc.]
    │   └── roles.ts                 [ACTIVE — ROLE_HIERARCHY, hasRoleOrHigher()]
    ├── validators/
    │   └── common.ts               [ACTIVE — zod schemas: slug, cuid, locale, etc.]
    └── utils/
        └── index.ts                [ACTIVE — slugify, omit, pick, isDefined]
```

### packages/types

```
packages/types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     [ACTIVE — re-exports all types]
    ├── enums.ts                     [ACTIVE — UserRole, TenantType, etc.]
    ├── api/
    │   ├── pagination.ts            [ACTIVE]
    │   └── response.ts              [ACTIVE — ApiResponse, ApiError]
    ├── entities/
    │   ├── audit-log.ts             [ACTIVE]
    │   ├── branding.ts              [ACTIVE]
    │   ├── company.ts               [ACTIVE]
    │   ├── content-block.ts         [ACTIVE]
    │   ├── domain.ts                [ACTIVE]
    │   ├── feature-flag.ts          [ACTIVE]
    │   ├── notification.ts          [ACTIVE]
    │   ├── page-version.ts          [ACTIVE]
    │   ├── page.ts                  [ACTIVE]
    │   ├── product.ts               [ACTIVE]
    │   ├── seo.ts                   [ACTIVE]
    │   ├── setting.ts               [ACTIVE]
    │   ├── tenant.ts                [ACTIVE — includes TenantContext]
    │   └── user.ts                  [ACTIVE]
    └── tenant/
        └── context.ts               [ACTIVE — TenantResolutionResult]
```

### packages/ui

```
packages/ui/
├── package.json
├── tailwind.config.ts
└── src/
    ├── index.ts                     [ACTIVE — re-exports components]
    ├── lib/
    │   └── cn.ts                    [ACTIVE — clsx/tailwind-merge helper]
    └── components/
        ├── Badge.tsx                [ACTIVE]
        ├── Button.tsx               [ACTIVE]
        ├── Card.tsx                 [ACTIVE]
        └── Input.tsx                [ACTIVE]
```

### tooling/

```
tooling/
├── eslint/
│   ├── package.json
│   └── index.js                     [ACTIVE — shared ESLint config]
├── prettier/
│   ├── package.json
│   └── index.js                     [ACTIVE — shared Prettier config]
└── typescript/
    ├── base.json                    [ACTIVE]
    ├── nestjs.json                  [ACTIVE]
    └── nextjs.json                  [ACTIVE]
```

### docker/

```
docker/
├── docker-compose.yml               [ACTIVE — postgres:16-alpine, port 5432]
└── postgres/
    └── init.sql                     [ACTIVE — enables pg_trgm, unaccent extensions]
```

---

## Active vs Unused / Stub Summary

| File | Status | Reason |
|---|---|---|
| `mcp/mcp.service.ts` | STUB | No methods implemented. Extension point for AI phase. |
| `common/interceptors/audit.interceptor.ts` | UNUSED | Defined but never registered in AppModule or any module. |
| `common/decorators/tenant.decorator.ts` | PARTIAL | Sets up `@Tenant()` decorator but no controller route currently injects `TenantContext` via it. Middleware sets `req.tenantContext` — controllers use `@CurrentUser()` instead. |
| `admin/app/(auth)/login/page.tsx` | STUB | UI shell only. No form or API call. |
| `admin/app/(dashboard)/page.tsx` | STUB | Static placeholder. No data fetch. |
| `web/app/[locale]/page.tsx` | STUB | One-liner placeholder. |
| `email/email.service.ts` | PARTIAL | `sendViaResend()` implemented. `sendViaSendGrid()` and `sendViaSMTP()` throw `NotImplementedException`. |
| `apps/web-legacy/` | ACTIVE but isolated | Standalone Vite/React app. Not part of the NestJS/Next.js platform. |

---

## Module Import Graph

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global)            ← provides PrismaService to all modules
├── TenantModule
│   └── exports: TenantService
├── AuthModule
│   ├── PassportModule
│   ├── JwtModule
│   └── exports: AuthService
│       └── JwtStrategy (uses UsersService — cross-module injection via UsersModule)
├── UsersModule
│   ├── AuditLogModule
│   └── exports: UsersService
├── RolesModule
│   └── AuditLogModule
├── CompaniesModule
│   └── AuditLogModule
├── ProductsModule
│   └── AuditLogModule
├── DomainsModule
│   └── AuditLogModule
├── PagesModule
│   ├── AuditLogModule
│   └── VersioningModule
│       └── AuditLogModule
├── ContentBlocksModule
│   ├── AuditLogModule
│   └── VersioningModule
├── SeoModule
│   └── AuditLogModule
├── BrandingModule
│   └── AuditLogModule
├── FeatureFlagsModule
│   └── AuditLogModule
├── SettingsModule
│   └── AuditLogModule
├── StorageModule
├── NotificationsModule
├── EmailModule
├── AuditLogModule
│   └── exports: AuditLogService
├── ActivityLogModule
│   └── exports: ActivityLogService
├── HealthModule
└── McpModule
```

### Global Providers (registered via APP_GUARD)

```
AppModule.providers
├── { provide: APP_GUARD, useClass: JwtAuthGuard }   ← runs on every request
└── { provide: APP_GUARD, useClass: RolesGuard }     ← runs after JwtAuthGuard
```

### Global Middleware (via NestModule.configure)

```
AppModule.configure
└── TenantMiddleware → applied to '*' (all routes)
```

---

## Package Dependency Graph (workspace)

```
apps/api
├── @nexuva/types       ← type definitions
└── @nexuva/shared      ← ROLE_HIERARCHY, hasRoleOrHigher, enums, validators, utils

apps/admin
├── @nexuva/types
├── @nexuva/shared
└── @nexuva/ui          ← Button, Card, Input, Badge

apps/web
├── @nexuva/types
├── @nexuva/shared
└── @nexuva/ui

packages/shared
└── @nexuva/types       ← imports UserRole type

packages/ui
└── (no nexuva workspace deps)
```

---

## Environment Variables Required

| Variable | Used By | Notes |
|---|---|---|
| `DATABASE_URL` | PrismaService | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | AuthService, JwtStrategy | Required at startup — process exits if missing |
| `JWT_REFRESH_SECRET` | AuthService | Required at startup — process exits if missing |
| `JWT_ACCESS_EXPIRY` | AuthModule | Default: `15m` |
| `JWT_REFRESH_EXPIRY` | AuthService | Default: `7d` |
| `API_PORT` | main.ts | Default: `4000` |
| `API_PREFIX` | main.ts | Default: `api/v1` |
| `CORS_ORIGINS` | main.ts | Comma-separated. Empty = CORS disabled |
| `NODE_ENV` | Multiple | `development` enables Swagger, query logging |
| `R2_ACCOUNT_ID` | StorageService | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | StorageService | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | StorageService | Cloudflare R2 |
| `R2_BUCKET_NAME` | StorageService | Default: `nexuva-os` |
| `R2_PUBLIC_URL` | StorageService | Public CDN base URL |
| `EMAIL_PROVIDER` | EmailService | `resend` \| `sendgrid` \| `smtp` |
| `EMAIL_FROM` | EmailService | Default: `noreply@nexuva.com` |
| `EMAIL_FROM_NAME` | EmailService | Default: `Nexuva OS` |
| `RESEND_API_KEY` | EmailService | Required if provider=resend |
| `NEXT_PUBLIC_ADMIN_API_URL` | admin/lib/api.ts | Default: `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_API_URL` | web/lib/api.ts | Default: `http://localhost:4000/api/v1` |

---

## Swagger / OpenAPI

- Available at: `GET /api/v1/docs` (only when `NODE_ENV !== 'production'`)
- Auth: Bearer token (JWT access token)
- Tags: `auth`, `tenant`, `companies`, `products`, `domains`, `pages`, `content-blocks`, `versioning`, `seo`, `branding`, `feature-flags`, `settings`, `notifications`, `storage`, `roles`, `health`
