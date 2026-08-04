import { Controller, Get, Post, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response.decorator';
import { ContentVersionService } from './content-version.service';

@ApiTags('website-versions')
@ApiBearerAuth()
@Controller('website/versions')
export class ContentVersionController {
  constructor(private readonly versions: ContentVersionService) {}

  @Get()
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'Publish history, newest first. Snapshots are omitted.' })
  @ApiQuery({ name: 'tenant', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(@Query('tenant') tenant?: string, @Query('limit') limit?: string) {
    return this.versions.list(tenant, limit ? Number.parseInt(limit, 10) : undefined);
  }

  @Get(':number')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({ summary: 'The full content document of one version' })
  @ApiQuery({ name: 'tenant', required: false })
  snapshot(
    @Param('number', ParseIntPipe) number: number,
    @Query('tenant') tenant?: string,
  ) {
    return this.versions.getSnapshot(number, tenant);
  }

  @Post(':number/restore')
  @Roles('CONTENT_EDITOR')
  @ResponseMessage('Sürüm geri yüklendi ve yayınlandı')
  @ApiOperation({
    summary:
      'Restores a version: writes it back over the draft and publishes it as a ' +
      'new version, so the history stays append-only and the rollback itself ' +
      'can be undone.',
  })
  @ApiQuery({ name: 'tenant', required: false })
  restore(
    @Param('number', ParseIntPipe) number: number,
    @CurrentUser('id') userId: string,
    @Query('tenant') tenant?: string,
  ) {
    return this.versions.restore(number, userId, tenant);
  }
}
