import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { PaginatedResponse } from '@nexuva/types';

/**
 * The query every growing list endpoint accepts.
 *
 * Not every list: an ordered content collection holds a handful of rows that
 * the editors save as one array, and paginating it would break that model for
 * no benefit. The rule is that a list which can grow without bound — messages,
 * leads, media, posts — must use this, so a client never has to learn a second
 * way to ask for page two.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Free-text search across the fields the endpoint declares' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/** Ceilings applied when a caller asks for something unreasonable. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface ResolvedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
  search: string;
  orderBy: Record<string, 'asc' | 'desc'>;
}

/**
 * Turns a query into the arguments a Prisma call needs.
 *
 * `sortBy` is checked against a list the endpoint provides rather than passed
 * through: it reaches an orderBy clause, and an unchecked column name there is
 * a caller choosing how the database sorts.
 */
export function resolvePagination(
  query: PaginationQueryDto,
  options: { sortable: readonly string[]; defaultSort: string },
): ResolvedPagination {
  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const column =
    query.sortBy && options.sortable.includes(query.sortBy) ? query.sortBy : options.defaultSort;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    search: query.search?.trim() ?? '',
    orderBy: { [column]: query.sortOrder ?? 'desc' },
  };
}

/** Wraps rows and their count in the shared list shape. */
export function paginated<T>(
  items: T[],
  total: number,
  resolved: ResolvedPagination,
): PaginatedResponse<T> {
  return {
    data: items,
    meta: {
      total,
      page: resolved.page,
      limit: resolved.limit,
      totalPages: Math.max(Math.ceil(total / resolved.limit), 1),
    },
  };
}
