# 03 — AUTH & SECURITY

---

## Authentication System Overview

The API uses a dual-token JWT authentication system:
- **Access Token**: Short-lived (default 15m), signed with `JWT_ACCESS_SECRET`, sent as Bearer token in Authorization header
- **Refresh Token**: Long-lived (default 7d), signed with `JWT_REFRESH_SECRET`, stored as argon2 hash in the `refresh_tokens` table, rotated on every use

Password hashing: argon2 (via `argon2` npm package)

---

## Files

### `apps/api/src/modules/auth/auth.controller.ts`

**Purpose**: Exposes HTTP endpoints for login, token refresh, logout, and current-user fetch.

**Imports**:
- `AuthService` — all business logic
- `LoginDto`, `RefreshDto` — request body validation
- `@Public()` — skips JWT guard on login and refresh
- `@CurrentUser()` — extracts authenticated user from request

**Routes**:

#### POST /api/v1/auth/login
- Decorator: `@Public()` — no JWT required
- DTO: `LoginDto { email: string (email), password: string (min 8) }`
- Calls: `AuthService.login(dto)`
- Returns: `{ accessToken, refreshToken, user: { id, email, firstName, lastName, role } }`

#### POST /api/v1/auth/refresh
- Decorator: `@Public()` — no JWT required
- DTO: `RefreshDto { refreshToken: string }`
- Calls: `AuthService.refresh(dto)`
- Returns: `{ accessToken, refreshToken }`

#### POST /api/v1/auth/logout
- Auth: JWT required
- No body
- Calls: `AuthService.logout(user.id)`
- Returns: 204 No Content

#### GET /api/v1/auth/me
- Auth: JWT required
- No body
- Returns: `{ success: true, data: { id, email, role } }` — user from JWT strategy validate()

---

### `apps/api/src/modules/auth/auth.service.ts`

**Purpose**: All authentication business logic. Password verification, token signing, token rotation, session revocation.

**Dependencies**:
- `PrismaService` — DB queries
- `JwtService` (NestJS) — token sign/verify
- `ConfigService` — JWT secrets and expiry config
- `argon2` (npm) — password hash verify and token hash

**Public Methods**:

#### `login(dto: LoginDto)`
1. `prisma.user.findUnique({ where: { email } })` — find user
2. Check: `user.isActive` and `user.deletedAt === null` — else throw 401
3. `argon2.verify(user.passwordHash, dto.password)` — verify password
4. `prisma.user.update({ lastLoginAt: new Date() })` — update last login
5. Build JWT payload: `{ sub: user.id, email, role }`
6. Call `signTokenPair(payload, user.id)` — returns `{ accessToken, refreshToken }`
7. Return tokens + user object (never includes passwordHash)

#### `refresh(dto: RefreshDto)`
1. `jwt.verify(dto.refreshToken, { secret: refreshSecret })` — verify signature and expiry
2. Find stored token: `prisma.refreshToken.findFirst({ where: { userId, isRevoked: false, expiresAt: { gt: now } } })`
3. `argon2.verify(stored.tokenHash, dto.refreshToken)` — verify hash matches
4. `prisma.refreshToken.update({ isRevoked: true })` — revoke current token (rotation)
5. `prisma.user.findUnique({ id: payload.sub })` — re-validate user is still active
6. Call `signTokenPair(newPayload, userId)` — issue fresh pair
7. Return `{ accessToken, refreshToken }`

**Critical Bug in `refresh()`**: Step 2 calls `argon2.hash(dto.refreshToken)` before the `findFirst` query but the hash is not used in the query — the query filters only by `userId`, `isRevoked`, and `expiresAt`. The actual hash comparison happens in step 3 via `argon2.verify`. The `tokenHash` variable computed at step 2 is unused. This means the `findFirst` can return ANY non-revoked token for that user, not specifically the one matching the submitted token. This is a correctness issue when a user has multiple active sessions — the wrong token could be picked and rotated.

#### `logout(userId: string)`
1. `prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })` — revokes ALL active tokens for user

#### `hashPassword(password: string)`
- `argon2.hash(password)` — public helper used by UsersController before calling UsersService.create()

