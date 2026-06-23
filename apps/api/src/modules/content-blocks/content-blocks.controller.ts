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
import { ContentBlocksService } from './content-blocks.service';
import { CreateContentBlockDto } from './dto/create-content-block.dto';
import { UpdateContentBlockDto } from './dto/update-content-block.dto';
import { ReorderBlocksDto } from './dto/reorder-blocks.dto';
import { VisibilityDto } from './dto/visibility.dto';
import type { UserRole } from '@nexuva/types';

interface AuthUser {
  id: string;
  role: UserRole;
  companyId?: string;
}

@ApiTags('content-blocks')
@ApiBearerAuth()
@Controller('content-blocks')
export class ContentBlocksController {
  constructor(private readonly contentBlocksService: ContentBlocksService) {}

  @Get('page/:pageId')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'List blocks for a page (admin view; ownership-checked)' })
  findByPage(@Param('pageId') pageId: string, @CurrentUser() user: AuthUser) {
    return this.contentBlocksService.findByPage(pageId, user.role, user.companyId);
  }

  @Get(':id')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Get a single content block (ownership-checked)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contentBlocksService.findById(id, user.role, user.companyId);
  }

  @Post()
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Create a content block (ownership-checked; audit logged)' })
  create(@Body() dto: CreateContentBlockDto, @CurrentUser() user: AuthUser) {
    return this.contentBlocksService.create(dto, user.id, user.role, user.companyId);
  }

  @Patch('page/:pageId/reorder')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder blocks within a page (ownership-checked; audit logged)' })
  reorder(
    @Param('pageId') pageId: string,
    @Body() dto: ReorderBlocksDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contentBlocksService.reorder(pageId, dto.blocks, user.id, user.role, user.companyId);
  }

  @Patch(':id/visibility')
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle block visibility (ownership-checked; audit logged)' })
  updateVisibility(
    @Param('id') id: string,
    @Body() dto: VisibilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contentBlocksService.updateVisibility(
      id,
      dto.isVisible,
      user.id,
      user.role,
      user.companyId,
    );
  }

  @Patch(':id')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Update block type/content (partial; ownership-checked; audit logged)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContentBlockDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contentBlocksService.update(id, dto, user.id, user.role, user.companyId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft delete a content block (ownership-checked; audit logged)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contentBlocksService.softDelete(id, user.id, user.role, user.companyId);
  }
}
