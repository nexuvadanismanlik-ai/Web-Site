import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { ProductStatus } from '@nexuva/types';

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'HIDDEN', 'BETA', 'ARCHIVED'])
  status?: ProductStatus;
}
