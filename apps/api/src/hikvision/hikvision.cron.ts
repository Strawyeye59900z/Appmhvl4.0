import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService } from './hikvision.service';

@Injectable()
export class HikvisionCron {
  private readonly logger = new Logger(HikvisionCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pingAll() {
    const terminais = await this.prisma.hikvisionTerminal.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    for (const t of terminais) {
      const status = await this.hikvisionService.pingTerminalById(t.id);
      this.logger.debug(`Ping ${t.nome}: ${status}`);
    }
  }
}
