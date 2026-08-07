import { Module } from '@nestjs/common';
import { SiteContentModule } from './site-content/site-content.module';
import { ContactModule } from './contact/contact.module';
import { PublishModule } from './publish/publish.module';
import { ContentVersionModule } from './versions/content-version.module';
import { SitePreferencesModule } from './preferences/site-preferences.module';

/**
 * Website domain — everything that powers the public marketing site.
 *
 * Grouped as a namespace module so sibling domains (marketing, analytics,
 * Nexuva Core) can be added alongside without touching the site CMS.
 */
@Module({
  imports: [SiteContentModule, ContactModule, PublishModule, ContentVersionModule, SitePreferencesModule],
  exports: [SiteContentModule, ContactModule, PublishModule, ContentVersionModule, SitePreferencesModule],
})
export class WebsiteModule {}
