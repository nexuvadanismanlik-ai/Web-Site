import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '@nexuva/types';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    enum: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'],
    description:
      'Role assignment is subject to privilege escalation rules. ' +
      'A caller cannot assign a role higher than their own.',
  })
  @IsOptional()
  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'])
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
