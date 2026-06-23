import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeatureFlagDto {
  @ApiProperty({
    description: 'Unique key for this flag within the tenant. Lowercase + underscores only.',
    example: 'awb_module',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must be lowercase letters, digits and underscores, starting with a letter',
  })
  key!: string;

  @ApiProperty({ description: 'Human-readable name', example: 'AWB Module' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional({ description: 'Short description of what this flag controls' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({
    description: 'Tenant ID this flag belongs to. Omit for global flags (SUPER_ADMIN only).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'JSON configuration object for the flag (max 10 KB)',
    example: { limit: 100, enabledRegions: ['TR', 'EU'] },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Initial enabled state (defaults to false)' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
