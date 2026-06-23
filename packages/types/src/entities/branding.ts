export interface Branding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  themePreset: string | null;
  customCss: string | null;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
