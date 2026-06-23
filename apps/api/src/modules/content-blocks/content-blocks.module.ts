import { Module } from '@nestjs/common';
import { ContentBlocksService } from './content-blocks.service';
import { ContentBlocksController } from './content-blocks.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { VersioningModule } from '../versioning/versioning.module';

@Module({
  imports: [AuditLogModule, VersioningModule],
  providers: [ContentBlocksService],
  controllers: [ContentBlocksController],
  exports: [ContentBlocksService],
})
export class ContentBlocksModule {}
