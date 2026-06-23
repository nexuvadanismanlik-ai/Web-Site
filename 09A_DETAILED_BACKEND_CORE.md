# 09A — DETAILED BACKEND CORE
## Auth, App Bootstrap, Guards, Middleware, Users, Roles

---

# APPLICATION BOOTSTRAP

## Folder Tree

```
apps/api/src/
├── main.ts
├── app.module.ts
└── common/
    ├── decorators/
    │   ├── current-user.decorator.ts
    │   ├── public.decorator.ts
    │   ├── roles.decorator.ts
    │   └── tenant-context.decorator.ts
    ├── filters/
    │   └── http-exception.filter.ts
    ├── guards/
    │   ├── jwt.guard.ts
    │   └── roles.guard.ts
    ├── interceptors/
    │   └── audit.interceptor.ts
    └── middleware/
        └── tenant.middleware.ts
```

---

## File Details

### `main.ts`

**Location**: `apps/api/src/main.ts`

**Purpose**: NestJS application entry point. Bootstraps a `NestFastifyApplication` (Fastify adapter, not Express). Registers global middleware plugins, pipes, filters, and Swagger documentation. Validates required secrets before starting. Binds to `0.0.0.0` on the configured port.

**Imports**:
```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
```

**Exports**: None (entry point, not imported by anything)

**Who calls this file**: Node.js runtime via `pnpm start` / `ts-node`

**Which files this file calls**:
- `AppModule` — the root module
- `HttpExceptionFilter` — global exception filter

**Database models used**: None directly

**API routes connected**: None directly — sets global prefix `api/v1`

**Security implications**:
- `process.exit(1)` if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are missing — prevents running without auth secrets
- CORS enabled (origins from `CORS_ORIGIN` env or `*` if unset — potential misconfiguration)
- Rate limiting: 100 requests per minute per IP via `@fastify/rate-limit`
- File upload limit: 10MB per file, 5 files max via `@fastify/multipart`
- `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` — strips unknown DTO fields

**Bootstrap sequence**:
```
1. NestFactory.create(AppModule, new FastifyAdapter())
2. app.register(fastifyMultipart, { limits: { fileSize: 10MB, files: 5 } })
3. app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' })
4. app.setGlobalPrefix('api/v1')
5. app.enableVersioning({ type: URI })
6. app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*' })
7. app.useGlobalPipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))
8. app.useGlobalFilters(new HttpExceptionFilter())
9. if (NODE_ENV !== 'production') → SwaggerModule.setup('api/v1/docs', app, document)
10. await app.listen(PORT, '0.0.0.0')
```

**Environment variables read**:
- `JWT_ACCESS_SECRET` — required, exits if missing
- `JWT_REFRESH_SECRET` — required, exits if missing
- `CORS_ORIGIN` — optional, defaults to `*`
- `PORT` — optional, defaults to `3000`
- `NODE_ENV` — controls whether Swagger is enabled

---

### `app.module.ts`

**Location**: `apps/api/src/app.module.ts`

**Purpose**: Root NestJS module. Declares all feature modules, registers global guards via `APP_GUARD` tokens, and applies `TenantMiddleware` to all routes.

**Imports**:
```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
// Feature modules:
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProductsModule } from './modules/products/products.module';
import { DomainsModule } from './modules/domains/domains.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PagesModule } from './modules/pages/pages.module';
import { ContentBlocksModule } from './modules/content-blocks/content-blocks.module';
import { SeoModule } from './modules/seo/seo.module';
import { BrandingModule } from './modules/branding/branding.module';
import { VersioningModule } from './modules/versioning/versioning.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { McpModule } from './modules/mcp/mcp.module';
import { PrismaModule } from './prisma/prisma.module';
```

**Exports**: Nothing (root module)

**Who calls this file**: `main.ts`

**Which files this file calls**: All 21 modules listed in imports above

**Database models used**: None directly

**Security implications**:
- `APP_GUARD` with `JwtAuthGuard` → every route requires authentication unless `@Public()` is set
- `APP_GUARD` with `RolesGuard` → every route enforces role requirements
- Guard execution order: `JwtAuthGuard` runs first, then `RolesGuard`
- `TenantMiddleware` applied with `consumer.apply(TenantMiddleware).forRoutes('*')` — runs on all routes before guards

**Provider array (global guards)**:
```typescript
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

**Module import order**: NestJS resolves modules by dependency graph, not declaration order. `PrismaModule` is available globally because it is imported by each feature module independently.

---

## MODULE: Auth

### Folder Tree

```
apps/api/src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
└── strategies/
    ├── jwt.strategy.ts
    └── jwt-refresh.strategy.ts
apps/api/src/modules/auth/dto/
├── login.dto.ts
└── refresh-token.dto.ts
```

---

### `auth.module.ts`

**Location**: `apps/api/src/modules/auth/auth.module.ts`

**Purpose**: Configures JWT authentication. Registers `JwtModule` asynchronously from environment config. Declares `AuthController` and `AuthService`. Imports `UsersModule` for user lookup during auth flows.

**Imports**:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuditLogModule } from '../audit-log/audit-log.module';
```

**JwtModule configuration**:
```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_ACCESS_SECRET'),
    signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRY', '15m') },
  }),
})
```

**Exports**: `AuthService` (not explicitly exported — auth is self-contained)

**Who calls this file**: `AppModule`

**Which files this file calls**: `UsersModule`, `AuditLogModule`

---

### `auth.controller.ts`

**Location**: `apps/api/src/modules/auth/auth.controller.ts`

**Purpose**: Exposes HTTP endpoints for login, token refresh, and logout.

