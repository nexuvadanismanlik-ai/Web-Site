import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Generic page metadata update. Publish state is intentionally NOT here —
 * it is managed through the dedicated POST /pages/:id/publish and
 * /pages/:id/unpublish endpoints so the lifecycle produces its own audit events.
 */
export class UpdatePageDto {
  @ApiPropertyOptional({ example: 'About Our Company' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
