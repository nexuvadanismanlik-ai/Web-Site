import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({ description: 'New human-readable name' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({
    description: 'Replacement JSON configuration object (max 10 KB). Replaces the entire config.',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