**Imports**:
```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
```

**Exports**: `AuthController` class

**Routes**:

#### `POST /auth/login`
- Decorator: `@Public()` — no JWT required
- Body: `LoginDto { email: string, password: string }`
- Calls: `AuthService.login(dto)`
- Returns: `{ accessToken: string, refreshToken: string, user: UserShape }`
- HTTP Status: 200

#### `POST /auth/refresh`
- Decorator: `@Public()` — accepts expired access tokens (uses separate refresh logic)
- Body: `RefreshTokenDto { refreshToken: string }`
- Calls: `AuthService.refresh(dto)`
- Returns: `{ accessToken: string, refreshToken: string }`
- HTTP Status: 200

#### `POST /auth/logout`
- Authenticated: YES (no `@Public()`)
- No body
- `@CurrentUser() user` → extracts user from JWT payload set by JwtStrategy
- Calls: `AuthService.logout(user.id)`
- Returns: `{ message: 'Logged out' }`
- HTTP Status: 200

**Security implications**:
- Login and refresh are `@Public()` — accessible without authentication
- Logout requires a valid JWT — prevents logout spam from unauthenticated clients
- No CSRF protection (Fastify does not add CSRF headers by default)

---

### `auth.service.ts`

**Location**: `apps/api/src/modules/auth/auth.service.ts`

**Purpose**: Core authentication logic — login, token pair generation, refresh, and logout. Handles argon2 hashing, JWT signing, and refresh token management in the database.

**Imports**:
```typescript
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
```

**Exports**: `AuthService` class

**Who calls this file**: `AuthController`, `JwtStrategy` (via `UsersService` — indirect)

**Which files this file calls**:
- `PrismaService` — RefreshToken CRUD
- `UsersService` — user lookup by email
- `JwtService` — token signing
- `ConfigService` — reads JWT secrets and expiry settings
- `AuditLogService` — logs LOGIN, LOGOUT, REFRESH_TOKEN events
- `argon2` — password verification and refresh token hashing

**Database models used**:
- `User` — read (find by email, update lastLoginAt)
- `RefreshToken` — create, read, update (revoke), deleteMany

---

#### Method: `login(dto: LoginDto)`

**Input**: `{ email: string, password: string }`

**Output**: `{ accessToken: string, refreshToken: string, user: SafeUser }`

**Calls**:
1. `prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } })`
2. If not found → `UnauthorizedException('Invalid credentials')`
3. `argon2.verify(user.passwordHash, dto.password)` — constant-time comparison
4. If false → `UnauthorizedException('Invalid credentials')`
5. `prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } })`
6. `this.signTokenPair(user)` → produces `{ accessToken, refreshToken }`
7. `auditLog.log({ action: 'LOGIN', resource: 'user', resourceId: user.id, actorId: user.id })`
8. Returns `{ accessToken, refreshToken, user: omit(user, ['passwordHash']) }`

**Prisma queries**:
```typescript
prisma.user.findFirst({ where: { email, deletedAt: null } })
prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } })
```

**Security implications**:
- Uses same error message for "user not found" and "wrong password" — prevents user enumeration
- argon2 verification is timing-safe
- `deletedAt: null` ensures soft-deleted users cannot log in

---

#### Method: `refresh(dto: RefreshTokenDto)`

**Input**: `{ refreshToken: string }` — the raw refresh token JWT

**Output**: `{ accessToken: string, refreshToken: string }`

**Calls**:
1. `this.jwtService.verify(dto.refreshToken, { secret: config.get('JWT_REFRESH_SECRET') })` — verifies signature and expiry
2. If invalid → `UnauthorizedException`
3. `const payload = this.jwtService.decode(dto.refreshToken)` — extract `sub` (userId)
4. `prisma.refreshToken.findFirst({ where: { userId: payload.sub, isRevoked: false } })`
5. If not found → `UnauthorizedException('Refresh token not found or revoked')`
6. `argon2.verify(storedToken.tokenHash, dto.refreshToken)` — verifies this exact token (not a different active token for the same user)
7. If verification fails → `UnauthorizedException`
8. `prisma.refreshToken.update({ where: { id: storedToken.id }, data: { isRevoked: true } })` — revoke old token (rotation)
9. Load user: `prisma.user.findUnique({ where: { id: payload.sub } })`
10. `this.signTokenPair(user)` — issues new pair
11. `auditLog.log({ action: 'REFRESH_TOKEN', resource: 'user', resourceId: user.id })`

**Known issue**: Step 4 finds ANY non-revoked token for the user, not necessarily the one matching `dto.refreshToken`. Step 6 then verifies the hash. If a user has multiple concurrent sessions, `findFirst` might return a token from a different session, causing argon2 to fail for the valid token. The correct approach is `findFirst({ where: { userId, isRevoked: false, expiresAt: { gt: now } } })` combined with comparing hashes of each token until a match is found.

**Prisma queries**:
```typescript
prisma.refreshToken.findFirst({ where: { userId: payload.sub, isRevoked: false } })
prisma.refreshToken.update({ where: { id }, data: { isRevoked: true } })
prisma.user.findUnique({ where: { id: payload.sub } })
```

---

#### Method: `logout(userId: string)`

**Input**: `userId: string` — from JWT payload via `@CurrentUser()`

**Output**: `{ message: 'Logged out' }`

**Calls**:
1. `prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })` — revokes ALL active sessions for this user
2. `auditLog.log({ action: 'LOGOUT', resource: 'user', resourceId: userId, actorId: userId })`

**Prisma queries**:
```typescript
prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })
```

