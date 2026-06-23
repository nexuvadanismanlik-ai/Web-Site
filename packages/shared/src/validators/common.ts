import { z } from 'zod';
import { BLOCK_TYPES, DOMAIN_TYPES, PRODUCT_STATUSES, SUPPORTED_LOCALES } from '../constants/enums';

export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const cuidSchema = z.string().cuid();

export const localeSchema = z.enum(SUPPORTED_LOCALES);

export const productStatusSchema = z.enum(PRODUCT_STATUSES);

export const domainTypeSchema = z.enum(DOMAIN_TYPES);

export const blockTypeSchema = z.enum(BLOCK_TYPES);

export const colorHexSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Must be a valid hex color');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
