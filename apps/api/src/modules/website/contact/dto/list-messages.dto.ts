import { IsBooleanString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/**
 * Enquiries grow without bound, so this list follows the shared paging,
 * searching and sorting contract and adds only what is specific to it.
 */
export class ListMessagesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by read state: "true" or "false"' })
  @IsOptional()
  @IsBooleanString()
  isRead?: string;

  @ApiPropertyOptional({ enum: LeadStatus, description: 'Filter to one pipeline stage' })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'User id, or "none" for unassigned leads' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assignedTo?: string;
}

/** Columns a caller may sort by. Anything else falls back to the default. */
export const MESSAGE_SORTABLE = [
  'createdAt',
  'lastActionAt',
  'name',
  'email',
  'isRead',
  'status',
] as const;
export const MESSAGE_DEFAULT_SORT = 'createdAt';
