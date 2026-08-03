"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_FLAG_KEYS = exports.DEFAULT_LOCALE = exports.SUPPORTED_LOCALES = exports.NOTIFICATION_TYPES = exports.BLOCK_TYPES = exports.DOMAIN_TYPES = exports.PRODUCT_STATUSES = exports.COMPANY_TYPES = exports.TENANT_TYPES = void 0;
exports.TENANT_TYPES = ['HOLDING', 'PRODUCT'];
exports.COMPANY_TYPES = ['HOLDING', 'SUBSIDIARY'];
exports.PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'];
exports.DOMAIN_TYPES = ['PRIMARY', 'SUBDOMAIN', 'REDIRECT', 'ALIAS'];
exports.BLOCK_TYPES = [
    'HERO',
    'TEXT',
    'IMAGE',
    'GALLERY',
    'CTA',
    'FEATURES',
    'TESTIMONIALS',
    'FAQ',
    'CUSTOM',
];
exports.NOTIFICATION_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'SYSTEM'];
exports.SUPPORTED_LOCALES = ['tr', 'en'];
exports.DEFAULT_LOCALE = 'tr';
exports.FEATURE_FLAG_KEYS = {
    PAGE_VERSIONING: 'page_versioning',
    AI_SEO: 'ai_seo',
    MULTI_LANGUAGE: 'multi_language',
    ADVANCED_ANALYTICS: 'advanced_analytics',
};
