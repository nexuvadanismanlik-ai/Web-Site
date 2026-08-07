import { Module } from '@nestjs/common';
import { SitePreferencesService } from './site-preferences.service';
import { SitePreferencesController } from './site-preferences.controller';
import { WebsiteTenantService } from '../website-tenant.service';

/**
 * Panel preferences. Exported because the analytics reports need the timezone
 * to bucket days correctly — see the service.
 */
@Module({
  controllers: [SitePreferencesController],
  providers: [SitePreferencesService, WebsiteTenantService],
  exports: [SitePreferencesService],
})
export class SitePreferencesModule {}
