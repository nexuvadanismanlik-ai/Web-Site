import { z } from 'zod';
export declare const slugSchema: z.ZodString;
export declare const cuidSchema: z.ZodString;
export declare const localeSchema: z.ZodEnum<["tr", "en"]>;
export declare const productStatusSchema: z.ZodEnum<["DRAFT", "ACTIVE", "HIDDEN", "BETA", "ARCHIVED"]>;
export declare const domainTypeSchema: z.ZodEnum<["PRIMARY", "SUBDOMAIN", "REDIRECT", "ALIAS"]>;
export declare const blockTypeSchema: z.ZodEnum<["HERO", "TEXT", "IMAGE", "GALLERY", "CTA", "FEATURES", "TESTIMONIALS", "FAQ", "CUSTOM"]>;
export declare const colorHexSchema: z.ZodString;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
