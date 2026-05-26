import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

const mockPrisma = {
  admin: { findUnique: jest.fn() },
  funcionario: { findUnique: jest.fn(), update: jest.fn() },
  apartamento: { findUnique: jest.fn(), update: jest.fn() },
};

const mockJwt = { sign: jest.fn().mockReturnValue('mock.token'), verify: jest.fn() };
const mockConfig = { getOrThrow: jest.fn().mockReturnValue('secret') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('loginAdmin', () => {
    it('throws UnauthorizedException for unknown username', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      await expect(service.loginAdmin({ username: 'x', password: 'y' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: '1', passwordHash: await bcrypt.hash('correct', 10),
      });
      await expect(service.loginAdmin({ username: 'admin', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('returns accessToken on valid credentials', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: '1', passwordHash: await bcrypt.hash('pass', 10),
      });
      const result = await service.loginAdmin({ username: 'admin', password: 'pass' });
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('loginFuncionario', () => {
    it('returns primeiroAcesso:true when passwordHash is null', async () => {
      mockPrisma.funcionario.findUnique.mockResolvedValue({
        id: '2', passwordHash: null, primeiroAcesso: true, ativo: true,
      });
      const result = await service.loginFuncionario({ funcionarioId: '2', password: 'any' });
      expect(result).toEqual({ primeiroAcesso: true });
    });

    it('returns accessToken on valid credentials', async () => {
      mockPrisma.funcionario.findUnique.mockResolvedValue({
        id: '2', passwordHash: await bcrypt.hash('pass', 10), primeiroAcesso: false, ativo: true,
      });
      const result = await service.loginFuncionario({ funcionarioId: '2', password: 'pass' });
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('loginMorador', () => {
    it('returns primeiroAcesso:true when senhaHash is null', async () => {
      mockPrisma.apartamento.findUnique.mockResolvedValue({
        id: '3', senhaHash: null, primeiroAcesso: true, ativo: true,
      });
      const result = await service.loginMorador({ apartamentoId: '3', password: 'any' });
      expect(result).toEqual({ primeiroAcesso: true });
    });

    it('returns accessToken on valid credentials', async () => {
      mockPrisma.apartamento.findUnique.mockResolvedValue({
        id: '3', senhaHash: await bcrypt.hash('pass', 10), primeiroAcesso: false, ativo: true,
      });
      const result = await service.loginMorador({ apartamentoId: '3', password: 'pass' });
      expect(result).toHaveProperty('accessToken');
    });
  });
});
