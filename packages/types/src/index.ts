// Enums
export * from './enums';

// Entities
export type { Tenant, TenantContext } from './entities/tenant';
export type { Company } from './entities/company';
export type { Product } from './entities/product';
export type { Domain } from './entities/domain';
export type { Page } from './entities/page';
export type { ContentBlock } from './entities/content-block';
export type { PageVersion } from './entities/page-version';
export type { SeoSetting } from './entities/seo';
export type { Branding } from './entities/branding';
export type { User, UserSafe } from './entities/user';
export type { FeatureFlag } from './entities/feature-flag';
export type { SystemSetting } from './entities/setting';
export type { Notification } from './entities/notification';
export type { AuditLog, ActivityLog } from './entities/audit-log';

// API shapes
export type { PaginationQuery, PaginatedResponse } from './api/pagination';
export type { ApiResponse, ApiError, ApiErrorCode } from './api/response';

// Tenant
export type { TenantResolutionResult } from './tenant/context';

// Site content (public website / admin-managed)
export type {
  Localized,
  LinkItem,
  NavItem,
  SocialLink,
  BrandConfig,
  HeroMetric,
  HeroContent,
  ServiceItem,
  StatItem,
  AboutHighlight,
  AboutContent,
  ReferenceItem,
  TestimonialItem,
  ProcessStep,
  CtaContent,
  ContactContent,
  FooterColumn,
  FooterContent,
  SectionMeta,
  SeoContent,
  SiteContent,
  ContactMessage,
} from './content';
