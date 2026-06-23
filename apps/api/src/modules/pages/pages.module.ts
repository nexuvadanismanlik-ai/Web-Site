import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { VersioningModule } from '../versioning/versioning.module';

@Module({
  imports: [AuditLogModule, VersioningModule],
  providers: [PagesService],
  controllers: [PagesController],
  exports: [PagesService],
})
export class PagesModule {}
