import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { WebsiteTenantService } from '../website/website-tenant.service';
import { SitePreferencesModule } from '../website/preferences/site-preferences.module';

@Module({
  // Reports need the tenant's timezone to decide where a day starts.
  imports: [SitePreferencesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, WebsiteTenantService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
