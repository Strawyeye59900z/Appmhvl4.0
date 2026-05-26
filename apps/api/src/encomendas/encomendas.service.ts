import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';
import { CreateEncomendaDto } from './dto/create-encomenda.dto';
import { EncomendaStatus } from '@prisma/client';

@Injectable()
export class EncomendasService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_WHATSAPP) private readonly whatsappQueue: Queue,
  ) {}

  async create(dto: CreateEncomendaDto, funcionarioId: string) {
    const morador = await this.prisma.morador.findUnique({
      where: { id: dto.moradorId },
      include: { apartamento: { select: { numero: true, bloco: true } } },
    });
    if (!morador) throw new NotFoundException('Morador não encontrado');

    const encomenda = await this.prisma.encomenda.create({
      data: {
        moradorId: dto.moradorId,
        funcionarioId,
        descricao: dto.descricao,
      },
      include: {
        morador: { select: { id: true, nome: true, whatsapp: true, apartamento: { select: { numero: true, bloco: true } } } },
        funcionario: { select: { id: true, nome: true } },
      },
    });

    await this.whatsappQueue.add('notificar-encomenda', {
      encomendaId: encomenda.id,
      moradorNome: morador.nome,
      moradorWhatsapp: morador.whatsapp,
      apartamento: morador.apartamento,
      descricao: dto.descricao,
    });

    return encomenda;
  }

  async confirmarRetirada(id: string, funcionarioId: string) {
    const encomenda = await this.prisma.encomenda.findUnique({ where: { id } });
    if (!encomenda) throw new NotFoundException('Encomenda não encontrada');
    if (encomenda.status !== EncomendaStatus.PENDENTE) {
      throw new ForbiddenException('Somente encomendas pendentes podem ser retiradas');
    }

    return this.prisma.encomenda.update({
      where: { id },
      data: {
        status: EncomendaStatus.RETIRADA,
        retiradoEm: new Date(),
        funcionarioId,
      },
      include: {
        morador: { select: { id: true, nome: true, apartamento: { select: { numero: true, bloco: true } } } },
        funcionario: { select: { id: true, nome: true } },
      },
    });
  }

  findAll(params: { status?: EncomendaStatus; moradorId?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.moradorId) where.moradorId = params.moradorId;

    return this.prisma.encomenda.findMany({
      where,
      include: {
        morador: { select: { id: true, nome: true, apartamento: { select: { numero: true, bloco: true } } } },
        funcionario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendentes() {
    return this.prisma.encomenda.findMany({
      where: { status: EncomendaStatus.PENDENTE },
      include: {
        morador: { select: { id: true, nome: true, apartamento: { select: { numero: true, bloco: true } } } },
        funcionario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMinhas(apartamentoId: string) {
    const moradores = await this.prisma.morador.findMany({
      where: { apartamentoId, ativo: true },
      select: { id: true },
    });
    const moradorIds = moradores.map((m) => m.id);

    return this.prisma.encomenda.findMany({
      where: { moradorId: { in: moradorIds } },
      include: {
        morador: { select: { id: true, nome: true } },
        funcionario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
