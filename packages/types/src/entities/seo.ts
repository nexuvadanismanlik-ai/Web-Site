export interface SeoSetting {
  id: string;
  pageId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterCard: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  createdAt: Date;
  updatedAt: Date;
}
