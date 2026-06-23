import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const TWITTER_CARD_TYPES = [
  'summary',
  'summary_large_image',
  'app',
  'player',
] as const;

export type TwitterCardType = (typeof TWITTER_CARD_TYPES)[number];

export class UpsertSeoDto {
  @ApiPropertyOptional({
    description: 'Page title shown in search results. Recommended max 60 characters.',
    maxLength: 70,
    example: 'Nexuva — Corporate Operating System',
  })
  @IsOptional()
  @IsString()
  @MaxLength(70, { message: 'metaTitle must not exceed 70 characters' })
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'Page description shown in search results. Recommended max 155 characters.',
    maxLength: 160,
    example: 'Manage your digital holding from a single platform.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'metaDescription must not exceed 160 characters' })
  metaDescription?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'SEO keywords. Max 20 keywords, each max 50 characters.',
    example: ['saas', 'holding', 'corporate-os'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'keywords must not exceed 20 items' })
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: 'Each keyword must not exceed 50 characters' })
  keywords?: string[];

  @ApiPropertyOptional({
    description: 'Open Graph image. Must be a valid URL.',
    example: 'https://nexuva.com/og-image.png',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'ogImage must be a valid URL' })
  ogImage?: string;

  @ApiPropertyOptional({
    description: 'Open Graph title. Max 95 characters.',
    maxLength: 95,
  })
  @IsOptional()
  @IsString()
  @MaxLength(95, { message: 'ogTitle must not exceed 95 characters' })
  ogTitle?: string;

  @ApiPropertyOptional({
    description: 'Open Graph description. Max 200 characters.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'ogDescription must not exceed 200 characters' })
  ogDescription?: string;

  @ApiPropertyOptional({
    enum: TWITTER_CARD_TYPES,
    description: 'Twitter Card type.',
    example: 'summary_large_image',
  })
  @IsOptional()
  @IsIn(TWITTER_CARD_TYPES, {
    message: `twitterCard must be one of: ${TWITTER_CARD_TYPES.join(', ')}`,
  })
  twitterCard?: TwitterCardType;

  @ApiPropertyOptional({
    description: 'Canonical URL for this page. Must be a valid URL.',
    example: 'https://nexuva.com/about',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'canonicalUrl must be a valid URL' })
  canonicalUrl?: string;

  @ApiPropertyOptional({
    description: 'Set true to instruct search engines not to index this page.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;
}
