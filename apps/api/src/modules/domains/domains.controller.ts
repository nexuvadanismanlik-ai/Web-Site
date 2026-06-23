import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('domains')
@ApiBearerAuth()
@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List domains (SUPER_ADMIN sees all; others see only their company\'s tenant domains)',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.domainsService.findAll(user.role, user.companyId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get domain by ID (ownership-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.domainsService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Register a domain and assign to tenant (caller must own the target tenant; audit logged)',
  })
  create(@Body() dto: CreateDomainDto, @CurrentUser() user: AuthUser) {
    return this.domainsService.create(dto, user.id, user.role, user.companyId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Update domain settings (ownership-checked; tenantId reassignment requires SUPER_ADMIN; audit logged)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDomainDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.domainsService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Permanently remove domain (SUPER_ADMIN only; audit logged)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.domainsService.remove(id, user.id);
  }
}
