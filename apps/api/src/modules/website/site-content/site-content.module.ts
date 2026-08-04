import { Module } from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { SiteContentController } from './site-content.controller';
import { WebsiteTenantService } from '../website-tenant.service';
import { PublishModule } from '../publish/publish.module';

@Module({
  imports: [PublishModule],
  providers: [SiteContentService, WebsiteTenantService],
  controllers: [SiteContentController],
  exports: [SiteContentService],
})
export class SiteContentModule {}
