import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@nexuva/types';

export class AssignRoleDto {
  @ApiProperty({
    enum: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'],
    description:
      'New role for the target user. Caller cannot assign a role higher than their own.',
  })
  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'])
  role!: UserRole;
}
