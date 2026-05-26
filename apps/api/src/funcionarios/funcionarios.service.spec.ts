import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FuncionariosService } from './funcionarios.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  funcionario: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  encomenda: {
    count: jest.fn(),
  },
};

describe('FuncionariosService', () => {
  let service: FuncionariosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuncionariosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<FuncionariosService>(FuncionariosService);
  });

  it('findAll retorna lista de ativos', async () => {
    mockPrisma.funcionario.findMany.mockResolvedValue([{ id: '1', nome: 'Maria', ativo: true }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockPrisma.funcionario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } }),
    );
  });

  it('findOne lança NotFoundException para ID inexistente', async () => {
    mockPrisma.funcionario.findUnique.mockResolvedValue(null);
    await expect(service.findOne('naoexiste')).rejects.toThrow(NotFoundException);
  });

  it('findOne retorna funcionário', async () => {
    const func = { id: '1', nome: 'Maria', ativo: true, primeiroAcesso: true };
    mockPrisma.funcionario.findUnique.mockResolvedValue(func);
    const result = await service.findOne('1');
    expect(result).toEqual(func);
  });

  it('create retorna funcionário sem senha (primeiroAcesso=true)', async () => {
    const func = { id: '1', nome: 'Carlos', ativo: true, primeiroAcesso: true };
    mockPrisma.funcionario.create.mockResolvedValue(func);
    const result = await service.create({ nome: 'Carlos' });
    expect(result).toEqual(func);
    expect(mockPrisma.funcionario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nome: 'Carlos' } }),
    );
  });

  it('update lança NotFoundException para ID inexistente', async () => {
    mockPrisma.funcionario.findUnique.mockResolvedValue(null);
    await expect(service.update('naoexiste', { nome: 'Novo' })).rejects.toThrow(NotFoundException);
  });

  it('update retorna funcionário atualizado', async () => {
    mockPrisma.funcionario.findUnique.mockResolvedValue({ id: '1', nome: 'Maria' });
    mockPrisma.funcionario.update.mockResolvedValue({ id: '1', nome: 'Maria Nova' });
    const result = await service.update('1', { nome: 'Maria Nova' });
    expect(result.nome).toBe('Maria Nova');
  });

  it('remove lança ConflictException se tiver encomendas vinculadas', async () => {
    mockPrisma.funcionario.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.encomenda.count.mockResolvedValue(5);
    await expect(service.remove('1')).rejects.toThrow(ConflictException);
  });

  it('remove deleta funcionário sem encomendas', async () => {
    mockPrisma.funcionario.findUnique.mockResolvedValue({ id: '1' });
    mockPrisma.encomenda.count.mockResolvedValue(0);
    mockPrisma.funcionario.delete.mockResolvedValue({ id: '1' });
    await service.remove('1');
    expect(mockPrisma.funcionario.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
