import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import type { UserRole } from '@nexuva/types';
import * as argon2 from 'argon2';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'List users (SUPER_ADMIN sees all; ADMIN sees only their company\'s users)',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user.role, user.companyId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get user by ID (company-scoped)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Create user — privilege escalation prevented; SUPER_ADMIN role requires caller to be SUPER_ADMIN',
  })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    const passwordHash = await argon2.hash(dto.password);
    return this.usersService.create(dto, passwordHash, user.id, user.role, user.companyId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Update user profile and/or role — self role-change blocked; escalation prevented; audit logged',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Assign a specific role to a user — dedicated operation with explicit audit trail',
  })
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.assignRole(id, dto.role, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Soft-delete user — self-delete blocked; last SUPER_ADMIN protected; refresh tokens revoked; audit logged',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.softDelete(id, user.id, user.role, user.companyId);
  }
}