#### `signTokenPair(payload, userId)` — private
1. Signs access token: `jwt.sign(payload, { secret: accessSecret, expiresIn: accessExpiry })`
2. Signs refresh token: `jwt.sign(payload, { secret: refreshSecret, expiresIn: refreshExpiry })`
3. `argon2.hash(refreshToken)` — hash the refresh token
4. `prisma.refreshToken.create({ userId, tokenHash, expiresAt: now + 7d })` — store hashed token
5. Returns `{ accessToken, refreshToken }`

Note: `expiresAt` is hardcoded as `Date.now() + 7 * 24 * 60 * 60 * 1000` regardless of `JWT_REFRESH_EXPIRY` config value. If the config is changed to a different duration, the DB expiry and the JWT expiry will diverge.

---

### `apps/api/src/modules/auth/auth.module.ts`

**Purpose**: NestJS module configuration for the auth domain.

**Imports**:
- `PassportModule.register({ defaultStrategy: 'jwt' })`
- `JwtModule.registerAsync(...)` — configured with `jwt.accessSecret` and `jwt.accessExpiry` from ConfigService

**Providers**: `AuthService`, `JwtStrategy`

**Controllers**: `AuthController`

**Exports**: `AuthService`

Note: `AuthModule` does NOT import `UsersModule`. However, `JwtStrategy` injects `UsersService`. This creates a cross-module dependency that must be resolved by NestJS's DI container. This works because `UsersModule` exports `UsersService` and `AppModule` imports both, but it is an implicit dependency — `AuthModule` does not declare it in its `imports` array.

---

### `apps/api/src/modules/auth/strategies/jwt.strategy.ts`

**Purpose**: Passport JWT strategy. Validates every incoming Bearer token against the access token secret and loads the full user object from DB.

**Dependencies**:
- `ConfigService` — reads `jwt.accessSecret`
- `UsersService` — calls `findById()` to load user

**Configuration**:
```
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
ignoreExpiration: false
secretOrKey: config.get('jwt.accessSecret')
```

**`validate(payload: JwtPayload)`**:
1. `usersService.findById(payload.sub)` — fetch user from DB on every authenticated request
2. Check `user.isActive` — throws 401 if user is deactivated
3. Returns user object — this becomes `request.user` in all downstream handlers

Performance note: Every authenticated request triggers a DB query to load the user. There is no in-memory cache or session layer. For high-traffic scenarios this is a scalability consideration.

---

### `apps/api/src/modules/auth/dto/login.dto.ts`

```typescript
class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

---

### `apps/api/src/modules/auth/dto/refresh.dto.ts`

```typescript
class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

---

## Guards

### `apps/api/src/common/guards/jwt.guard.ts`

**Purpose**: Global JWT authentication guard. Runs on every request. Routes decorated with `@Public()` bypass it.

**Extends**: `AuthGuard('jwt')` from `@nestjs/passport`

**`canActivate(context)`**:
1. Reads `IS_PUBLIC_KEY` metadata from handler and class via `Reflector.getAllAndOverride()`
2. If `isPublic === true` → returns `true` immediately (no auth check)
3. Otherwise → calls `super.canActivate(context)` which invokes `JwtStrategy.validate()`

**Registered as**: `{ provide: APP_GUARD, useClass: JwtAuthGuard }` in `AppModule` — global scope

---

### `apps/api/src/common/guards/roles.guard.ts`

**Purpose**: Role-based access control guard. Runs after `JwtAuthGuard`. Checks that the authenticated user's role meets or exceeds the minimum role specified by `@Roles()`.

**`canActivate(context)`**:
1. Reads `ROLES_KEY` metadata from handler and class via `Reflector.getAllAndOverride()`
2. If no roles defined → returns `true` (route is accessible to any authenticated user)
3. Reads `request.user.role` from the request (populated by JwtStrategy)
4. Calls `hasRoleOrHigher(user.role, requiredRole)` for each role in the decorator
5. If any match → returns `true`. Otherwise throws `ForbiddenException('Insufficient permissions')`

**`hasRoleOrHigher(userRole, requiredRole)`** (from `@nexuva/shared`):
```typescript
ROLE_HIERARCHY = { SUPER_ADMIN: 100, ADMIN: 80, PRODUCT_MANAGER: 60, CONTENT_EDITOR: 40, VIEWER: 20 }
return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
```

