import { Module } from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { SiteContentController } from './site-content.controller';
import { WebsiteTenantService } from '../website-tenant.service';

@Module({
  providers: [SiteContentService, WebsiteTenantService],
  controllers: [SiteContentController],
  exports: [SiteContentService],
})
export class SiteContentModule {}
