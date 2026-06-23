import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List companies (scoped: SUPER_ADMIN sees all, others see own company + subsidiaries)' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.companiesService.findAll(user.role, user.companyId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get company by ID (scope-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.companiesService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create company + linked Tenant (SUPER_ADMIN only)' })
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthUser) {
    return this.companiesService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update company (scope-checked, audit logged)' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @CurrentUser() user: AuthUser) {
    return this.companiesService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete company (SUPER_ADMIN only, audit logged)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.companiesService.softDelete(id, user.id);
  }
}
