import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DomainType } from '@nexuva/types';

export class CreateDomainDto {
  @ApiProperty({ example: 'app.nexuva.com' })
  @IsString()
  @IsNotEmpty()
  domainName!: string;

  @ApiProperty({ description: 'ID of the Tenant this domain resolves to' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiPropertyOptional({ enum: ['PRIMARY', 'SUBDOMAIN', 'REDIRECT', 'ALIAS'], default: 'PRIMARY' })
  @IsOptional()
  @IsEnum(['PRIMARY', 'SUBDOMAIN', 'REDIRECT', 'ALIAS'])
  type?: DomainType;

  @ApiPropertyOptional({
    description: 'Required when type is REDIRECT. Must be a valid URL.',
    example: 'https://nexuva.com',
  })
  @ValidateIf((o: CreateDomainDto) => o.type === 'REDIRECT')
  @IsNotEmpty({ message: 'redirectTo is required when type is REDIRECT' })
  @IsUrl({ require_tld: false }, { message: 'redirectTo must be a valid URL' })
  @ValidateIf((o: CreateDomainDto) => o.redirectTo !== undefined)
  @IsString()
  redirectTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