**Security implications**: Logout is a global session revocation — all devices are logged out simultaneously. There is no "logout only this device" capability.

---

#### Method: `signTokenPair(user)` — private

**Input**: User object (with id, email, role, companyId, tenantId)

**Output**: `{ accessToken: string, refreshToken: string }`

**Calls**:
1. Build access token payload: `{ sub: user.id, email: user.email, role: user.role, companyId: user.companyId }`
2. `this.jwtService.sign(accessPayload)` — uses `JWT_ACCESS_SECRET`, expiry from `JWT_ACCESS_EXPIRY` config
3. Build refresh token payload: `{ sub: user.id, type: 'refresh' }`
4. `this.jwtService.sign(refreshPayload, { secret: JWT_REFRESH_SECRET, expiresIn: JWT_REFRESH_EXPIRY })`
5. `argon2.hash(rawRefreshToken)` — hash the token for storage
6. Compute `expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7)` ← **HARDCODED 7 days**
7. `prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt, isRevoked: false } })`

**Known issue**: `expiresAt` is always 7 days regardless of `JWT_REFRESH_EXPIRY` value. See DEBT-003 in technical debt report.

**Prisma queries**:
```typescript
prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt, isRevoked: false } })
```

---

### `strategies/jwt.strategy.ts`

**Location**: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`

**Purpose**: Passport JWT strategy. Validates every incoming Bearer token. Extracts user from database for every authenticated request. Sets the validated user on `request.user`.

**Imports**:
```typescript
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
```

**Exports**: `JwtStrategy` class

**Who calls this file**: Passport library calls `validate()` on every request intercepted by `JwtAuthGuard`

**Which files this file calls**:
- `UsersService.findById()` — on EVERY authenticated request

**Database models used**: `User` (read, via UsersService)

**Configuration**:
```typescript
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: configService.get('JWT_ACCESS_SECRET'),
});
```

---

#### Method: `validate(payload)`

**Input**: Decoded JWT payload `{ sub: string, email: string, role: string, companyId: string | null }`

**Output**: User object attached to `request.user`

**Calls**:
```typescript
const user = await this.usersService.findById(payload.sub);
// ↑ CRITICAL BUG: called without actorRole and actorCompanyId arguments
// UsersService.findById(id, actorRole, actorCompanyId) has an ownership check:
//   if (user.companyId !== actorCompanyId) throw ForbiddenException
// Since actorCompanyId = undefined, this throws for every user with a companyId
```

**Security implications**: This is BUG-001. All authenticated requests to protected routes will fail with 403 unless the user has `companyId = null` (which only SUPER_ADMIN might have). The fix is to call `findById` with a bypass pattern or a dedicated auth-only method.

---

### `common/guards/jwt.guard.ts`

**Location**: `apps/api/src/common/guards/jwt.guard.ts`

**Purpose**: Wraps Passport's `AuthGuard('jwt')`. Adds support for the `@Public()` decorator — routes marked public bypass JWT validation entirely.

**Imports**:
```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
```

**Exports**: `JwtAuthGuard` class

**Who calls this file**: `AppModule` (registered as global `APP_GUARD`)

**Which files this file calls**: Passport `AuthGuard('jwt')` → `JwtStrategy.validate()`

**Method: `canActivate(context: ExecutionContext)`**:
```typescript
canActivate(context: ExecutionContext): boolean | Promise<boolean> {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),  // method-level decorator
    context.getClass(),    // class-level decorator
  ]);
  if (isPublic) return true;  // skip JWT validation
  return super.canActivate(context);  // delegate to passport-jwt
}
```

**Security implications**: `@Public()` completely bypasses authentication. Misapplying it to a route exposes it to unauthenticated access. Current `@Public()` routes: `POST /auth/login`, `POST /auth/refresh`, `GET /pages/public/:...`, `GET /seo/page/:pageId/public`.

---

### `common/guards/roles.guard.ts`

**Location**: `apps/api/src/common/guards/roles.guard.ts`

**Purpose**: Reads `@Roles()` metadata from controller methods. Uses `hasRoleOrHigher()` from `@nexuva/shared` to compare the user's role weight against the required minimum role.

**Imports**:
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { hasRoleOrHigher } from '@nexuva/shared';
```

**Exports**: `RolesGuard` class

**Who calls this file**: `AppModule` (registered as global `APP_GUARD`, runs after `JwtAuthGuard`)

**Which files this file calls**: `@nexuva/shared` utility `hasRoleOrHigher()`

**Method: `canActivate(context: ExecutionContext)`**:
```typescript
canActivate(context: ExecutionContext): boolean {
  const requiredRole = this.reflector.getAllAndOverride<string>(ROLES_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!requiredRole) return true;  // no @Roles() → any authenticated user passes

  const request = context.switchToHttp().getRequest();
  const user = request.user;
  if (!user) throw new ForbiddenException();

  if (!hasRoleOrHigher(user.role, requiredRole)) {
    throw new ForbiddenException('Insufficient permissions');
  }
  return true;
}
```

**Role weight table** (from `@nexuva/shared`):
| Role | Weight |
|---|---|
| SUPER_ADMIN | 100 |
| ADMIN | 80 |
| PRODUCT_MANAGER | 60 |
| CONTENT_EDITOR | 40 |
| VIEWER | 20 |

`hasRoleOrHigher('ADMIN', 'CONTENT_EDITOR')` → `80 >= 40` → `true`

