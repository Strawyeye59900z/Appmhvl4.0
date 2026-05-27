import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoReserva } from '@prisma/client';
import { CreateReservaDto } from './dto/create-reserva.dto';

const HORA_ABERTURA = 7;
const HORA_FECHAMENTO = 22;

@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReservaDto, apartamentoId: string) {
    const espaco = await this.prisma.espacoReserva.findUnique({
      where: { id: dto.espacoReservaId },
    });
    if (!espaco) throw new NotFoundException('Espaço de reserva não encontrado');
    if (!espaco.ativo) throw new BadRequestException('Espaço de reserva não está ativo');

    const dataObj = new Date(dto.data + 'T12:00:00.000Z');
    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    if (dataObj < hoje) throw new BadRequestException('Não é possível reservar em datas passadas');

    let horaInicioObj: Date | null = null;
    let horaFimObj: Date | null = null;

    if (espaco.tipo === TipoReserva.POR_HORA) {
      if (!dto.horaInicio) {
        throw new BadRequestException('horaInicio é obrigatório para espaços por hora');
      }
      const hora = parseInt(dto.horaInicio.split(':')[0], 10);
      const duracao = dto.duracao ?? 1;
      if (hora < HORA_ABERTURA || hora + duracao > HORA_FECHAMENTO) {
        throw new BadRequestException(
          `Horário disponível: ${HORA_ABERTURA}:00 às ${HORA_FECHAMENTO}:00`,
        );
      }

      // Verificar se alguma hora do bloco já está ocupada
      const reservasExistentes = await this.prisma.reserva.findMany({
        where: { espacoReservaId: dto.espacoReservaId, data: dataObj },
        select: { horaInicio: true, horaFim: true },
      });
      const ocupados = new Set(
        reservasExistentes
          .filter((r) => r.horaInicio)
          .map((r) => new Date(r.horaInicio!).getUTCHours()),
      );
      for (let h = hora; h < hora + duracao; h++) {
        if (ocupados.has(h)) {
          throw new ConflictException(`Horário ${String(h).padStart(2, '0')}:00 já está reservado`);
        }
      }

      horaInicioObj = new Date(`1970-01-01T${dto.horaInicio}:00.000Z`);
      horaFimObj = new Date(
        `1970-01-01T${String(hora + duracao).padStart(2, '0')}:00:00.000Z`,
      );
    }

    try {
      return await this.prisma.reserva.create({
        data: {
          data: dataObj,
          horaInicio: horaInicioObj,
          horaFim: horaFimObj,
          observacao: dto.observacao,
          apartamentoId,
          espacoReservaId: dto.espacoReservaId,
        },
        include: {
          espacoReserva: { select: { id: true, nome: true, tipo: true } },
          apartamento: { select: { id: true, numero: true, bloco: true } },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Horário já reservado para esta data');
      throw e;
    }
  }

  async cancel(id: string, apartamentoId: string, isAdmin: boolean) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id } });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    if (!isAdmin && reserva.apartamentoId !== apartamentoId) {
      throw new ForbiddenException('Sem permissão para cancelar esta reserva');
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    if (!isAdmin && reserva.data < hoje) {
      throw new BadRequestException('Não é possível cancelar reservas passadas');
    }

    return this.prisma.reserva.delete({ where: { id } });
  }

  findAll(params: { espacoId?: string; data?: string; apartamentoId?: string }) {
    const where: any = {};
    if (params.espacoId) where.espacoReservaId = params.espacoId;
    if (params.apartamentoId) where.apartamentoId = params.apartamentoId;
    if (params.data) where.data = new Date(params.data + 'T12:00:00.000Z');

    return this.prisma.reserva.findMany({
      where,
      include: {
        espacoReserva: { select: { id: true, nome: true, tipo: true } },
        apartamento: { select: { id: true, numero: true, bloco: true } },
      },
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  findMinhas(apartamentoId: string) {
    return this.prisma.reserva.findMany({
      where: { apartamentoId },
      include: {
        espacoReserva: { select: { id: true, nome: true, tipo: true } },
        apartamento: { select: { id: true, numero: true, bloco: true } },
      },
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async disponibilidade(espacoId: string, data: string) {
    const espaco = await this.prisma.espacoReserva.findUnique({ where: { id: espacoId } });
    if (!espaco) throw new NotFoundException('Espaço de reserva não encontrado');

    const dataObj = new Date(data + 'T12:00:00.000Z');
    const reservas = await this.prisma.reserva.findMany({
      where: { espacoReservaId: espacoId, data: dataObj },
      select: { horaInicio: true, horaFim: true },
    });

    if (espaco.tipo === TipoReserva.DIARIO) {
      return { tipo: TipoReserva.DIARIO, disponivel: reservas.length === 0 };
    }

    // Marca ocupado cada hora dentro do bloco horaInicio–horaFim
    const ocupados = new Set<number>();
    for (const r of reservas) {
      if (!r.horaInicio) continue;
      const inicio = new Date(r.horaInicio).getUTCHours();
      const fim = r.horaFim ? new Date(r.horaFim).getUTCHours() : inicio + 1;
      for (let h = inicio; h < fim; h++) ocupados.add(h);
    }
    const slots = [];
    for (let h = HORA_ABERTURA; h < HORA_FECHAMENTO; h++) {
      slots.push({ hora: `${String(h).padStart(2, '0')}:00`, disponivel: !ocupados.has(h) });
    }
    return { tipo: TipoReserva.POR_HORA, slots };
  }

  findEspacos() {
    return this.prisma.espacoReserva.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
  }
}
