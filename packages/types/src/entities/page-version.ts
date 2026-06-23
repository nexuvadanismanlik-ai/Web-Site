export interface PageVersion {
  id: string;
  pageId: string;
  versionNumber: number;
  title: string;
  contentSnapshot: Record<string, unknown>[];
  seoSnapshot: Record<string, unknown> | null;
  createdById: string;
  createdAt: Date;
}