**Security implications**: If `@Roles()` is not set on a route, ANY authenticated user can access it. Routes with no `@Roles()` decorator and no `@Public()` are implicitly accessible to all logged-in users regardless of role. The guard also does not check `user.role` for null/undefined — if user.role is somehow null, `hasRoleOrHigher(null, 'CONTENT_EDITOR')` behavior depends on `@nexuva/shared` implementation (potential bypass).

---

### `common/middleware/tenant.middleware.ts`

**Location**: `apps/api/src/common/middleware/tenant.middleware.ts`

**Purpose**: Runs before every request (before guards). Extracts the host header, resolves the domain to a tenant via `TenantService`, and attaches the result to `req.tenantContext`. Issues 301 redirects for `REDIRECT`-type domains.

**Imports**:
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { TenantService } from '../../modules/tenant/tenant.service';
```

**Exports**: `TenantMiddleware` class

**Who calls this file**: `AppModule.configure(consumer)` — applied to all routes via `forRoutes('*')`

**Which files this file calls**: `TenantService.resolveFromDomain()`

**Database models used**: None directly (via TenantService → Prisma)

**Method: `use(req, res, next)`**:
```typescript
async use(req: FastifyRequest, res: FastifyReply, next: NextFunction) {
  const host = req.headers.host ?? '';
  const domain = host.split(':')[0];  // strip port: "localhost:3000" → "localhost"

  if (!domain) {
    req.tenantContext = null;
    return next();
  }

  const result = await this.tenantService.resolveFromDomain(domain);

  if (!result) {
    req.tenantContext = null;
    return next();  // domain not found — does NOT block request
  }

  if (result.type === 'REDIRECT') {
    return res.redirect(301, `https://${result.target}${req.url}`);
  }

  req.tenantContext = result.tenant;
  return next();
}
```

**Security implications**:
- Middleware does NOT block requests on unknown domains — `req.tenantContext = null` and continues. No route currently checks `req.tenantContext !== null`. This is intentional for flexibility but means API routes are accessible from any domain.
- REDIRECT type performs 301 with path preservation — `req.url` is appended as-is, could theoretically be used for open redirect if `result.target` is user-controlled. Target comes from DB Domain record, not user input in the current request, so risk is low.

---

### `common/decorators/current-user.decorator.ts`

**Location**: `apps/api/src/common/decorators/current-user.decorator.ts`

**Purpose**: Parameter decorator that extracts `request.user` (set by JwtStrategy after validation) into a controller method parameter.

**Imports**:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
```

**Usage**:
```typescript
@Get('profile')
getProfile(@CurrentUser() user: User) {
  // user = request.user (validated JWT payload → DB user)
}
```

**Who calls this file**: All controllers that need the authenticated user — `AuthController`, `UsersController`, `PagesController`, `ContentBlocksController`, `SeoController`, `BrandingController`, `VersioningController`, `FeatureFlagsController`, `SettingsController`, `RolesController`, `CompaniesController`, `ProductsController`, `DomainsController`

---

### `common/decorators/public.decorator.ts`

**Location**: `apps/api/src/common/decorators/public.decorator.ts`

**Purpose**: Sets `IS_PUBLIC_KEY` metadata on a route handler. `JwtAuthGuard` reads this metadata and skips authentication.

**Exports**:
```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Who calls this file**: `AuthController` (login, refresh), `PagesController` (public page route), `SeoController` (public SEO route)

---

### `common/decorators/roles.decorator.ts`

**Location**: `apps/api/src/common/decorators/roles.decorator.ts`

**Purpose**: Sets `ROLES_KEY` metadata with the minimum required role string. `RolesGuard` reads this to enforce access control.

**Exports**:
```typescript
export const ROLES_KEY = 'roles';
export const Roles = (role: string) => SetMetadata(ROLES_KEY, role);
```

**Usage**: `@Roles('CONTENT_EDITOR')` — any user with CONTENT_EDITOR weight or higher can access

**Who calls this file**: Every controller that requires role-based access

---

### `common/decorators/tenant-context.decorator.ts`

**Location**: `apps/api/src/common/decorators/tenant-context.decorator.ts`

**Purpose**: Parameter decorator that extracts `request.tenantContext` (set by TenantMiddleware) into a controller method parameter.

**Status**: DEAD CODE — defined but never used in any controller

**Exports**:
```typescript
export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest<FastifyRequest>().tenantContext;
  }
);
```

**Who calls this file**: Nobody (dead decorator)

---

### `common/filters/http-exception.filter.ts`

**Location**: `apps/api/src/common/filters/http-exception.filter.ts`

**Purpose**: Global exception filter. Normalizes all `HttpException` responses into a consistent JSON shape.

**Imports**:
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
```

**Response shape**:
```json
{
  "statusCode": 400,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/v1/pages",
  "message": "Validation failed",
  "error": "Bad Request"
}
```

**Who calls this file**: `main.ts` (registered as global filter via `app.useGlobalFilters()`)

---

### `common/interceptors/audit.interceptor.ts`

**Location**: `apps/api/src/common/interceptors/audit.interceptor.ts`

**Purpose**: Intended to intercept HTTP requests and log all mutations to the audit log automatically, without requiring each service to call `auditLog.log()` manually.

**Status**: DEAD CODE — defined but never registered in AppModule or any module's providers

**Imports**:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
```

**Who calls this file**: Nobody (never registered)

---

## MODULE: Auth DTOs

### `dto/login.dto.ts`

**Location**: `apps/api/src/modules/auth/dto/login.dto.ts`

**Fields**:
```typescript
class LoginDto {
  @IsEmail()
  email: string;

