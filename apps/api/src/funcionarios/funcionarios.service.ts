import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { ResetSenhaFuncionarioDto } from './dto/reset-senha-funcionario.dto';

@Injectable()
export class FuncionariosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, ativo: true, primeiroAcesso: true, createdAt: true },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const func = await this.prisma.funcionario.findUnique({
      where: { id },
      select: { id: true, nome: true, ativo: true, primeiroAcesso: true, createdAt: true, updatedAt: true },
    });
    if (!func) throw new NotFoundException('Funcionário não encontrado');
    return func;
  }

  create(dto: CreateFuncionarioDto) {
    return this.prisma.funcionario.create({
      data: { nome: dto.nome },
      select: { id: true, nome: true, ativo: true, primeiroAcesso: true, createdAt: true },
    });
  }

  async update(id: string, dto: UpdateFuncionarioDto) {
    await this.findOne(id);
    return this.prisma.funcionario.update({
      where: { id },
      data: dto,
      select: { id: true, nome: true, ativo: true, primeiroAcesso: true, updatedAt: true },
    });
  }

  async resetSenha(id: string, dto: ResetSenhaFuncionarioDto) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.senha, 10);
    return this.prisma.funcionario.update({
      where: { id },
      data: { passwordHash, primeiroAcesso: false },
      select: { id: true, nome: true, primeiroAcesso: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const encomendasCount = await this.prisma.encomenda.count({ where: { funcionarioId: id } });
    if (encomendasCount > 0) {
      throw new ConflictException('Não é possível excluir funcionário com encomendas vinculadas');
    }
    return this.prisma.funcionario.delete({ where: { id } });
  }
}
