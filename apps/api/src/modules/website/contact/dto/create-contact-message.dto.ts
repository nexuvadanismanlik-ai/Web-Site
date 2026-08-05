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
}
