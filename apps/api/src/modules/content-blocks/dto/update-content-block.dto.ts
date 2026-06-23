import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { BlockType } from '@nexuva/types';

const BLOCK_TYPES = [
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

/**
 * Partial update. Only supplied fields are written; omitted fields are
 * preserved. Position is changed only via the reorder endpoint, and
 * visibility only via the visibility endpoint — neither is editable here.
 */
export class UpdateContentBlockDto {
  @ApiPropertyOptional({ enum: BLOCK_TYPES })
  @IsOptional()
  @IsEnum(BLOCK_TYPES, { message: `type must be one of: ${BLOCK_TYPES.join(', ')}` })
  type?: BlockType;

  @ApiPropertyOptional({
    description: 'Replacement content payload. Max 100 KB serialized.',
  })
  @IsOptional()
  @IsObject({ message: 'content must be a JSON object' })
  content?: Record<string, unknown>;
}
