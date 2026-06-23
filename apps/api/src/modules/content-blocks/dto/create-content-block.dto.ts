import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateContentBlockDto {
  @ApiProperty({ description: 'ID of the page this block belongs to' })
  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @ApiProperty({ enum: BLOCK_TYPES })
  @IsEnum(BLOCK_TYPES, { message: `type must be one of: ${BLOCK_TYPES.join(', ')}` })
  type!: BlockType;

  @ApiProperty({
    description: 'Block content payload as a JSON object. Max 100 KB serialized.',
    example: { title: 'Welcome', description: 'Digital transformation' },
  })
  @IsObject({ message: 'content must be a JSON object' })
  content!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Position in the page. Appended to the end when omitted.',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
