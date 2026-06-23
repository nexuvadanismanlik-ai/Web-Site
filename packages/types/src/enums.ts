export type TenantType = 'HOLDING' | 'PRODUCT';

export type CompanyType = 'HOLDING' | 'SUBSIDIARY';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'HIDDEN' | 'BETA' | 'ARCHIVED';

export type DomainType = 'PRIMARY' | 'SUBDOMAIN' | 'REDIRECT' | 'ALIAS';

export type BlockType =
  | 'HERO'
  | 'TEXT'
  | 'IMAGE'
  | 'GALLERY'
  | 'CTA'
  | 'FEATURES'
  | 'TESTIMONIALS'
  | 'FAQ'
  | 'CUSTOM';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'PRODUCT_MANAGER'
  | 'CONTENT_EDITOR'
  | 'VIEWER';

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'SYSTEM';
