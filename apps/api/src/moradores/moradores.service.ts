import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoradorDto } from './dto/create-morador.dto';
import { UpdateMoradorDto } from './dto/update-morador.dto';

@Injectable()
export class MoradoresService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(apartamentoId?: string) {
    const where = apartamentoId ? { apartamentoId } : {};
    return this.prisma.morador.findMany({
      where,
      include: { apartamento: { select: { id: true, numero: true, bloco: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const morador = await this.prisma.morador.findUnique({
      where: { id },
      include: { apartamento: { select: { id: true, numero: true, bloco: true } } },
    });
    if (!morador) throw new NotFoundException('Morador não encontrado');
    return morador;
  }

  async create(dto: CreateMoradorDto) {
    const apt = await this.prisma.apartamento.findUnique({ where: { id: dto.apartamentoId } });
    if (!apt) throw new NotFoundException('Apartamento não encontrado');

    try {
      return await this.prisma.morador.create({ data: dto });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('CPF já cadastrado');
      throw e;
    }
  }

  async update(id: string, dto: UpdateMoradorDto) {
    await this.findOne(id);
    try {
      return await this.prisma.morador.update({ where: { id }, data: dto });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('CPF já cadastrado');
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const encomendasCount = await this.prisma.encomenda.count({ where: { moradorId: id } });
    if (encomendasCount > 0) {
      throw new ConflictException('Não é possível excluir morador com encomendas vinculadas');
    }
    return this.prisma.morador.delete({ where: { id } });
  }
}
