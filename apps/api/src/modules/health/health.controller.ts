import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReadinessService } from './readiness.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '0.1.0',
    };
  }

  /**
   * Not public: it names the environment variables that are missing, which is
   * a map of the deployment to anyone who asks. An editor can see it, because
   * an editor is who notices that publishing stopped working.
   */
  @Get('connections')
  @Roles('CONTENT_EDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether each external connection is working, and why not' })
  connections() {
    return this.readiness.report();
  }
}
