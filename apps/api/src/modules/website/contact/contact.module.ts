import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { WebsiteTenantService } from '../website-tenant.service';

@Module({
  providers: [ContactService, WebsiteTenantService],
  controllers: [ContactController],
  exports: [ContactService],
})
export class ContactModule {}
