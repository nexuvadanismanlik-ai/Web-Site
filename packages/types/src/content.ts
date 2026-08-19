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
  /** The button in the header. Part of the site chrome, like the logo. */
  headerCta?: LinkItem;
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
  /**
   * The composition beside the headline — a product screen, a photograph, a
   * mockup. Without one the first screen is a paragraph on a gradient, which
   * is what every template looks like.
   */
  image?: string;
  /** What the image shows, for screen readers and for a failed load. */
  imageAlt?: string;
  /** Optional atmospheric backdrop behind the whole section. */
  backgroundImage?: string;
}

export interface ServiceItem {
  id: string;
  /** lucide-react icon name */
  icon: string;
  title: Localized;
  description: Localized;
  features: Localized[];
  /** Chosen from the media library. Optional: the icon remains the fallback. */
  imageUrl?: string;
  imageAlt?: string;
  /** Sends a reader somewhere specific. Hidden when the label is empty. */
  cta?: LinkItem;
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
  /** The team, the office, the work — anything that is not another paragraph. */
  image?: string;
  imageAlt?: string;
  /** Optional way forward from the section. Hidden when the label is empty. */
  cta?: LinkItem;
}

export interface ReferenceItem {
  id: string;
  name: string;
  category: Localized;
  /** Their mark, from the media library. */
  logoUrl?: string;
  /** What was done for them. A logo wall proves nothing on its own. */
  description?: Localized;
  /** Their own site, so a reader can check the claim. */
  website?: string;
  /** A screenshot or photograph of the work. */
  imageUrl?: string;
}

export interface TestimonialItem {
  id: string;
  quote: Localized;
  author: string;
  role: Localized;
  company: string;
  rating: number;
  /** Their photograph. Initials stand in until there is one. */
  avatarUrl?: string;
}

export interface ProcessStep {
  id: string;
  title: Localized;
  description: Localized;
  /** lucide-react icon name. Falls back to the step number. */
  icon?: string;
  imageUrl?: string;
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
  /** The last way forward on the page. Hidden when the label is empty. */
  cta?: LinkItem;
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

/**
 * One brand in the trust strip.
 *
 * A name alone renders as text, which is what a placeholder looks like. The
 * mark is optional so a client can be listed before their logo is to hand.
 */
export interface LogoItem {
  name: string;
  imageUrl?: string;
}

export interface SectionMeta {
  badge: Localized;
  title: Localized;
  subtitle: Localized;
}

/**
 * LogiOps — the product page.
 *
 * A section of its own rather than another service entry, because a product
 * needs a page that argues for it: the problem it addresses, how it works,
 * what it reports. Everything here is panel-managed, and deliberately so: the
 * temptation with a product page is to write capability claims into the code,
 * and a claim in code is a claim nobody can correct without a deploy.
 */
export interface LogiOpsContent {
  badge: Localized;
  titleLead: Localized;
  titleHighlight: Localized;
  subtitle: Localized;
  primaryCta: LinkItem;
  secondaryCta: LinkItem;

  /** What is difficult before anything changes. */
  problemsTitle: Localized;
  problems: { title: Localized; body: Localized }[];

  /** The approach, in the order somebody would meet it. */
  approachTitle: Localized;
  approach: { title: Localized; body: Localized }[];

  /** How the work runs once it is in place. */
  flowTitle: Localized;
  flow: { title: Localized; body: Localized }[];

  /** A screenshot or diagram, from the media library. */
  image?: string;
  imageAlt?: string;

