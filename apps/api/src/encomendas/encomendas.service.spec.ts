import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { EncomendasService } from './encomendas.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';
import { EncomendaStatus } from '@prisma/client';

const mockPrisma = {
  morador: { findUnique: jest.fn(), findMany: jest.fn() },
  encomenda: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockQueue = { add: jest.fn() };

const encomendaBase = {
  id: 'enc1',
  status: EncomendaStatus.PENDENTE,
  moradorId: 'mor1',
  funcionarioId: 'fun1',
  descricao: null,
  notificado: false,
  retiradoEm: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  morador: { id: 'mor1', nome: 'João', whatsapp: null, apartamento: { numero: '101', bloco: null } },
  funcionario: { id: 'fun1', nome: 'Carlos' },
};

describe('EncomendasService', () => {
  let service: EncomendasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncomendasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(QUEUE_WHATSAPP), useValue: mockQueue },
      ],
    }).compile();
    service = module.get<EncomendasService>(EncomendasService);
  });

  describe('create', () => {
    it('cria encomenda e enfileira job WhatsApp', async () => {
      const morador = { id: 'mor1', nome: 'João', whatsapp: '11999', apartamento: { numero: '101', bloco: null } };
      mockPrisma.morador.findUnique.mockResolvedValue(morador);
      mockPrisma.encomenda.create.mockResolvedValue(encomendaBase);

      const result = await service.create({ moradorId: 'mor1' }, 'fun1');

      expect(result).toEqual(encomendaBase);
      expect(mockPrisma.encomenda.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ moradorId: 'mor1', funcionarioId: 'fun1' }) }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith('notificar-encomenda', expect.objectContaining({ encomendaId: 'enc1' }));
    });

    it('lança NotFoundException para morador inexistente', async () => {
      mockPrisma.morador.findUnique.mockResolvedValue(null);
      await expect(service.create({ moradorId: 'naoexiste' }, 'fun1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmarRetirada', () => {
    it('atualiza status para RETIRADA', async () => {
      mockPrisma.encomenda.findUnique.mockResolvedValue(encomendaBase);
      mockPrisma.encomenda.update.mockResolvedValue({ ...encomendaBase, status: EncomendaStatus.RETIRADA });

      const result = await service.confirmarRetirada('enc1', 'fun1');

      expect(result.status).toBe(EncomendaStatus.RETIRADA);
      expect(mockPrisma.encomenda.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: EncomendaStatus.RETIRADA }) }),
      );
    });

    it('lança NotFoundException para encomenda inexistente', async () => {
      mockPrisma.encomenda.findUnique.mockResolvedValue(null);
      await expect(service.confirmarRetirada('naoexiste', 'fun1')).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException se encomenda já foi retirada', async () => {
      mockPrisma.encomenda.findUnique.mockResolvedValue({ ...encomendaBase, status: EncomendaStatus.RETIRADA });
      await expect(service.confirmarRetirada('enc1', 'fun1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('retorna todas as encomendas sem filtros', async () => {
      mockPrisma.encomenda.findMany.mockResolvedValue([encomendaBase]);
      const result = await service.findAll({});
      expect(result).toHaveLength(1);
      expect(mockPrisma.encomenda.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filtra por status', async () => {
      mockPrisma.encomenda.findMany.mockResolvedValue([]);
      await service.findAll({ status: EncomendaStatus.PENDENTE });
      expect(mockPrisma.encomenda.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: EncomendaStatus.PENDENTE } }),
      );
    });

    it('filtra por moradorId', async () => {
      mockPrisma.encomenda.findMany.mockResolvedValue([encomendaBase]);
      await service.findAll({ moradorId: 'mor1' });
      expect(mockPrisma.encomenda.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { moradorId: 'mor1' } }),
      );
    });
  });

  describe('findPendentes', () => {
    it('retorna apenas encomendas pendentes', async () => {
      mockPrisma.encomenda.findMany.mockResolvedValue([encomendaBase]);
      const result = await service.findPendentes();
      expect(result).toHaveLength(1);
      expect(mockPrisma.encomenda.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: EncomendaStatus.PENDENTE } }),
      );
    });
  });

  describe('findMinhas', () => {
    it('retorna encomendas dos moradores do apartamento', async () => {
      mockPrisma.morador.findMany.mockResolvedValue([{ id: 'mor1' }, { id: 'mor2' }]);
      mockPrisma.encomenda.findMany.mockResolvedValue([encomendaBase]);

      const result = await service.findMinhas('apt1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.encomenda.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { moradorId: { in: ['mor1', 'mor2'] } } }),
      );
    });

    it('retorna lista vazia se apartamento não tem moradores ativos', async () => {
      mockPrisma.morador.findMany.mockResolvedValue([]);
      mockPrisma.encomenda.findMany.mockResolvedValue([]);

      const result = await service.findMinhas('apt1');
      expect(result).toHaveLength(0);
    });
  });
});
