import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApartamentoDto } from './dto/create-apartamento.dto';
import { UpdateApartamentoDto } from './dto/update-apartamento.dto';

@Injectable()
export class ApartamentosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(ativo?: boolean) {
    const where = ativo !== undefined ? { ativo } : {};
    return this.prisma.apartamento.findMany({
      where,
      include: { _count: { select: { moradores: true } } },
      orderBy: { numero: 'asc' },
    });
  }

  async findOne(id: string) {
    const apt = await this.prisma.apartamento.findUnique({
      where: { id },
      include: { moradores: { where: { ativo: true }, select: { id: true, nome: true, whatsapp: true } } },
    });
    if (!apt) throw new NotFoundException('Apartamento não encontrado');
    return apt;
  }

  async create(dto: CreateApartamentoDto) {
    try {
      return await this.prisma.apartamento.create({ data: dto });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException(`Apartamento ${dto.numero} já existe`);
      throw e;
    }
  }

  async update(id: string, dto: UpdateApartamentoDto) {
    await this.findOne(id);
    try {
      return await this.prisma.apartamento.update({ where: { id }, data: dto });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Número de apartamento já está em uso');
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const moradoresCount = await this.prisma.morador.count({ where: { apartamentoId: id } });
    if (moradoresCount > 0) {
      throw new ConflictException('Não é possível excluir apartamento com moradores vinculados');
    }
    return this.prisma.apartamento.delete({ where: { id } });
  }
}
