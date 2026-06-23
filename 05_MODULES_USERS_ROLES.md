# 05 — MODULES: USERS & ROLES

---

## MODULE: Users

### Files

```
apps/api/src/modules/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
└── dto/
    ├── create-user.dto.ts
    ├── update-user.dto.ts
    └── assign-role.dto.ts
```

---

### `users.module.ts`

```typescript
imports:  [AuditLogModule]
providers: [UsersService]
controllers: [UsersController]
exports:  [UsersService]
```

`UsersService` is exported because `JwtStrategy` (in `AuthModule`) needs it to validate tokens — every authenticated request calls `usersService.findById(payload.sub)`.

---

### `users.controller.ts`

**Controller prefix**: `/users`

**Imports argon2 directly**: Password hashing happens in the controller before delegating to the service. This is a separation-of-concerns issue — hashing belongs in the service.

```typescript
import * as argon2 from 'argon2';
```

**All routes require authentication**.

#### GET /users
- Role: `@Roles('ADMIN')`
- No params
- Calls: `UsersService.findAll(user.role, user.companyId)`
- Returns: array of users (passwordHash never included — `USER_SELECT` constant)

#### GET /users/:id
- Role: `@Roles('ADMIN')`
- Calls: `UsersService.findById(id, user.role, user.companyId)`

#### POST /users
- Role: `@Roles('ADMIN')`
- Body: `CreateUserDto`
- Controller hashes password: `const passwordHash = await argon2.hash(dto.password)`
- Calls: `UsersService.create(dto, passwordHash, user.id, user.role, user.companyId)`
- Privilege escalation prevented in service

#### PATCH /users/:id
- Role: `@Roles('ADMIN')`
- Body: `UpdateUserDto`
- Calls: `UsersService.update(id, dto, user.id, user.role, user.companyId)`

#### PATCH /users/:id/role
- Role: `@Roles('ADMIN')`
- Body: `AssignRoleDto`
- Calls: `UsersService.assignRole(id, dto.role, user.id, user.role, user.companyId)`
- Dedicated endpoint for role assignment with explicit audit trail

#### DELETE /users/:id
- Role: `@Roles('SUPER_ADMIN')`
- Calls: `UsersService.softDelete(id, user.id, user.role, user.companyId)`

---

### `users.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

**Imports from `@nexuva/shared`**: `ROLE_HIERARCHY`

#### USER_SELECT constant

```typescript
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  companyId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}
```

`passwordHash` is explicitly absent. Every user read goes through this select — passwordHash can never leak through UsersService methods.

---

#### `assertNoEscalation(actorRole, targetRole)` — private

```typescript
if (ROLE_HIERARCHY[targetRole] > ROLE_HIERARCHY[actorRole]) {
  throw new ForbiddenException(`You cannot assign a role higher than your own (${actorRole})`);
}
```

Prevents privilege escalation: a caller cannot create or promote a user to a role with a higher numeric weight than their own.

Examples:
- ADMIN (80) cannot create a SUPER_ADMIN (100) user
- PRODUCT_MANAGER (60) cannot promote someone to ADMIN (80)
- SUPER_ADMIN (100) can assign any role

---

#### `assertCompanyOwnership(companyId, actorRole, actorCompanyId)` — private async

```typescript
if (actorRole === 'SUPER_ADMIN') return;
if (companyId !== actorCompanyId) throw ForbiddenException('You can only assign users to your own company');
const company = await prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
if (!company) throw NotFoundException(...);
```

Verifies that the `companyId` being assigned to a new user belongs to the actor's own company. SUPER_ADMIN bypasses.

---

#### `findAll(actorRole, actorCompanyId)`

```typescript
const where = actorRole === 'SUPER_ADMIN'
  ? { deletedAt: null }
  : { deletedAt: null, companyId: actorCompanyId ?? '__none__' };

return prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' } });
```

- SUPER_ADMIN sees all non-deleted users across all companies
- Others see only users in their own company
- `'__none__'` fallback ensures empty result for users without a company assignment

---

#### `findById(id, actorRole, actorCompanyId)` — also used by JwtStrategy

```typescript
const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
if (!user) throw NotFoundException;
if (actorRole !== 'SUPER_ADMIN' && user.companyId !== actorCompanyId) {
  throw ForbiddenException('Access denied to this user');
}
return user;
```

Called on every authenticated request by `JwtStrategy.validate()`. The `actorRole` and `actorCompanyId` parameters are omitted when called from JwtStrategy (they default to undefined), which means the `actorRole !== 'SUPER_ADMIN'` check passes (`undefined !== 'SUPER_ADMIN'`), and then `user.companyId !== undefined` — this could throw ForbiddenException for any user.

