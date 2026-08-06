import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailSettingsService } from './mail-settings.service';
import { MailTemplateService } from './mail-template.service';
import { MailController } from './mail.controller';
import { WebsiteTenantService } from '../website/website-tenant.service';

@Module({
  controllers: [MailController],
  providers: [EmailService, MailSettingsService, MailTemplateService, WebsiteTenantService],
  exports: [EmailService, MailSettingsService, MailTemplateService],
})
export class EmailModule {}
