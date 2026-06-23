import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesService } from './roles.service';
import { SetPermissionDto } from './dto/set-permission.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
}

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('hierarchy')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get role hierarchy and inheritance chain' })
  getHierarchy() {
    return this.rolesService.getHierarchy();
  }

  @Get('permissions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get full permission matrix (SUPER_ADMIN only)' })
  getMatrix() {
    return this.rolesService.getMatrix();
  }

  @Get('permissions/:role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get permissions for a specific role' })
  @ApiParam({ name: 'role', enum: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'] })
  getForRole(@Param('role') role: UserRole) {
    return this.rolesService.getForRole(role);
  }

  @Put('permissions')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Set (upsert) a permission for a role+resource combination (SUPER_ADMIN only; audit logged)',
  })
  setPermission(@Body() dto: SetPermissionDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.setPermission(dto.role, dto.resource, dto.actions, user.id);
  }

  @Delete('permissions/:role/:resource')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a stored permission record (SUPER_ADMIN only; audit logged)',
  })
  @ApiParam({ name: 'role', enum: ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'CONTENT_EDITOR', 'VIEWER'] })
  removePermission(
    @Param('role') role: UserRole,
    @Param('resource') resource: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rolesService.removePermission(role, resource, user.id);
  }
}