**Bug**: When `JwtStrategy` calls `usersService.findById(payload.sub)` it does NOT pass `actorRole` or `actorCompanyId`. The method signature is:
```typescript
async findById(id: string, actorRole: UserRole, actorCompanyId?: string | null)
```
JwtStrategy calls: `this.usersService.findById(payload.sub)` — only passing `id`.

This means `actorRole` is `undefined`, `undefined !== 'SUPER_ADMIN'` is true, and then `user.companyId !== undefined` evaluates to `true` (since `actorCompanyId` is `undefined`). This would throw `ForbiddenException` for every single user on every authenticated request.

This is a critical bug unless the TypeScript overload resolution or the JavaScript `!== undefined` comparison happens to allow it through. Let me reconsider: `user.companyId !== actorCompanyId` where `actorCompanyId` is `undefined` and `user.companyId` is `null` — `null !== undefined` is `true` in JavaScript. This would throw on every token validation.

**This means JwtStrategy.validate() would throw ForbiddenException for every user who has companyId=null (i.e., SUPER_ADMIN users who have no company).** For users with a companyId, it would also throw since `user.companyId (string) !== undefined (undefined)` is always true.

In practice, the system likely has users with companyId populated, so SUPER_ADMIN users (companyId=null) would fail token validation with a 403. This is a latent bug that would surface as soon as a SUPER_ADMIN tries to make an authenticated request.

---

#### `create(dto, passwordHash, actorId, actorRole, actorCompanyId)`

