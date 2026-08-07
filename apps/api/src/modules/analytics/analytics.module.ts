import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { WebsiteTenantService } from '../website/website-tenant.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, WebsiteTenantService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
