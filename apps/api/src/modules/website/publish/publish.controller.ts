import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
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
      'Current publish strategy, whether it is configured, and whether edits are ' +
      'waiting to be published.',
  })
  status() {
    return this.publish.getStatus();
  }

  @Post()
  @Roles('CONTENT_EDITOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish the current content to the public website. With the deploy-hook ' +
      'strategy this triggers a rebuild; with revalidate it invalidates the cache.',
  })
  publishNow() {
    return this.publish.publish();
  }
}
