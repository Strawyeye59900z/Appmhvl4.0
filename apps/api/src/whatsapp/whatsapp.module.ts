import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';
import { WhatsAppClient } from './whatsapp.client';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppController } from './whatsapp.controller';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_WHATSAPP })],
  controllers: [WhatsAppController],
  providers: [WhatsAppClient, WhatsAppProcessor],
  exports: [WhatsAppClient],
})
export class WhatsAppModule {}
