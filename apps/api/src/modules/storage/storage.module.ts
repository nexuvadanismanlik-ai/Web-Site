import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { WebsiteTenantService } from '../website/website-tenant.service';

@Module({
  imports: [AuditLogModule],
  controllers: [StorageController],
  providers: [StorageService, WebsiteTenantService],
  exports: [StorageService],
})
export class StorageModule {}
