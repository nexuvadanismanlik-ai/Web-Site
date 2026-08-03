import type { UserRole } from '@nexuva/types';
export declare const USER_ROLES: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly ADMIN: "ADMIN";
    readonly PRODUCT_MANAGER: "PRODUCT_MANAGER";
    readonly CONTENT_EDITOR: "CONTENT_EDITOR";
    readonly VIEWER: "VIEWER";
};
export declare const ROLE_HIERARCHY: Record<UserRole, number>;
export declare function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean;
