"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = exports.colorHexSchema = exports.blockTypeSchema = exports.domainTypeSchema = exports.productStatusSchema = exports.localeSchema = exports.cuidSchema = exports.slugSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.slugSchema = zod_1.z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');
exports.cuidSchema = zod_1.z.string().cuid();
exports.localeSchema = zod_1.z.enum(enums_1.SUPPORTED_LOCALES);
exports.productStatusSchema = zod_1.z.enum(enums_1.PRODUCT_STATUSES);
exports.domainTypeSchema = zod_1.z.enum(enums_1.DOMAIN_TYPES);
exports.blockTypeSchema = zod_1.z.enum(enums_1.BLOCK_TYPES);
exports.colorHexSchema = zod_1.z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Must be a valid hex color');
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().optional(),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
