import { IsBooleanString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
}

/** Columns a caller may sort by. Anything else falls back to the default. */
export const MESSAGE_SORTABLE = ['createdAt', 'name', 'email', 'isRead'] as const;
export const MESSAGE_DEFAULT_SORT = 'createdAt';
