import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SETTING_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'TEXT'] as const;
export type SettingTypeValue = (typeof SETTING_TYPES)[number];

export class CreateSettingDto {
  @ApiProperty({
    description: 'Unique key for this setting within the tenant. Lowercase + underscores only.',
    example: 'site_name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must be lowercase letters, digits and underscores, starting with a letter',
  })
  key!: string;

  @ApiProperty({
    description: 'The setting value. Type must match the declared type field.',
    example: 'Nexuva',
  })
  value!: unknown;

  @ApiProperty({ enum: SETTING_TYPES, description: 'Data type of the value' })
  @IsEnum(SETTING_TYPES)
  type!: SettingTypeValue;

  @ApiPropertyOptional({
    description: 'Tenant ID this setting belongs to. Omit for global settings (SUPER_ADMIN only).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Short description of the setting purpose' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this setting is exposed in the public API (default: false)',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
