import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactMessageDto {
  // See AppValidationPipe. The other side of this endpoint is a static site
  // deployed separately, so the two are routinely out of step — and refusing a
  // whole submission over a field the API has not learned about yet loses a
  // real enquiry to show somebody an error they did not cause.
  static readonly lenientValidation = true;

  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'ayse@sirket.com' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiPropertyOptional({ example: '+90 555 000 0000' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @ApiPropertyOptional({ example: 'Kurumsal web sitesi projesi' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @ApiProperty({ example: 'Merhaba, yeni bir proje hakkında görüşmek istiyoruz.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({ example: 'Arvens Lojistik' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiPropertyOptional({ example: 'Google Ads Yönetimi' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  service?: string;

  @ApiPropertyOptional({ example: '25.000 - 50.000 TL' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  budget?: string;

  /**
   * Whether the visitor ticked the privacy notice. Recorded as a timestamp so
   * the record shows when consent was given, not merely that a box was true.
   */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  consent?: boolean;

  /**
   * Honeypot. A real visitor never sees this field, so anything in it is a bot
   * and the submission is accepted and discarded — telling a bot it failed only
   * teaches it to try again differently.
   */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  /**
   * Where this visitor came from, as their own session recorded it.
   *
   * Sent by the site rather than derived here: the campaign that brought
   * somebody in is on the landing page they arrived at, which may be several
   * clicks before the form. Untrusted like every other field from a browser,
   * so it is length-capped and never used for anything but reporting.
   */
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(120)
  utmSource?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(120)
  utmMedium?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(160)
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  landingPath?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(300)
  referrer?: string;
}
