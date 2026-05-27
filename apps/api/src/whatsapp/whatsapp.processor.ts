import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';
import { WhatsAppClient } from './whatsapp.client';

interface NotificarEncomendaPayload {
  encomendaId: string;
  moradorNome: string;
  moradorWhatsapp: string | null;
  apartamento: { numero: string; bloco?: string | null };
  descricao?: string | null;
}

@Processor(QUEUE_WHATSAPP)
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(private readonly whatsapp: WhatsAppClient) {}

  @Process('notificar-encomenda')
  async handleNotificarEncomenda(job: Job<NotificarEncomendaPayload>) {
    const { moradorNome, moradorWhatsapp, apartamento } = job.data;

    if (!moradorWhatsapp) {
      this.logger.debug(`Morador ${moradorNome} sem WhatsApp — notificação ignorada`);
      return;
    }

    const apto = apartamento.bloco
      ? `Bloco ${apartamento.bloco}, Apto ${apartamento.numero}`
      : `Apto ${apartamento.numero}`;

    const texto =
      `Olá ${moradorNome}! 📦\n\n` +
      `Uma encomenda chegou para o ${apto}.\n` +
      `Retire na portaria assim que possível.\n\n` +
      `_Condomínio App_`;

    try {
      await this.whatsapp.sendMessage(moradorWhatsapp, texto);
      this.logger.log(`Notificação enviada para ${moradorWhatsapp} (${moradorNome})`);
    } catch (err) {
      this.logger.error(`Falha ao enviar para ${moradorWhatsapp}: ${err}`);
      throw err;
    }
  }
}
