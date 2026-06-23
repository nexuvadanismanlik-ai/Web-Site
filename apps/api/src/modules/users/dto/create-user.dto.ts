import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '@nexuva/types';

export class CreateUserDto {
  @ApiProperty({ example: 'user@nexuva.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    enum: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'],
    description:
      'Assigning SUPER_ADMIN requires the caller to be SUPER_ADMIN. ' +
      'Callers cannot assign a role higher than their own.',
  })
  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'])
  role!: UserRole;

  @ApiPropertyOptional({
    description: 'Company to scope this user to. Non-SUPER_ADMIN callers must own this company.',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
