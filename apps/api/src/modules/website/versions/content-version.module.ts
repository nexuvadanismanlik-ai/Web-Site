import { Module } from '@nestjs/common';
import { ContentVersionService } from './content-version.service';
import { ContentVersionController } from './content-version.controller';
import { WebsiteTenantService } from '../website-tenant.service';
import { SiteContentModule } from '../site-content/site-content.module';

/**
 * Publish history and rollback.
 *
 * Exported because the publish flow freezes a version before triggering a
 * deploy, and the public content endpoint reads the published one.
 */
@Module({
  imports: [SiteContentModule],
  providers: [ContentVersionService, WebsiteTenantService],
  controllers: [ContentVersionController],
  exports: [ContentVersionService],
})
export class ContentVersionModule {}
