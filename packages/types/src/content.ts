// ============================================================
// Site content model — powers the public website and is fully
// editable from the admin panel (persisted to content/site.json).
// ============================================================

/** A string localized for each supported locale. */
export interface Localized {
  tr: string;
  en: string;
}

export interface LinkItem {
  label: Localized;
  href: string;
}

export interface NavItem {
  label: Localized;
  href: string;
}

export interface SocialLink {
  /** lucide-react icon name, e.g. "linkedin" */
  icon: string;
  label: string;
  href: string;
}

export interface BrandConfig {
  siteName: string;
  logoText: string;
  /**
   * Uploaded logo. When empty the header and footer fall back to the initial
   * of `logoText` in a brand-coloured tile, which is what they did before an
   * upload was possible at all.
   */
  logoUrl?: string;
  tagline: Localized;
  /** Site-wide color scheme, editable from the admin panel. */
  theme: 'light' | 'dark';
  /** Hex color that drives the --brand CSS variable / primary palette. */
  primaryColor: string;
  /** Hex color that drives the --accent CSS variable. */
  accentColor: string;
  email: string;
  phone: string;
  address: Localized;
  social: SocialLink[];
}

export interface HeroMetric {
  value: string;
  label: Localized;
}

export interface HeroContent {
  badge: Localized;
  titleLead: Localized;
  titleHighlight: Localized;
  subtitle: Localized;
  primaryCta: LinkItem;
  secondaryCta: LinkItem;
  metrics: HeroMetric[];
}

export interface ServiceItem {
  id: string;
  /** lucide-react icon name */
  icon: string;
  title: Localized;
  description: Localized;
  features: Localized[];
}

export interface StatItem {
  id: string;
  value: number;
  suffix: string;
  prefix?: string;
  label: Localized;
}

export interface AboutHighlight {
  icon: string;
  title: Localized;
  text: Localized;
}

export interface AboutContent {
  badge: Localized;
  title: Localized;
  paragraphs: Localized[];
  highlights: AboutHighlight[];
}

export interface ReferenceItem {
  id: string;
  name: string;
  category: Localized;
}

export interface TestimonialItem {
  id: string;
  quote: Localized;
  author: string;
  role: Localized;
  company: string;
  rating: number;
}

export interface ProcessStep {
  id: string;
  title: Localized;
  description: Localized;
}

export interface CtaContent {
  title: Localized;
  subtitle: Localized;
  button: LinkItem;
}

export interface ContactContent {
  badge: Localized;
  title: Localized;
  description: Localized;
  email: string;
  phone: string;
  address: Localized;
}

export interface FooterColumn {
  title: Localized;
  links: LinkItem[];
}

export interface FooterContent {
  about: Localized;
  columns: FooterColumn[];
  copyright: Localized;
}

/**
 * Everything the site puts in <head>.
 *
 * One document rather than a field per page, because the site is five pages
 * and a per-page table would be five rows that are empty nine times out of ten.
 * Per-page titles come from the page itself through the title template; what is
 * here is the site-wide answer and the defaults every page inherits.
 *
 * Every field is optional and every field has a sensible fallback derived from
 * the brand and hero content, so an empty SEO section leaves the site exactly
 * as it was rather than stripping its title.
 */
export interface SeoContent {
  /** Overrides the generated "Brand — tagline". */
  title: string;
  description: string;
  /** Comma-separated in the panel, an array on the wire. */
  keywords: string[];
  canonical: string;
  /** true adds noindex,nofollow. Off by default, and loudly labelled. */
  noIndex: boolean;

  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  /** 'summary' | 'summary_large_image' */
  twitterCard: string;
  twitterSite: string;

  favicon: string;
  appleTouchIcon: string;
  /** Colour the browser paints its chrome with on mobile. */
  themeColor: string;
}

export interface SectionMeta {
  badge: Localized;
  title: Localized;
  subtitle: Localized;
}

export interface SiteContent {
  brand: BrandConfig;
  seo: SeoContent;
  nav: NavItem[];
  hero: HeroContent;
  logos: string[];
  servicesMeta: SectionMeta;
  services: ServiceItem[];
  stats: StatItem[];
  about: AboutContent;
  referencesMeta: SectionMeta;
  references: ReferenceItem[];
  testimonialsMeta: SectionMeta;
  testimonials: TestimonialItem[];
  processMeta: SectionMeta;
  process: ProcessStep[];
  cta: CtaContent;
  contact: ContactContent;
  footer: FooterContent;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}
