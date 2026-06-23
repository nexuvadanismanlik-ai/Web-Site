import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ProductStatus } from '@nexuva/types';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'])
  status?: ProductStatus;
}
