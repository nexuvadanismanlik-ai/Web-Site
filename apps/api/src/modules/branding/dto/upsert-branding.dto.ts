import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const THEME_PRESETS = ['light', 'dark', 'corporate', 'minimal', 'vibrant'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export class UpsertBrandingDto {
  @ApiPropertyOptional({
    description: 'R2 storage key or public URL for the logo image',
    example: 'https://pub.r2.dev/nexuva/logo.png',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'logoUrl must be a valid URL' })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'R2 storage key or public URL for the favicon',
    example: 'https://pub.r2.dev/nexuva/favicon.ico',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'faviconUrl must be a valid URL' })
  faviconUrl?: string;

  @ApiPropertyOptional({ example: '#4F46E5', description: 'Hex color code' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'primaryColor must be a 6-digit hex color (e.g. #4F46E5)' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#7C3AED', description: 'Hex color code' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'secondaryColor must be a 6-digit hex color' })
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#06B6D4', description: 'Hex color code' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'accentColor must be a 6-digit hex color' })
  accentColor?: string;

  @ApiPropertyOptional({ example: 'Space Grotesk' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontHeading?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontBody?: string;

  @ApiPropertyOptional({
    enum: THEME_PRESETS,
    example: 'corporate',
  })
  @IsOptional()
  @IsIn(THEME_PRESETS, {
    message: `themePreset must be one of: ${THEME_PRESETS.join(', ')}`,
  })
  themePreset?: ThemePreset;

  @ApiPropertyOptional({
    description: 'Raw CSS injected into the tenant site. Max 50 KB.',
    maxLength: 51200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(51200, { message: 'customCss must not exceed 50 KB' })
  customCss?: string;

  @ApiPropertyOptional({
    description: 'Free-form JSON configuration for advanced theming',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
