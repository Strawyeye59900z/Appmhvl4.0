import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_HIKVISION } from '../queue/queue.constants';
import { HikvisionService } from './hikvision.service';
import { HikvisionController } from './hikvision.controller';
import { HikvisionProcessor } from './hikvision.processor';
import { HikvisionCron } from './hikvision.cron';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_HIKVISION }),
  ],
  controllers: [HikvisionController],
  providers: [HikvisionService, HikvisionProcessor, HikvisionCron],
  exports: [HikvisionService],
})
export class HikvisionModule {}