So `@Roles('CONTENT_EDITOR')` allows: CONTENT_EDITOR (40), PRODUCT_MANAGER (60), ADMIN (80), SUPER_ADMIN (100).

**Registered as**: `{ provide: APP_GUARD, useClass: RolesGuard }` in `AppModule` — global scope

---

## Decorators

### `apps/api/src/common/decorators/public.decorator.ts`

```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Used on routes that should skip authentication entirely:
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /pages/public/:tenantId/:locale/:slug`
- `GET /feature-flags/check/:tenantId/:key`
- `GET /settings/public/:tenantId`
- `GET /seo/page/:pageId/public`
- `GET /tenant/resolve`
- `GET /health`

---

### `apps/api/src/common/decorators/roles.decorator.ts`

```typescript
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

Sets the minimum required role. `RolesGuard` allows access if `user.role >= min(roles)` by hierarchy weight.

---

### `apps/api/src/common/decorators/current-user.decorator.ts`

```typescript
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  }
);
```

Usage:
- `@CurrentUser()` → full user object
- `@CurrentUser('id')` → just the user ID (used in NotificationsController)

---

### `apps/api/src/common/decorators/tenant.decorator.ts`

```typescript
export const Tenant = createParamDecorator(
  (_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext;
  }
);
```

Extracts `TenantContext` from `request.tenantContext` which is populated by `TenantMiddleware`. Currently not used in any controller route handler — all controllers use `@CurrentUser()` instead. The tenant context is available on the request object but no controller injects it via this decorator.

---

## Middleware

### `apps/api/src/common/middleware/tenant.middleware.ts`

**Purpose**: Resolves the Tenant from the incoming request's `Host` header. Applied globally to all routes.

**Registered in**: `AppModule.configure(consumer)` → `consumer.apply(TenantMiddleware).forRoutes('*')`

**Execution Flow**:
1. Extract `host` from `req.headers.host` (e.g. `nexuva.com:4000`)
2. Strip port: take only the part before `:` → `nexuva.com`
3. Call `TenantService.resolveFromDomain(domain)` — hits in-memory cache first, then DB
4. If not found: set `req.tenantContext = null`, call `next()` — does NOT throw
5. If REDIRECT domain: call `res.redirect(redirectTo, 301)` and return (no next())
6. Otherwise: set `req.tenantContext = result.context`, call `next()`

**Key Behavior**: The middleware never throws. A missing tenant sets `req.tenantContext = null` and continues. This means all API routes work even without a valid tenant domain in the Host header — the tenant context is simply null. Controllers that need tenant isolation must enforce it themselves or rely on `@CurrentUser().companyId`.

---

## Tenant Resolution

### `apps/api/src/modules/tenant/tenant.service.ts`

**In-memory cache**: `Map<string, CacheEntry>` with 60-second TTL per domain.

**`resolveFromDomain(domain: string)`**:
1. Check cache — if hit and not expired, return cached context
2. `prisma.domain.findFirst({ where: { domainName: domain, isActive: true }, include: { tenant: { include: { branding, featureFlags, domains } } } })`
3. If not found → `{ found: false, context: null }`
4. If type === REDIRECT and has `redirectTo` → build redirect context and cache it
5. If type === REDIRECT but no `redirectTo` → `{ found: false, context: null }`
6. Build flag map: merge global flags (tenantId=null) with tenant-specific flags (tenant-specific overrides global)
7. Build and cache `TenantContext`: `{ tenantId, slug, type, name, primaryDomain, branding, locale, featureFlags }`

**`invalidateCache(domain?)`**:
- If domain provided: `cache.delete(domain)`
- If not: `cache.clear()`
- Called by: nothing in current codebase — no automatic cache invalidation on domain/tenant updates

---

## Ownership Check Pattern

The ownership check pattern is the core security mechanism below the role level. It appears in every service that handles tenant-scoped resources.

### Pattern Structure

All services implement a private `assertXxxOwnership()` method that:
1. Loads the resource from DB (with tenant relation included)
2. If actor is `SUPER_ADMIN`: returns immediately (bypass)
3. Resolves `ownerCompanyId` from the tenant chain: `tenant.company?.id ?? tenant.product?.companyId ?? null`
4. If `ownerCompanyId !== actor.companyId`: throw `ForbiddenException`

### Ownership Chain

```
Resource → Tenant → Company (direct)
                  OR
