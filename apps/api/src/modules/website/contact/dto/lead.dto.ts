import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';

export class SetLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status!: LeadStatus;
}

export class AssignLeadDto {
  @ApiPropertyOptional({ description: 'User id, or null to take the lead back' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  userId?: string | null;
}

export class AddLeadNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class SetLeadTagsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags!: string[];
}
