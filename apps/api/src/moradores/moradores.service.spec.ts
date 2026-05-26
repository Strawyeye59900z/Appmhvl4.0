import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MoradoresService } from './moradores.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  morador: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  apartamento: {
    findUnique: jest.fn(),
  },
  encomenda: {
    count: jest.fn(),
  },
};

describe('MoradoresService', () => {
  let service: MoradoresService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoradoresService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<MoradoresService>(MoradoresService);
  });

  it('findAll retorna lista sem filtro', async () => {
    mockPrisma.morador.findMany.mockResolvedValue([{ id: '1', nome: 'João' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockPrisma.morador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('findAll filtra por apartamentoId', async () => {
    mockPrisma.morador.findMany.mockResolvedValue([]);
    await service.findAll('apt-1');
    expect(mockPrisma.morador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { apartamentoId: 'apt-1' } }),
    );
  });

  it('findOne lança NotFoundException para ID inexistente', async () => {
    mockPrisma.morador.findUnique.mockResolvedValue(null);
    await expect(service.findOne('naoexiste')).rejects.toThrow(NotFoundException);
  });

  it('findOne retorna morador com apartamento', async () => {
    const morador = { id: '1', nome: 'João', apartamento: { id: 'apt-1', numero: '101' } };
    mockPrisma.morador.findUnique.mockResolvedValue(morador);
    const result = await service.findOne('1');
    expect(result).toEqual(morador);
  });

  it('create lança NotFoundException se apartamento não existe', async () => {
    mockPrisma.apartamento.findUnique.mockResolvedValue(null);
    await expect(service.create({ nome: 'João', apartamentoId: 'naoexiste' })).rejects.toThrow(NotFoundException);
  });

  it('create retorna morador criado', async () => {
    const morador = { id: '1', nome: 'João', apartamentoId: 'apt-1' };
    mockPrisma.apartamento.findUnique.mockResolvedValue({ id: 'apt-1' });
    mockPrisma.morador.create.mockResolvedValue(morador);
    const result = await service.create({ nome: 'João', apartamentoId: 'apt-1' });
    expect(result).toEqual(morador);
  });

  it('create lança ConflictException em CPF duplicado', async () => {
    mockPrisma.apartamento.findUnique.mockResolvedValue({ id: 'apt-1' });
    mockPrisma.morador.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ nome: 'João', apartamentoId: 'apt-1', cpf: '123.456.789-00' })).rejects.toThrow(ConflictException);
  });

  it('remove lança ConflictException se tiver encomendas vinculadas', async () => {
    mockPrisma.morador.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.encomenda.count.mockResolvedValue(3);
    await expect(service.remove('1')).rejects.toThrow(ConflictException);
  });

  it('remove deleta morador sem encomendas', async () => {
    mockPrisma.morador.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.encomenda.count.mockResolvedValue(0);
    mockPrisma.morador.delete.mockResolvedValue({ id: '1' });
    await service.remove('1');
    expect(mockPrisma.morador.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
