import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { MediaUsageService } from './media-usage.service';
import { WebsiteTenantService } from '../website/website-tenant.service';

@Module({
  imports: [AuditLogModule],
  controllers: [StorageController],
  providers: [StorageService, MediaUsageService, WebsiteTenantService],
  exports: [StorageService, MediaUsageService],
})
export class StorageModule {}
