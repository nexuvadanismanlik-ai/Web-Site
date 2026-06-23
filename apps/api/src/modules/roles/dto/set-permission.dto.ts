import { IsEnum, IsNotEmpty, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@nexuva/types';

export class SetPermissionDto {
  @ApiProperty({ enum: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'] })
  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'])
  role!: UserRole;

  @ApiProperty({ example: 'company' })
  @IsString()
  @IsNotEmpty()
  resource!: string;

  @ApiProperty({
    description: 'Map of action names to boolean permissions',
    example: { create: true, read: true, update: true, delete: false },
  })
  @IsObject()
  actions!: Record<string, boolean>;
}
