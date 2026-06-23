export const TENANT_TYPES = ['HOLDING', 'PRODUCT'] as const;

export const COMPANY_TYPES = ['HOLDING', 'SUBSIDIARY'] as const;

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'] as const;

export const DOMAIN_TYPES = ['PRIMARY', 'SUBDOMAIN', 'REDIRECT', 'ALIAS'] as const;

export const BLOCK_TYPES = [
  'HERO',
  'TEXT',
  'IMAGE',
  'GALLERY',
  'CTA',
  'FEATURES',
  'TESTIMONIALS',
  'FAQ',
  'CUSTOM',
] as const;

export const NOTIFICATION_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'SYSTEM'] as const;

export const SUPPORTED_LOCALES = ['tr', 'en'] as const;

export const DEFAULT_LOCALE = 'tr';

export const FEATURE_FLAG_KEYS = {
  PAGE_VERSIONING: 'page_versioning',
  AI_SEO: 'ai_seo',
  MULTI_LANGUAGE: 'multi_language',
  ADVANCED_ANALYTICS: 'advanced_analytics',
} as const;