Resource → Tenant → Product → Company (via companyId)
```

The `resolveOwnerCompanyId()` helper is duplicated in every service that performs ownership checks:
- `pages.service.ts`
- `content-blocks.service.ts`
- `versioning.service.ts`
- `branding.service.ts`
- `domains.service.ts`
- `feature-flags.service.ts`
- `settings.service.ts`
- `seo.service.ts`
- `companies.service.ts`
- `products.service.ts`

**Technical Debt**: This helper is copy-pasted across 10 files. It is not extracted into a shared utility. See `08_TECHNICAL_DEBT_AND_BACKLOG.md`.

---

## Security Map — Files Containing Security Logic

### JwtAuthGuard
`src/common/guards/jwt.guard.ts`

### RolesGuard
`src/common/guards/roles.guard.ts`

### @Public() — bypasses JwtAuthGuard
`src/common/decorators/public.decorator.ts`
Applied in: `auth.controller.ts`, `pages.controller.ts`, `feature-flags.controller.ts`, `settings.controller.ts`, `seo.controller.ts`, `tenant.controller.ts`, `health.controller.ts`

### @Roles() — sets minimum role
`src/common/decorators/roles.decorator.ts`
Applied in: all controllers except `notifications.controller.ts` (no @Roles, any authenticated user)

### @CurrentUser() — user extraction
`src/common/decorators/current-user.decorator.ts`

### Ownership Checks (assertXxxOwnership / assertPageOwnership / etc.)
| File | Ownership Method |
|---|---|
| `pages.service.ts` | `assertTenantOwnership()`, `assertPageOwnership()` |
| `content-blocks.service.ts` | `assertPageOwnership()`, `assertBlockOwnership()` |
| `versioning.service.ts` | `assertPageOwnership()`, `assertVersionOwnership()` |
| `branding.service.ts` | `assertTenantOwnership()` |
| `domains.service.ts` | `assertTenantOwnership()`, `assertDomainOwnership()` |
| `feature-flags.service.ts` | `assertTenantOwnership()`, `assertFeatureFlagOwnership()` |
| `settings.service.ts` | `assertTenantOwnership()`, `assertSettingOwnership()` |
| `seo.service.ts` | `assertPageOwnership()` |
| `companies.service.ts` | inline check in `findById()` and `update()` |
| `products.service.ts` | inline check in `findById()` |
| `users.service.ts` | `assertNoEscalation()`, `assertCompanyOwnership()` |

### Tenant Middleware
`src/common/middleware/tenant.middleware.ts`

### JWT Strategy (per-request user load)
`src/modules/auth/strategies/jwt.strategy.ts`

---

## Token Lifecycle

```
LOGIN
  User submits email + password
    → argon2.verify(hash, password)
    → if valid: signTokenPair()
        → jwt.sign(payload, accessSecret, 15m) → accessToken
        → jwt.sign(payload, refreshSecret, 7d) → refreshToken
        → argon2.hash(refreshToken) → tokenHash
        → prisma.refreshToken.create({ tokenHash, expiresAt })
    → return { accessToken, refreshToken }

AUTHENTICATED REQUEST
  Client sends: Authorization: Bearer <accessToken>
    → JwtAuthGuard intercepts
    → passport-jwt verifies signature and expiry against accessSecret
    → JwtStrategy.validate(payload)
        → prisma.user.findUnique(payload.sub)
        → checks isActive
        → attaches user to request

ACCESS TOKEN EXPIRY (15m)
  Client sends refreshToken to POST /auth/refresh
    → jwt.verify(refreshToken, refreshSecret) — checks signature + expiry
    → prisma.refreshToken.findFirst({ userId, isRevoked: false, expiresAt > now })
    → argon2.verify(stored.tokenHash, refreshToken) — verify hash
    → prisma.refreshToken.update({ isRevoked: true }) — revoke old
    → signTokenPair() — issue new pair
    → return { accessToken, refreshToken }

