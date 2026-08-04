import { Controller, Get, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PublishService } from './publish.service';

@ApiTags('website-publish')
@ApiBearerAuth()
@Controller('website/publish')
export class PublishController {
  constructor(private readonly publish: PublishService) {}

  @Get('status')
  @Roles('CONTENT_EDITOR')
  @ApiOperation({
    summary:
      'Current publish strategy, whether it is configured, whether edits are ' +
      'waiting, and the recent publish history with outcomes.',
  })
  @ApiQuery({ name: 'tenant', required: false })
  status(@Query('tenant') tenant?: string) {
    return this.publish.getStatus(tenant);
  }

  @Post()
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish the current content to the public website. With the deploy-hook ' +
      'strategy this triggers a rebuild; with revalidate it invalidates the cache.',
  })
  @ApiQuery({ name: 'tenant', required: false })
  publishNow(@CurrentUser('id') userId: string, @Query('tenant') tenant?: string) {
    // Attributed, so the history can answer who published what.
    return this.publish.publish(userId, tenant);
  }
}
