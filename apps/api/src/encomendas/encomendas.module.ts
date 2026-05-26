import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EncomendasController } from './encomendas.controller';
import { EncomendasService } from './encomendas.service';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_WHATSAPP })],
  controllers: [EncomendasController],
  providers: [EncomendasService],
  exports: [EncomendasService],
})
export class EncomendasModule {}
