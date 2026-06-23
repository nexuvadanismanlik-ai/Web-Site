import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SETTING_TYPES, type SettingTypeValue } from './create-setting.dto';

export class UpdateSettingDto {
  @ApiPropertyOptional({
    description:
      'New value. Must match the current or updated type. Replaces existing value entirely.',
  })
  value?: unknown;

  @ApiPropertyOptional({ enum: SETTING_TYPES, description: 'Data type of the value' })
  @IsOptional()
  @IsEnum(SETTING_TYPES)
  type?: SettingTypeValue;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional({ description: 'Whether to expose this setting publicly' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
