import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { DomainType } from '@nexuva/types';

export class UpdateDomainDto {
  @ApiPropertyOptional({ enum: ['PRIMARY', 'SUBDOMAIN', 'REDIRECT', 'ALIAS'] })
  @IsOptional()
  @IsEnum(['PRIMARY', 'SUBDOMAIN', 'REDIRECT', 'ALIAS'])
  type?: DomainType;

  @ApiPropertyOptional({
    description: 'Reassign to a different tenant. SUPER_ADMIN only.',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Required when type is REDIRECT. Must be a valid URL.',
    example: 'https://nexuva.com',
  })
  @ValidateIf((o: UpdateDomainDto) => o.type === 'REDIRECT')
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'redirectTo must be a valid URL' })
  redirectTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
