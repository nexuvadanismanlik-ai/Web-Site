import { Module } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { BrandingController } from './branding.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [BrandingService],
  controllers: [BrandingController],
  exports: [BrandingService],
})
export class BrandingModule {}