  @IsString() @IsNotEmpty() @MinLength(8)
  password: string;
}
```

**Validation**: Email format enforced. Password minimum 8 characters. Does not validate password format beyond length (no special char requirements enforced at login — only at registration via UsersService).

---

### `dto/refresh-token.dto.ts`

**Location**: `apps/api/src/modules/auth/dto/refresh-token.dto.ts`

**Fields**:
```typescript
class RefreshTokenDto {
  @IsString() @IsNotEmpty()
  refreshToken: string;
}
```

---

## MODULE: Auth Dependency Graph

```
AuthController
  │
  └─ AuthService
        ├─ PrismaService (User read/write, RefreshToken CRUD)
        ├─ UsersService (findByEmail)
        ├─ JwtService (sign access + refresh tokens)
        ├─ ConfigService (JWT secrets + expiry env vars)
        ├─ AuditLogService (LOGIN, LOGOUT, REFRESH_TOKEN events)
        └─ argon2 (password verify, refresh token hashing)

JwtAuthGuard (global)
  │
  └─ JwtStrategy.validate()
        └─ UsersService.findById() ← BUG-001: called without ownership args

RolesGuard (global)
  └─ hasRoleOrHigher() from @nexuva/shared

TenantMiddleware (global, runs before guards)
  └─ TenantService.resolveFromDomain()
```

---

## Auth Runtime Flows

### Login Flow

```
POST /auth/login { email, password }
  │
  1. JwtAuthGuard.canActivate()
     └─ @Public() detected → returns true (skip JWT validation)
  │
  2. RolesGuard.canActivate()
     └─ No @Roles() on login → returns true
  │
  3. AuthController.login(dto)
     └─ AuthService.login(dto)
           │
           a. prisma.user.findFirst({ where: { email, deletedAt: null } })
              └─ NOT FOUND → UnauthorizedException('Invalid credentials')
           │
           b. argon2.verify(user.passwordHash, dto.password)
              └─ FALSE → UnauthorizedException('Invalid credentials')
           │
           c. prisma.user.update({ lastLoginAt: new Date() })
           │
           d. AuthService.signTokenPair(user)
                 ├─ jwtService.sign(accessPayload)    → accessToken (15m)
                 ├─ jwtService.sign(refreshPayload,   → refreshToken (7d JWT)
                 │     { secret: REFRESH_SECRET })
                 ├─ argon2.hash(rawRefreshToken)       → tokenHash
                 └─ prisma.refreshToken.create({ userId, tokenHash, expiresAt })
           │
           e. auditLogService.log({ action: 'LOGIN', resourceId: user.id })
           │
           f. Return { accessToken, refreshToken, user: omit(user, ['passwordHash']) }
```

### Authenticated Request Flow

```
GET /pages?tenantId=xxx
  │
  1. TenantMiddleware.use()
     ├─ Extract host header → domain
     └─ TenantService.resolveFromDomain(domain) → req.tenantContext = Tenant | null
  │
  2. JwtAuthGuard.canActivate()
     ├─ No @Public() → proceed with JWT validation
     └─ Passport extracts Bearer token from Authorization header
        └─ JwtStrategy.validate(payload)
              └─ UsersService.findById(payload.sub)   ← BUG-001 throws here
                    └─ req.user = user
  │
  3. RolesGuard.canActivate()
     ├─ @Roles('CONTENT_EDITOR') found on handler
     ├─ user.role = 'ADMIN' → hasRoleOrHigher('ADMIN', 'CONTENT_EDITOR') → true
     └─ Returns true
  │
  4. PagesController.findByTenant(tenantId, user)
     └─ PagesService.findByTenant(tenantId, user.role, user.companyId)
```

---

## MODULE: Users

### Folder Tree

```
apps/api/src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
└── dto/
    ├── create-user.dto.ts
    ├── update-user.dto.ts
    └── change-password.dto.ts
```

---

### `users.module.ts`

**Location**: `apps/api/src/modules/users/users.module.ts`

**Imports**:
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
```

**Exports**: `UsersService` — exported for use by `AuthModule` (JwtStrategy needs `UsersService.findById`)

**Who imports this module**: `AppModule`, `AuthModule`

---

### `users.controller.ts`

**Location**: `apps/api/src/modules/users/users.controller.ts`

**Purpose**: HTTP interface for user management. All routes are role-protected. Supports creating users, updating profile, changing passwords, managing activation status, assigning roles, soft-deleting.

**Imports**:
```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
```

**Exports**: `UsersController` class

**Routes**:

#### `GET /users`
- `@Roles('ADMIN')`
- Query: `companyId?: string`
- Calls: `UsersService.findAll(companyId, user.role, user.companyId)`
- Returns: User[] with roles, without passwordHash

#### `GET /users/:id`
- `@Roles('ADMIN')`
- Calls: `UsersService.findById(id, user.role, user.companyId)`
- Returns: Single user without passwordHash

#### `POST /users`
- `@Roles('ADMIN')`
- Body: `CreateUserDto`
- Calls: `UsersService.create(dto, user.id, user.role, user.companyId)`
- Returns: Created user without passwordHash

#### `PATCH /users/:id`
- `@Roles('ADMIN')`
- Body: `UpdateUserDto`
- Calls: `UsersService.update(id, dto, user.id, user.role, user.companyId)`
- Returns: Updated user

#### `PATCH /users/:id/password`
- `@Roles('ADMIN')` (admin resets passwords; users cannot change their own via this endpoint)
- Body: `ChangePasswordDto { newPassword: string }`
- Calls: `UsersService.changePassword(id, dto, user.id, user.role, user.companyId)`

