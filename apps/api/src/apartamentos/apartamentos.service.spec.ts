import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ApartamentosService } from './apartamentos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  apartamento: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  morador: {
    count: jest.fn(),
  },
};

describe('ApartamentosService', () => {
  let service: ApartamentosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApartamentosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ApartamentosService>(ApartamentosService);
  });

  it('findAll retorna lista', async () => {
    mockPrisma.apartamento.findMany.mockResolvedValue([{ id: '1', numero: '101' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockPrisma.apartamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('findAll filtra por ativo=true', async () => {
    mockPrisma.apartamento.findMany.mockResolvedValue([]);
    await service.findAll(true);
    expect(mockPrisma.apartamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } }),
    );
  });

  it('findOne lança NotFoundException para ID inexistente', async () => {
    mockPrisma.apartamento.findUnique.mockResolvedValue(null);
    await expect(service.findOne('naoexiste')).rejects.toThrow(NotFoundException);
  });

  it('findOne retorna apartamento com moradores', async () => {
    const apt = { id: '1', numero: '101', moradores: [] };
    mockPrisma.apartamento.findUnique.mockResolvedValue(apt);
    const result = await service.findOne('1');
    expect(result).toEqual(apt);
  });

  it('create retorna apartamento criado', async () => {
    const apt = { id: '1', numero: '101', bloco: null };
    mockPrisma.apartamento.create.mockResolvedValue(apt);
    const result = await service.create({ numero: '101' });
    expect(result).toEqual(apt);
  });

  it('create lança ConflictException em número duplicado', async () => {
    mockPrisma.apartamento.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ numero: '101' })).rejects.toThrow(ConflictException);
  });

  it('remove lança ConflictException se tiver moradores vinculados', async () => {
    mockPrisma.apartamento.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.morador.count.mockResolvedValue(2);
    await expect(service.remove('1')).rejects.toThrow(ConflictException);
  });

  it('remove deleta apartamento sem moradores', async () => {
    mockPrisma.apartamento.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.morador.count.mockResolvedValue(0);
    mockPrisma.apartamento.delete.mockResolvedValue({ id: '1' });
    await service.remove('1');
    expect(mockPrisma.apartamento.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
