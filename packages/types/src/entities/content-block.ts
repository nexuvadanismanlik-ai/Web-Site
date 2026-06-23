import type { BlockType } from '../enums';

export interface ContentBlock {
  id: string;
  pageId: string;
  type: BlockType;
  content: Record<string, unknown>;
  position: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