#### `PATCH /users/:id/role`
- `@Roles('ADMIN')`
- Body: `{ role: string }`
- Calls: `UsersService.assignRole(id, role, user.id, user.role, user.companyId)`

#### `PATCH /users/:id/activate`
- `@Roles('ADMIN')`
- Calls: `UsersService.setActive(id, true, user.id, user.role, user.companyId)`

#### `PATCH /users/:id/deactivate`
- `@Roles('ADMIN')`
- Calls: `UsersService.setActive(id, false, user.id, user.role, user.companyId)`

#### `DELETE /users/:id`
- `@Roles('ADMIN')`
- Calls: `UsersService.softDelete(id, user.id, user.role, user.companyId)`

---

### `users.service.ts`

**Location**: `apps/api/src/modules/users/users.service.ts`

**Purpose**: Full user lifecycle management. Enforces ownership scoping, last-SUPER_ADMIN protection, anti-self-deletion, role escalation prevention, and session revocation on delete.

**Imports**:
```typescript
import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { hasRoleOrHigher } from '@nexuva/shared';
```

**Exports**: `UsersService` class

**Who calls this file**: `UsersController`, `JwtStrategy` (via `findById`)

**Which files this file calls**:
- `PrismaService` — User CRUD, RefreshToken revocation
- `AuditLogService` — all mutation events
- `argon2` — password hashing on create and change

**Database models used**: `User` (all CRUD), `RefreshToken` (updateMany on softDelete)

---

#### Constant: `USER_SELECT`

```typescript
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
  // passwordHash: NOT included — always excluded from query results
};
```

This constant is used in every `prisma.user.*` query that returns user data to external callers. `passwordHash` is never returned from service methods.

---

#### Method: `findAll(companyId, actorRole, actorCompanyId)`

**Input**: `companyId?: string`, `actorRole: string`, `actorCompanyId: string | null`

**Output**: `User[]` (using USER_SELECT, no passwordHash)

**Calls**:
```typescript
// SUPER_ADMIN: all users, optionally filtered by companyId param
// Others: only users in actorCompanyId
const where = actorRole === 'SUPER_ADMIN'
  ? { deletedAt: null, ...(companyId && { companyId }) }
  : { deletedAt: null, companyId: actorCompanyId ?? '__none__' };

return prisma.user.findMany({ where, select: USER_SELECT });
```

**Note on `'__none__'` sentinel**: When `actorCompanyId` is `null` for a non-SUPER_ADMIN user, using `null` in the Prisma where clause would match users with `companyId: null`. Using `'__none__'` (a string that will never match any UUID) produces an empty result set instead. This is an intentional pattern — defensive empty result rather than an accidental data leak.

**Prisma queries**:
```typescript
prisma.user.findMany({ where: { deletedAt: null, companyId: actorCompanyId ?? '__none__' }, select: USER_SELECT })
```

---

#### Method: `findById(id, actorRole, actorCompanyId)`

**Input**: `id: string`, `actorRole: string`, `actorCompanyId: string | null`

**Output**: User (using USER_SELECT)

**Calls**:
```typescript
const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
if (!user) throw NotFoundException;

if (actorRole !== 'SUPER_ADMIN' && user.companyId !== actorCompanyId) {
  throw ForbiddenException;
}

return user;
```

**Critical bug (BUG-001)**: `JwtStrategy.validate()` calls `this.usersService.findById(payload.sub)` with no `actorRole` or `actorCompanyId` arguments. Both default to `undefined`. The ownership check `user.companyId !== undefined` evaluates to `true` for any user with a companyId, throwing `ForbiddenException` on every authenticated request.

**Prisma queries**:
```typescript
prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT })
```

---

#### Method: `create(dto, actorId, actorRole, actorCompanyId)`

**Input**: `CreateUserDto`, actor information

**Output**: Created user (USER_SELECT shape)

**Calls**:
1. `assertNoEscalation(actorRole, dto.role)` — prevent assigning higher role than caller
2. Check caller's companyId scope: SUPER_ADMIN can create for any company; others can only create for their own company
3. `prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } })` — duplicate check
4. If exists → `ConflictException`
5. `argon2.hash(dto.password)` — hash the password
6. `prisma.user.create({ data: { email, firstName, lastName, role, companyId, passwordHash, isActive: true } })`
7. `auditLog.log({ action: 'CREATE', resource: 'user', actorId, after: { email, role, companyId } })`
8. Return user without passwordHash

**Prisma queries**:
```typescript
prisma.user.findFirst({ where: { email, deletedAt: null } })
prisma.user.create({ data: { ...fields, passwordHash } })
```

---

#### Method: `update(id, dto, actorId, actorRole, actorCompanyId)`

**Input**: `UpdateUserDto { firstName?, lastName?, isActive? }`, actor information

**Output**: Updated user

