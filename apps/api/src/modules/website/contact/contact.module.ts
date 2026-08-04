import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { WebsiteTenantService } from '../website-tenant.service';
import { EmailModule } from '../../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [ContactService, WebsiteTenantService],
  controllers: [ContactController],
  exports: [ContactService],
})
export class ContactModule {}
