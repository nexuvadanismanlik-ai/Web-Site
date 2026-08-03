"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HIERARCHY = exports.USER_ROLES = void 0;
exports.hasRoleOrHigher = hasRoleOrHigher;
exports.USER_ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    PRODUCT_MANAGER: 'PRODUCT_MANAGER',
    CONTENT_EDITOR: 'CONTENT_EDITOR',
    VIEWER: 'VIEWER',
};
exports.ROLE_HIERARCHY = {
    SUPER_ADMIN: 100,
    ADMIN: 80,
    PRODUCT_MANAGER: 60,
    CONTENT_EDITOR: 40,
    VIEWER: 20,
};
function hasRoleOrHigher(userRole, requiredRole) {
    return exports.ROLE_HIERARCHY[userRole] >= exports.ROLE_HIERARCHY[requiredRole];
}
