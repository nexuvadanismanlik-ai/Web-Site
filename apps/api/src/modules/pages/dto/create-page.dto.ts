import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Mirrors SUPPORTED_LOCALES in @nexuva/shared. Hardcoded here because
// class-validator decorators require a literal array at decoration time.
const SUPPORTED_LOCALES = ['tr', 'en'] as const;

// kebab-case slug: lowercase alphanumerics separated by single hyphens.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePageDto {
  @ApiProperty({ description: 'Tenant that owns this page. Caller must own this tenant.' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty({
    description: 'URL slug (kebab-case). Unique per tenant + locale.',
    example: 'about-us',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_REGEX, {
    message: 'slug must be kebab-case (lowercase letters, numbers, single hyphens)',
  })
  slug!: string;

  @ApiProperty({ example: 'About Us' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'tr' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES, { message: `locale must be one of: ${SUPPORTED_LOCALES.join(', ')}` })
  locale?: string;
}
