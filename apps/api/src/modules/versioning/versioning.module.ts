import { Module } from '@nestjs/common';
import { VersioningService } from './versioning.service';
import { VersioningController } from './versioning.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [VersioningService],
  controllers: [VersioningController],
  exports: [VersioningService],
})
export class VersioningModule {}