**Calls**:
1. Load target user: `prisma.user.findFirst({ where: { id, deletedAt: null } })`
2. Ownership check: `user.companyId !== actorCompanyId` → `ForbiddenException` (non-SUPER_ADMIN)
3. Self-action prevention: `id === actorId && dto.isActive === false` → `BadRequestException` (can't deactivate self)
4. Last SUPER_ADMIN protection: if `user.role === 'SUPER_ADMIN'` and actor is changing `isActive`, count active SUPER_ADMINs. If count === 1 → `BadRequestException`
5. `prisma.user.update({ where: { id }, data: { firstName, lastName, isActive }, select: USER_SELECT })`
6. `auditLog.log({ action: 'UPDATE', resource: 'user', before, after })`

**Note**: `role` is NOT updatable via `update()`. Role changes go through `assignRole()`.

**Prisma queries**:
```typescript
prisma.user.findFirst({ where: { id, deletedAt: null } })
prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null } })
prisma.user.update({ where: { id }, data: { ... }, select: USER_SELECT })
```

---

#### Method: `changePassword(id, dto, actorId, actorRole, actorCompanyId)`

**Input**: `ChangePasswordDto { newPassword: string }`, actor information

**Output**: `{ success: true }`

**Calls**:
1. Load target user (ownership check)
2. `argon2.hash(dto.newPassword)` — hash new password
3. `prisma.user.update({ where: { id }, data: { passwordHash } })`
4. `prisma.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } })` — revoke all sessions (security measure — password change invalidates all existing tokens)
5. `auditLog.log({ action: 'PASSWORD_CHANGE', resource: 'user', actorId, resourceId: id })`

**Prisma queries**:
```typescript
prisma.user.update({ where: { id }, data: { passwordHash } })
prisma.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } })
```

---

#### Method: `assignRole(id, role, actorId, actorRole, actorCompanyId)`

**Input**: `id: string`, `role: string`, actor information

**Output**: Updated user

**Calls**:
1. Load target user (ownership check)
2. `assertNoEscalation(actorRole, role)` — cannot assign role higher than self
3. Self-role-change prevention: `id === actorId` → `BadRequestException`
4. Last SUPER_ADMIN protection: if target is last active SUPER_ADMIN and new role is not SUPER_ADMIN → `BadRequestException`
5. `prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT })`
6. `auditLog.log({ action: 'ASSIGN_ROLE', resource: 'user', before: { role: old }, after: { role: new } })`

**Prisma queries**:
```typescript
prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null } })
prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT })
```

---

#### Method: `setActive(id, isActive, actorId, actorRole, actorCompanyId)`

**Input**: `id: string`, `isActive: boolean`, actor information

**Output**: Updated user

**Calls**:
1. Load target user (ownership check)
2. Self-action prevention: `id === actorId` → cannot deactivate self
3. Last SUPER_ADMIN protection if deactivating
4. Idempotent: if `user.isActive === isActive` → return user unchanged with `{ changed: false }`
5. `prisma.user.update({ where: { id }, data: { isActive }, select: USER_SELECT })`
6. `auditLog.log({ action: isActive ? 'ACTIVATE' : 'DEACTIVATE', resource: 'user', ... })`

---

#### Method: `softDelete(id, actorId, actorRole, actorCompanyId)`

**Input**: `id: string`, actor information

**Output**: `{ deleted: true }`

**Calls**:
1. Load target user (ownership check)
2. Self-deletion prevention: `id === actorId` → `BadRequestException`
3. Last SUPER_ADMIN protection
4. `prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })`
5. `prisma.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } })` — revoke all active sessions
6. `auditLog.log({ action: 'DELETE', resource: 'user', before: { email, role } })`

**Prisma queries**:
```typescript
prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
prisma.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } })
```

---

#### Private Method: `assertNoEscalation(actorRole, targetRole)`

**Purpose**: Prevents privilege escalation — a user cannot assign a role higher than their own.

```typescript
private assertNoEscalation(actorRole: string, targetRole: string): void {
  if (!hasRoleOrHigher(actorRole, targetRole)) {
    throw new ForbiddenException('Cannot assign a role higher than your own');
  }
}
```

Example: An ADMIN (weight 80) cannot assign SUPER_ADMIN (weight 100) to any user.

---

### Users DTOs

#### `dto/create-user.dto.ts`

**Location**: `apps/api/src/modules/users/dto/create-user.dto.ts`

```typescript
class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString() @IsNotEmpty() @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase and number'
  })
  password: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;           // defaults to VIEWER if not set

  @IsOptional() @IsString()
  companyId?: string;

  @IsOptional() @IsString()
  tenantId?: string;
}
```

Password policy enforced at creation: uppercase + lowercase + digit required.

---

#### `dto/update-user.dto.ts`

```typescript
class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
```

`email`, `role`, `companyId`, `passwordHash` are NOT updatable via this DTO.

---

#### `dto/change-password.dto.ts`

```typescript
class ChangePasswordDto {
  @IsString() @IsNotEmpty() @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  newPassword: string;
}
```

Same password policy as create.

---

## MODULE: Roles

### Folder Tree

```
apps/api/src/modules/roles/
├── roles.module.ts
├── roles.controller.ts
├── roles.service.ts
└── dto/
    └── set-permission.dto.ts
```

---

### `roles.module.ts`

**Location**: `apps/api/src/modules/roles/roles.module.ts`

**Imports**:
```typescript
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
```

**Exports**: Nothing (roles module is self-contained)

**Who imports this module**: `AppModule`

---

### `roles.controller.ts`

**Location**: `apps/api/src/modules/roles/roles.controller.ts`

**Routes**:

#### `GET /roles/user/:userId/permissions`
- `@Roles('ADMIN')`
- Returns: Permission[] for a user

#### `POST /roles/user/:userId/permissions`
- `@Roles('ADMIN')`
- Body: `SetPermissionDto`
- Calls: `RolesService.setPermission(userId, dto, actorId, actorRole, actorCompanyId)`

#### `DELETE /roles/user/:userId/permissions/:permissionId`
- `@Roles('ADMIN')`
- Calls: `RolesService.removePermission(userId, permissionId, actorId, actorRole, actorCompanyId)`

---

### `roles.service.ts`

**Location**: `apps/api/src/modules/roles/roles.service.ts`

**Purpose**: CRUD for `Permission` records. These represent fine-grained resource-level permissions beyond role weights. **Currently not enforced at runtime** — stored but never read by guards.

**Database models used**: `Permission` (create, read, delete), `User` (ownership lookup)

---

#### Method: `getPermissions(userId, actorRole, actorCompanyId)`

1. Load target user (ownership check: same company as actor)
2. `prisma.permission.findMany({ where: { userId } })`
3. Returns Permission[]

---

#### Method: `setPermission(userId, dto, actorId, actorRole, actorCompanyId)`

1. Load target user (ownership check)
2. Escalation check: actor cannot grant permissions for roles above their own
3. `prisma.permission.upsert({ where: { userId_resource_action: { userId, resource, action } }, create: { ... }, update: { scope } })`
4. `auditLog.log({ action: 'SET_PERMISSION', ... })`

**Note**: The upsert unique key is `(userId, resource, action)` — a user can only have one permission entry per resource+action pair. Repeated calls update the `scope` field.

---

#### Method: `removePermission(userId, permissionId, actorId, actorRole, actorCompanyId)`

1. Load permission: `prisma.permission.findFirst({ where: { id: permissionId, userId } })`
2. Ownership check via user chain
3. `prisma.permission.delete({ where: { id: permissionId } })`
4. `auditLog.log({ action: 'REMOVE_PERMISSION', ... })`

---

### `dto/set-permission.dto.ts`

```typescript
class SetPermissionDto {
  @IsString() @IsNotEmpty()
  resource: string;       // e.g. 'page', 'branding', 'user'

  @IsString() @IsNotEmpty()
  action: string;         // e.g. 'read', 'write', 'delete', 'publish'

  @IsOptional() @IsString()
  scope?: string;         // e.g. 'own', 'company', 'global' — not currently enforced
}
```

---

## Users + Roles Dependency Graph

```
UsersController
  │
  └─ UsersService
        ├─ PrismaService (User, RefreshToken)
        ├─ AuditLogService
        ├─ argon2 (password hashing)
        └─ hasRoleOrHigher from @nexuva/shared

RolesController
  │
  └─ RolesService
        ├─ PrismaService (Permission, User)
        └─ AuditLogService

JwtStrategy
  └─ UsersService.findById() ← called without args (BUG-001)
```

---

## Users Runtime Flow: Create User

```
POST /users { email, password, firstName, lastName, role, companyId }
  │
  1. TenantMiddleware → req.tenantContext (informational)
  │
  2. JwtAuthGuard → JwtStrategy.validate() → req.user = actor
     (BUG: throws for all users with companyId — this flow fails in production)
  │
  3. RolesGuard → @Roles('ADMIN') → actor.role must be ADMIN or higher
  │
  4. UsersController.create(dto, actor)
     └─ UsersService.create(dto, actor.id, actor.role, actor.companyId)
           │
           a. assertNoEscalation(actor.role, dto.role)
              └─ hasRoleOrHigher(actor.role, dto.role) → throws if false
           │
           b. prisma.user.findFirst({ where: { email, deletedAt: null } })
              └─ ConflictException if found
           │
           c. argon2.hash(dto.password) → passwordHash
           │
           d. prisma.user.create({ data: { ...fields, passwordHash } })
           │
           e. auditLogService.log({ action: 'CREATE', resource: 'user' })
           │
           f. Return omit(user, ['passwordHash'])
```

---

## Prisma Module

### `prisma/prisma.module.ts`

**Location**: `apps/api/src/prisma/prisma.module.ts`

**Purpose**: Wraps `PrismaClient` as a NestJS injectable service. Connects on module init, disconnects on module destroy.

```typescript
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Who imports this module**: Every feature module that needs DB access — UsersModule, AuthModule, PagesModule, ContentBlocksModule, SeoModule, BrandingModule, VersioningModule, FeatureFlagsModule, SettingsModule, AuditLogModule, TenantModule, CompaniesModule, ProductsModule, DomainsModule, RolesModule

### `prisma/prisma.service.ts`

**Location**: `apps/api/src/prisma/prisma.service.ts`

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Database**: PostgreSQL 16 via `DATABASE_URL` environment variable

**Prisma Client version**: Prisma 5.x (inferred from schema features used)

**Who calls this file**: ALL service files in the application — `PrismaService` is the single database access point.

---

## Shared Packages

### `@nexuva/shared`

**Location**: `packages/shared/`

**Used in**: `RolesGuard`, `UsersService`, `CompaniesService`, `ProductsService`, etc.

**Exported utilities**:
- `hasRoleOrHigher(userRole: string, requiredRole: string): boolean` — role weight comparison
- `slugify(text: string): string` — converts text to URL-safe kebab-case
- `omit<T>(obj: T, keys: string[]): Partial<T>` — object field exclusion
- `pick<T>(obj: T, keys: string[]): Partial<T>` — object field inclusion
- Zod validators for common types (email, UUID, slug)
- `ROLE_WEIGHTS` constant object: `{ SUPER_ADMIN: 100, ADMIN: 80, PRODUCT_MANAGER: 60, CONTENT_EDITOR: 40, VIEWER: 20 }`

### `@nexuva/types`

**Location**: `packages/types/`

**Used in**: All TypeScript files that need shared type definitions

**Content**: TypeScript interface definitions only. No runtime code. Types for: `TenantContext`, `TokenPair`, `UserRole`, `BlockType`, `ProductStatus`, `DomainType`, `UserSafe`.

### `@nexuva/ui`

**Location**: `packages/ui/`

**Used in**: Frontend applications only (`apps/admin`, `apps/web`)

**Content**: Shared React components — `Button`, `Card`, `Input`, `Badge`. Not used in the API.