  closingTitle: Localized;
  closingBody: Localized;
}

/**
 * One destination the site sends somebody to, with the words on the control
 * that sends them.
 *
 * The address and the label travel together on purpose. They were going to be
 * two fields on two screens — the URL treated as configuration, the label as
 * copy — and that split is how a button ends up saying "Giriş Yap" while
 * pointing at a registration form. Whoever changes where it goes is the person
 * who needs to change what it promises.
 */
export interface LinkTarget {
  /**
   * Where it goes. Absolute for another system, or a path beginning with `/`
   * for somewhere on this site.
   *
   * Empty is a meaningful value: it hides whatever uses this rather than
   * rendering a control that goes nowhere. A dead button is worse than an
   * absent one — it costs the visitor a click to learn the site is broken.
   */
  url: string;
  /** What the control says. */
  label: Localized;
  /** A line under the label, where the control has room for one. */
  description?: Localized;
  /**
   * Open in a new tab. Sensible for another system — a visitor sent away from
   * a page they were reading, with no way back, usually does not come back.
   */
  newTab: boolean;
  /** Off hides the control without losing the address. */
  enabled: boolean;
}

/**
 * Every destination outside this site, in one document.
 *
 * These were going to be constants in the code. They are content instead, for
 * a reason worth stating: an address is the single most likely thing on a site
 * to become wrong, it becomes wrong without any code changing, and the person
 * who finds out is a customer who could not get in. Keeping them here means
 * the fix is a field and a publish.
 *
 * Named keys rather than a free list. A registry the panel can label and
 * explain is more useful than rows of anonymous URLs, and the site can then
 * refer to a destination by meaning — "where a member signs in" — rather than
 * by position in an array.
 */
export interface LinksContent {
  /** The LogiOps application's front door. */
  logiopsApp: LinkTarget;
  /** Where a company that already has an account signs in. */
  logiopsLogin: LinkTarget;
  /**
   * Where a company that does not have one applies.
   *
   * Defaults to a form on this site rather than to the application, because
   * LogiOps has no self-service sign-up: requests reach a person. Sending
   * somebody to a login screen they cannot use is the failure this avoids.
   */
  logiopsRegister: LinkTarget;
}

export interface SiteContent {
  brand: BrandConfig;
  links: LinksContent;
  seo: SeoContent;
  uiText: UiText;
  integrations: IntegrationsContent;
  nav: NavItem[];
  hero: HeroContent;
  logos: LogoItem[];
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
  logiops: LogiOpsContent;
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

/**
 * The site's own words that are not part of any section: button labels,
 * form fields, the empty and error states.
 *
 * These were written into the code, which meant the sentence a visitor reads
 * when their message fails to send could only be changed by a developer. They
 * live in one document rather than scattered across the sections that use
 * them, because they are chrome — the same words appear on several pages.
 *
 * Every field is optional and the site keeps its current wording as the
 * fallback, so an empty document changes nothing and a half-filled one changes
 * only what was filled in.
 */
export interface UiText {
  menu?: string;
  close?: string;
  /** The header button. Its destination lives on brand.headerCta. */
  getStarted?: string;
  trustedBy?: string;
  backHome?: string;
  allServices?: string;

  formName?: string;
  formEmail?: string;
  formPhone?: string;
  formSubject?: string;
  formCompany?: string;
  formService?: string;
  formBudget?: string;
  formMessage?: string;
  formSubmit?: string;
  formSending?: string;
  formSuccess?: string;
  formError?: string;
  formInvalid?: string;
  formRateLimit?: string;
  formConsent?: string;

  namePlaceholder?: string;
  emailPlaceholder?: string;
  phonePlaceholder?: string;
  subjectPlaceholder?: string;
  companyPlaceholder?: string;
  messagePlaceholder?: string;
}

/**
 * Measurement and advertising tags.
 *
 * Held as content rather than as server configuration because these are
 * marketing decisions, not deployment ones: the person who opens a Google Ads
 * account is the person who should be able to connect it, and an environment
 * variable means a redeploy and somebody with access to the hosting dashboard.
 *
 * Only public identifiers live here. They are printed into the page for every
 * visitor to read, which is what they are for — a Pixel ID is not a secret.
 * Anything that is a secret (a Conversions API token) is stored server-side and
 * never travels to the browser.
 */
export interface IntegrationsContent {
  /** G-XXXXXXXXXX */
  ga4MeasurementId?: string;
  /** GTM-XXXXXXX */
  gtmContainerId?: string;
  /** Meta Pixel numeric id */
  metaPixelId?: string;
  /** AW-XXXXXXXXX */
  googleAdsId?: string;
  /** AW-XXXXXXXXX/AbC-D_efGh — the conversion label for a form submission. */
  googleAdsConversionLabel?: string;
  /** The content of google-site-verification, without the meta tag. */
  googleSiteVerification?: string;
  /** Bing Webmaster Tools verification. */
  bingSiteVerification?: string;
  /** Yandex Webmaster verification. */
  yandexVerification?: string;
  /** Microsoft Clarity project id. */
  clarityProjectId?: string;

  /**
   * Off by default. Tags load only when this is on, so a half-entered
   * configuration never reaches a visitor.
   */
  enabled?: boolean;
}
