import type { ContentBlock } from './content-block';
import type { SeoSetting } from './seo';
import type { PageVersion } from './page-version';

export interface Page {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  isPublished: boolean;
  locale: string;
  currentVersion: number;
  contentBlocks: ContentBlock[];
  seoSetting: SeoSetting | null;
  versions: PageVersion[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
