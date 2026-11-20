import { Module } from '@nestjs/common';
import { PublishService } from './publish.service';
import { IndexNowService } from './indexnow.service';
import { PublishController } from './publish.controller';
import { WebsiteTenantService } from '../website-tenant.service';
import { SiteContentModule } from '../site-content/site-content.module';
import { ContentVersionModule } from '../versions/content-version.module';

/**
 * Carrying published content to the live site.
 *
 * Sits above content and versioning: a publish freezes a version of the draft
 * and then asks the host to rebuild.
 */
@Module({
  imports: [SiteContentModule, ContentVersionModule],
  providers: [PublishService, IndexNowService, WebsiteTenantService],
  controllers: [PublishController],
  exports: [PublishService],
})
export class PublishModule {}
