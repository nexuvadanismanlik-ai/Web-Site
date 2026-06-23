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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { UserRole } from '@nexuva/types';

class UpdateStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'] })
  @IsEnum(['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'])
  status!: string;
}

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List products (scoped: SUPER_ADMIN sees all, others see own company)' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.productsService.findAll(user.role, user.companyId);
  }

  @Get(':id')
  @Roles('PRODUCT_MANAGER')
  @ApiOperation({ summary: 'Get product by ID (scope-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create product + linked Tenant (ADMIN+)' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.productsService.create(dto, user.id);
  }

  @Patch(':id/status')
  @Roles('PRODUCT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change product status (PRODUCT_MANAGER+)' })
  @ApiBody({ type: UpdateStatusDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.updateStatus(id, dto.status, user.id, user.role, user.companyId);
  }

  @Patch(':id')
  @Roles('PRODUCT_MANAGER')
  @ApiOperation({ summary: 'Update product name/description/status (scope-checked, audit logged)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Archive and soft delete product (SUPER_ADMIN only, audit logged)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.softDelete(id, user.id);
  }
}