1. `assertNoEscalation(actorRole, dto.role)` — privilege check
2. If `dto.companyId`: `assertCompanyOwnership(dto.companyId, actorRole, actorCompanyId)`
3. `prisma.user.findUnique({ where: { email: dto.email } })` — duplicate email check (not scoped to deletedAt — a soft-deleted user's email is still reserved)
4. If duplicate: throw `ConflictException('Email already registered')`
5. `prisma.user.create({ data: { email, passwordHash, firstName, lastName, role, companyId } }, select: USER_SELECT)`
6. `auditLog.log({ action: 'CREATE', resource: 'user', after: { email, role, companyId } })`

Prisma models touched: `user` (read for duplicate check, create)

---

#### `update(id, dto, actorId, actorRole, actorCompanyId)`

1. `this.findById(id, actorRole, actorCompanyId)` — scope check and load target user
2. Self-action block: if `id === actorId && (dto.role !== undefined || dto.isActive !== undefined)` → throw `ForbiddenException`
3. If `dto.role !== undefined`: `assertNoEscalation(actorRole, dto.role)`
4. Last SUPER_ADMIN protection: if demoting from SUPER_ADMIN → count active SUPER_ADMINs → if ≤ 1 throw `BadRequestException`
5. `prisma.user.update({ where: { id }, data: { firstName, lastName, role, isActive }, select: USER_SELECT })`
6. If role changed: `auditLog.log({ action: 'ROLE_CHANGE', resource: 'user', before: { role }, after: { role } })`
7. If profile changed: `auditLog.log({ action: 'UPDATE', resource: 'user', before, after })`

Note: Two separate audit log entries can be created in one update call (one for role change, one for profile). Not atomic — if the second audit log write fails, the first is already committed.

Prisma models touched: `user` (read via findById, update)

---

#### `assignRole(targetUserId, role, actorId, actorRole, actorCompanyId)`

Dedicated role assignment with its own audit trail.

1. Self-action block: if `targetUserId === actorId` → throw `ForbiddenException('You cannot change your own role')`
2. `this.findById(targetUserId, actorRole, actorCompanyId)` — load and scope-check target
3. `assertNoEscalation(actorRole, role)` — privilege check
4. Last SUPER_ADMIN protection
5. `prisma.user.update({ where: { id: targetUserId }, data: { role }, select: USER_SELECT })`
6. `auditLog.log({ action: 'ROLE_CHANGE', resource: 'user', before: { role: target.role }, after: { role } })`

Prisma models touched: `user` (read via findById, update)

---

#### `softDelete(id, actorId, actorRole, actorCompanyId)`

1. Self-delete block: if `id === actorId` → throw `ForbiddenException('You cannot delete your own account')`
2. `this.findById(id, actorRole, actorCompanyId)` — scope check
3. Last SUPER_ADMIN protection
4. `prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false }, select: USER_SELECT })`
5. `prisma.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } })` — revoke all sessions
6. `auditLog.log({ action: 'DELETE', resource: 'user', before: { email, role, companyId } })`

Prisma models touched: `user` (read via findById, update), `refresh_tokens` (updateMany)

---

### `dto/create-user.dto.ts`

```typescript
class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString() @IsNotEmpty() @MinLength(8)
  password: string;       // hashed in controller before service call

  @IsOptional() @IsString()
  firstName?: string;

  @IsOptional() @IsString()
  lastName?: string;

  @IsEnum(['SUPER_ADMIN','ADMIN','PRODUCT_MANAGER','CONTENT_EDITOR','VIEWER'])
  role: UserRole;

  @IsOptional() @IsString()
  companyId?: string;
}
```

---

### `dto/update-user.dto.ts`

```typescript
class UpdateUserDto {
  @IsOptional() @IsString()
  firstName?: string;

  @IsOptional() @IsString()
  lastName?: string;

  @IsOptional() @IsEnum([...])
  role?: UserRole;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
```

Note: `email` and `password` are not updatable through this DTO. There is no password change endpoint in the current codebase.

---

### `dto/assign-role.dto.ts`

```typescript
class AssignRoleDto {
  @IsEnum(['SUPER_ADMIN','ADMIN','PRODUCT_MANAGER','CONTENT_EDITOR','VIEWER'])
  role: UserRole;
}
```

---

## MODULE: Roles

### Files

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

```typescript
imports:  [AuditLogModule]
providers: [RolesService]
controllers: [RolesController]
exports:  []
```

---

### `roles.controller.ts`

**Controller prefix**: `/roles`

#### GET /roles/hierarchy
- Role: `@Roles('ADMIN')`
- Calls: `RolesService.getHierarchy()`
- Returns: static array of `{ role, weight, canInherit[] }` — derived from ROLE_HIERARCHY constant, no DB query

#### GET /roles/permissions
- Role: `@Roles('SUPER_ADMIN')`
- Calls: `RolesService.getMatrix()`
- Returns: all Permission records grouped by role

#### GET /roles/permissions/:role
- Role: `@Roles('ADMIN')`
- Param: `role` (UserRole)
- Calls: `RolesService.getForRole(role)`
- Returns: Permission records for that role

#### PUT /roles/permissions
- Role: `@Roles('SUPER_ADMIN')`
- Body: `SetPermissionDto`
- Calls: `RolesService.setPermission(dto.role, dto.resource, dto.actions, user.id)`
- Upserts a permission record

#### DELETE /roles/permissions/:role/:resource
- Role: `@Roles('SUPER_ADMIN')`
- Params: `role`, `resource`
- Calls: `RolesService.removePermission(role, resource, user.id)`

---

### `roles.service.ts`

**Dependencies injected**: `PrismaService`, `AuditLogService`

**Imports from `@nexuva/shared`**: `ROLE_HIERARCHY`

Important architectural note: The `Permission` table is a **metadata store**, not a **runtime enforcement table**. The `RolesGuard` does NOT query the permissions table at request time. Access control is enforced purely by `@Roles()` decorator + `hasRoleOrHigher()` hierarchy check. The Permission table stores explicit per-resource action maps for documentation and future use, but does not gate any API endpoint today.

---

#### `getHierarchy()`

```typescript
const roles = Object.entries(ROLE_HIERARCHY) as [UserRole, number][];
const sorted = roles.sort((a, b) => b[1] - a[1]);
return sorted.map(([role, weight]) => ({
  role,
  weight,
  canInherit: sorted.filter(([, w]) => w <= weight).map(([r]) => r)
}));
```

Returns:
```json
[
  { "role": "SUPER_ADMIN", "weight": 100, "canInherit": ["SUPER_ADMIN","ADMIN","PRODUCT_MANAGER","CONTENT_EDITOR","VIEWER"] },
  { "role": "ADMIN", "weight": 80, "canInherit": ["ADMIN","PRODUCT_MANAGER","CONTENT_EDITOR","VIEWER"] },
  { "role": "PRODUCT_MANAGER", "weight": 60, "canInherit": ["PRODUCT_MANAGER","CONTENT_EDITOR","VIEWER"] },
  { "role": "CONTENT_EDITOR", "weight": 40, "canInherit": ["CONTENT_EDITOR","VIEWER"] },
  { "role": "VIEWER", "weight": 20, "canInherit": ["VIEWER"] }
]
```

No DB query — purely computed from constants.

---

#### `getMatrix()`

```typescript
const rows = await prisma.permission.findMany({ orderBy: [{ role: 'asc' }, { resource: 'asc' }] });
// Group by role into a Record<UserRole, Array<{ resource, actions }>>
```

Returns all stored permission records grouped by role. Only meaningful if setPermission() has been called to populate the table — it is empty on a fresh installation.

---

#### `getForRole(role)`

```typescript
return prisma.permission.findMany({ where: { role }, orderBy: { resource: 'asc' } });
```

---

#### `setPermission(role, resource, actions, actorId)`

```typescript
const existing = await prisma.permission.findUnique({ where: { role_resource: { role, resource } } });
const record = await prisma.permission.upsert({
  where: { role_resource: { role, resource } },
  create: { role, resource, actions },
  update: { actions }
});
await auditLog.log({ action: existing ? 'UPDATE' : 'CREATE', resource: 'permission', ... });
```

Upserts by `[role, resource]` composite unique key. Logs whether it was a create or update.

---

#### `removePermission(role, resource, actorId)`

```typescript
const existing = await prisma.permission.findUnique({ where: { role_resource: { role, resource } } });
if (!existing) return { deleted: false };
await prisma.permission.delete({ where: { role_resource: { role, resource } } });
await auditLog.log({ action: 'DELETE', resource: 'permission', ... });
return { deleted: true, role, resource };
```

Hard delete. Returns `{ deleted: false }` if the record didn't exist (idempotent).

---

### `dto/set-permission.dto.ts`

```typescript
class SetPermissionDto {
  @IsEnum(['SUPER_ADMIN','ADMIN','PRODUCT_MANAGER','CONTENT_EDITOR','VIEWER'])
  role: UserRole;

  @IsString() @IsNotEmpty()
  resource: string;    // free-form string, e.g. 'company', 'page'

  @IsObject()
  actions: Record<string, boolean>;   // e.g. { create: true, read: true, update: false, delete: false }
}
```

---

## ROLE HIERARCHY — Reference

| Role | Weight | Can access routes requiring |
|---|---|---|
| SUPER_ADMIN | 100 | SUPER_ADMIN, ADMIN, PRODUCT_MANAGER, CONTENT_EDITOR, VIEWER |
| ADMIN | 80 | ADMIN, PRODUCT_MANAGER, CONTENT_EDITOR, VIEWER |
| PRODUCT_MANAGER | 60 | PRODUCT_MANAGER, CONTENT_EDITOR, VIEWER |
| CONTENT_EDITOR | 40 | CONTENT_EDITOR, VIEWER |
| VIEWER | 20 | VIEWER |

---

## Permission System — Actual vs. Stored

### Actual enforcement (runtime)
- `@Roles('CONTENT_EDITOR')` on a route → any user with role weight ≥ 40 can access
- Enforced by `RolesGuard` using `hasRoleOrHigher()` from `@nexuva/shared`
- Zero DB queries for permission checking

### Stored permissions (metadata only)
- `Permission` table records are writable via `/roles/permissions`
- They document intended action-level access but do NOT gate any route
- A stored permission record `{ role: VIEWER, resource: 'page', actions: { delete: true } }` does NOT grant VIEWER delete access — the `@Roles('ADMIN')` decorator on `DELETE /pages/:id` still blocks it

This gap means the Permission table is misleading — it stores data that has no runtime effect.

---

## Route Access Matrix

| Route | VIEWER | CONTENT_EDITOR | PRODUCT_MANAGER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| GET /users | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ (all) |
| GET /users/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| POST /users | ✗ | ✗ | ✗ | ✓ | ✓ |
| PATCH /users/:id | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| PATCH /users/:id/role | ✗ | ✗ | ✗ | ✓ (scoped) | ✓ |
| DELETE /users/:id | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /roles/hierarchy | ✗ | ✗ | ✗ | ✓ | ✓ |
| GET /roles/permissions | ✗ | ✗ | ✗ | ✗ | ✓ |
| GET /roles/permissions/:role | ✗ | ✗ | ✗ | ✓ | ✓ |
| PUT /roles/permissions | ✗ | ✗ | ✗ | ✗ | ✓ |
| DELETE /roles/permissions/:role/:resource | ✗ | ✗ | ✗ | ✗ | ✓ |

---

## Dependency Graphs

### UsersModule

```
UsersController
  ├── UsersService
  │     ├── PrismaService (global)
  │     └── AuditLogService
  │           └── PrismaService (global)
  └── argon2 (direct import in controller — technical debt)

JwtStrategy (AuthModule)
  └── UsersService (cross-module: AuthModule doesn't declare UsersModule in imports)
```

### RolesModule

```
RolesController
  └── RolesService
        ├── PrismaService (global)
        └── AuditLogService
              └── PrismaService (global)
```

---

## Key Invariants

1. `passwordHash` is never returned by any `UsersService` method — `USER_SELECT` excludes it
2. A user cannot modify their own role or deactivate themselves
3. A user cannot delete themselves
4. The last SUPER_ADMIN cannot be demoted or deleted
5. Role assignment is subject to privilege hierarchy — you can only assign roles ≤ your own
6. Soft-deleted users have their email reserved — duplicate email check does NOT filter by `deletedAt`
7. There is no password change endpoint in the current codebase
8. There is no email change endpoint in the current codebase
