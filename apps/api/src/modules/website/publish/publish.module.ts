import { Module } from '@nestjs/common';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';

/**
 * Exported so content modules can announce changes without depending on which
 * publishing strategy is active.
 */
@Module({
  providers: [PublishService],
  controllers: [PublishController],
  exports: [PublishService],
})
export class PublishModule {}