LOGOUT
  POST /auth/logout (authenticated)
    → prisma.refreshToken.updateMany({ userId, isRevoked: false }) → all revoked

USER DELETION
  DELETE /users/:id (SUPER_ADMIN)
    → prisma.refreshToken.updateMany({ userId }) → all revoked
    → user.deletedAt = now, isActive = false
```

---

## Startup Security

In `apps/api/src/main.ts`:

```typescript
const accessSecret = process.env['JWT_ACCESS_SECRET'];
const refreshSecret = process.env['JWT_REFRESH_SECRET'];
if (!accessSecret || !refreshSecret) {
  console.error('FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set.');
  process.exit(1);
}
```

The API refuses to start if JWT secrets are missing. This prevents unsigned tokens.

---

## Rate Limiting

Registered in `main.ts` via `@fastify/rate-limit`:
- Global limit: 100 requests per minute per IP
- No per-route override is currently configured (despite the comment suggesting the login endpoint has a tighter limit — it does not in the current code)

---

## Input Validation

Global `ValidationPipe` in `main.ts`:
```typescript
new ValidationPipe({
  whitelist: true,           // strips unknown properties
  forbidNonWhitelisted: true, // throws 400 on unknown properties
  transform: true,           // auto-transforms types (string→number, etc.)
  transformOptions: { enableImplicitConversion: true }
})
```

All DTOs use `class-validator` decorators. Unknown fields sent to any endpoint are rejected with a 400.

---

## CORS

```typescript
app.enableCors({
  origin: corsOrigins.length > 0 ? corsOrigins : false,
  credentials: true,
})
```

Origins from `CORS_ORIGINS` env var (comma-separated). If env is empty, CORS is fully disabled (`origin: false`).

---

## Content Security

### Content Block Size
`content-blocks.service.ts`: Max 100 KB per block content payload:
```typescript
const MAX_CONTENT_BYTES = 100 * 1024;
const size = Buffer.byteLength(JSON.stringify(content), 'utf8');
if (size > MAX_CONTENT_BYTES) throw new BadRequestException(...)
```

### Feature Flag Config Size
`feature-flags.service.ts`: Max 10 KB:
```typescript
const MAX_CONFIG_BYTES = 10 * 1024;
```

### Setting Value Size
`settings.service.ts`: Max 100 KB:
```typescript
const MAX_VALUE_BYTES = 100 * 1024;
```

### File Upload
`upload.controller.ts`: Allowed MIME types enforced at controller level:
```
image/jpeg, image/png, image/webp, image/gif, image/svg+xml, application/pdf
```
Max file size: 10 MB (also enforced by `@fastify/multipart` global limit).

---

## Error Handling

### `apps/api/src/common/filters/http-exception.filter.ts`

Global `@Catch()` filter registered in `main.ts`.

Response shape for all errors:
```typescript
interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;  // populated for validation failures
  timestamp: string;
  path: string;
}
```

For validation failures (400 from ValidationPipe):
- `message` → `"Validation failed"`
- `errors` → `{ validation: string[] }` with the array of validation messages

For unknown errors (non-HttpException): logs `exception.message` and stack via `Logger.error()`, returns 500.

---

## Privilege Escalation Prevention

In `users.service.ts`:

```typescript
private assertNoEscalation(actorRole: UserRole, targetRole: UserRole): void {
  if (ROLE_HIERARCHY[targetRole] > ROLE_HIERARCHY[actorRole]) {
    throw new ForbiddenException(`You cannot assign a role higher than your own (${actorRole})`);
  }
}
```

Called in:
- `create()` — before creating a user with a given role
- `update()` — before updating a user's role
- `assignRole()` — before assigning a role directly

### Last SUPER_ADMIN Protection

Both `update()`, `assignRole()`, and `softDelete()` check:
```typescript
const count = await prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true } });
if (count <= 1) throw new BadRequestException('Cannot demote/delete the last active SUPER_ADMIN');
```

### Self-Action Prevention

- `update()`: Actor cannot change their own `role` or `isActive`
- `assignRole()`: Actor cannot change their own role
- `softDelete()`: Actor cannot delete themselves
