import { Module } from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { SiteContentController } from './site-content.controller';
import { WebsiteTenantService } from '../website-tenant.service';
import { WebsiteStateService } from '../website-state.service';

/**
 * Reading and writing the site's content.
 *
 * Deliberately does not depend on the publish module: content writing only
 * needs to record that the draft moved, which WebsiteStateService owns.
 * Publishing depends on this module, not the other way round.
 */
@Module({
  providers: [SiteContentService, WebsiteTenantService, WebsiteStateService],
  controllers: [SiteContentController],
  exports: [SiteContentService, WebsiteStateService],
})
export class SiteContentModule {}
