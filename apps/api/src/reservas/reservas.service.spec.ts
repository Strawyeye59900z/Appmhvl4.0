import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { PrismaService } from '../prisma/prisma.service';
import { TipoReserva } from '@prisma/client';

const mockPrisma = {
  espacoReserva: { findUnique: jest.fn(), findMany: jest.fn() },
  reserva: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

const espacoDiario = { id: 'esp1', nome: 'Churrasqueira', tipo: TipoReserva.DIARIO, ativo: true };
const espacoHora = { id: 'esp2', nome: 'Quadra', tipo: TipoReserva.POR_HORA, ativo: true };

const reservaBase = {
  id: 'res1',
  data: new Date('2099-06-01T12:00:00.000Z'),
  horaInicio: null,
  horaFim: null,
  observacao: null,
  apartamentoId: 'apt1',
  espacoReservaId: 'esp1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ReservasService', () => {
  let service: ReservasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservasService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ReservasService>(ReservasService);
  });

  describe('create — DIARIO', () => {
    it('cria reserva diária com sucesso', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoDiario);
      mockPrisma.reserva.create.mockResolvedValue(reservaBase);

      const result = await service.create({ espacoReservaId: 'esp1', data: '2099-06-01' }, 'apt1');

      expect(result).toEqual(reservaBase);
      expect(mockPrisma.reserva.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ apartamentoId: 'apt1', espacoReservaId: 'esp1' }),
        }),
      );
    });

    it('lança NotFoundException para espaço inexistente', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(null);
      await expect(service.create({ espacoReservaId: 'nao', data: '2099-06-01' }, 'apt1'))
        .rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException para data passada', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoDiario);
      await expect(service.create({ espacoReservaId: 'esp1', data: '2000-01-01' }, 'apt1'))
        .rejects.toThrow(BadRequestException);
    });

    it('lança ConflictException em conflito de data (P2002)', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoDiario);
      mockPrisma.reserva.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ espacoReservaId: 'esp1', data: '2099-06-01' }, 'apt1'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('create — POR_HORA', () => {
    it('cria reserva por hora com sucesso', async () => {
      const reservaHora = { ...reservaBase, horaInicio: new Date('1970-01-01T10:00:00.000Z') };
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoHora);
      mockPrisma.reserva.create.mockResolvedValue(reservaHora);

      const result = await service.create(
        { espacoReservaId: 'esp2', data: '2099-06-01', horaInicio: '10:00' },
        'apt1',
      );
      expect(result).toEqual(reservaHora);
    });

    it('lança BadRequestException sem horaInicio', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoHora);
      await expect(service.create({ espacoReservaId: 'esp2', data: '2099-06-01' }, 'apt1'))
        .rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException para hora fora do horário', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoHora);
      await expect(
        service.create({ espacoReservaId: 'esp2', data: '2099-06-01', horaInicio: '05:00' }, 'apt1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('morador cancela sua própria reserva futura', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValue(reservaBase);
      mockPrisma.reserva.delete.mockResolvedValue(reservaBase);

      await service.cancel('res1', 'apt1', false);
      expect(mockPrisma.reserva.delete).toHaveBeenCalledWith({ where: { id: 'res1' } });
    });

    it('admin cancela qualquer reserva', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValue(reservaBase);
      mockPrisma.reserva.delete.mockResolvedValue(reservaBase);

      await service.cancel('res1', 'outro-apt', true);
      expect(mockPrisma.reserva.delete).toHaveBeenCalled();
    });

    it('lança ForbiddenException se morador tenta cancelar reserva de outro', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValue(reservaBase);
      await expect(service.cancel('res1', 'apt-errado', false))
        .rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException para reserva inexistente', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValue(null);
      await expect(service.cancel('nao', 'apt1', true))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('disponibilidade — DIARIO', () => {
    it('retorna disponível se sem reservas', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoDiario);
      mockPrisma.reserva.findMany.mockResolvedValue([]);

      const result = await service.disponibilidade('esp1', '2099-06-01');
      expect(result).toEqual({ tipo: TipoReserva.DIARIO, disponivel: true });
    });

    it('retorna indisponível se já reservado', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoDiario);
      mockPrisma.reserva.findMany.mockResolvedValue([reservaBase]);

      const result = await service.disponibilidade('esp1', '2099-06-01');
      expect(result).toEqual({ tipo: TipoReserva.DIARIO, disponivel: false });
    });
  });

  describe('disponibilidade — POR_HORA', () => {
    it('retorna slots com hora ocupada marcada', async () => {
      mockPrisma.espacoReserva.findUnique.mockResolvedValue(espacoHora);
      mockPrisma.reserva.findMany.mockResolvedValue([
        { horaInicio: new Date('1970-01-01T10:00:00.000Z') },
      ]);

      const result = await service.disponibilidade('esp2', '2099-06-01') as any;
      expect(result.tipo).toBe(TipoReserva.POR_HORA);
      const slot10 = result.slots.find((s: any) => s.hora === '10:00');
      const slot11 = result.slots.find((s: any) => s.hora === '11:00');
      expect(slot10.disponivel).toBe(false);
      expect(slot11.disponivel).toBe(true);
    });
  });
});
