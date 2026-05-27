import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService } from '../hikvision/hikvision.service';
import { FotosService } from '../fotos/fotos.service';
import { Role } from '../common/roles.enum';
import { CreateVisitanteDto } from './dto/create-visitante.dto';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VisitantesService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'fotos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
    private readonly fotosService: FotosService,
    private readonly config: ConfigService,
  ) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private async resolverMoradorId(apartamentoId: string): Promise<string> {
    const morador = await this.prisma.morador.findFirst({
      where: { apartamentoId, ativo: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!morador) throw new BadRequestException('Morador não encontrado');
    return morador.id;
  }

  async criarVisitante(apartamentoId: string, dto: CreateVisitanteDto) {
    const moradorId = await this.resolverMoradorId(apartamentoId);

    const validoAte = new Date();
    validoAte.setMonth(validoAte.getMonth() + dto.meses);

    const visitante = await this.prisma.visitante.create({
      data: {
        nome: dto.nome,
        tipo: dto.tipo,
        validoAte,
        moradorId,
      },
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const link = `${appUrl}/visitante/${visitante.token}`;
    return { id: visitante.id, token: visitante.token, link };
  }

  async listarMeus(apartamentoId: string) {
    const moradorId = await this.resolverMoradorId(apartamentoId);

    const visitantes = await this.prisma.visitante.findMany({
      where: { moradorId, ativo: true },
      include: {
        facialSyncs: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return visitantes.map((v) => {
      const syncs = v.facialSyncs;
      let statusGeral = 'SEM_FOTO';
      if (v.fotoUrl) {
        if (syncs.length === 0) statusGeral = 'PENDENTE';
        else {
          const ok = syncs.filter((s) => s.status === 'OK').length;
          const falhou = syncs.filter((s) => s.status === 'FALHOU').length;
          if (ok === syncs.length) statusGeral = 'OK';
          else if (ok > 0 && falhou > 0) statusGeral = 'PARCIALMENTE_OK';
          else if (falhou > 0) statusGeral = 'FALHOU';
          else statusGeral = 'PENDENTE';
        }
      }
      return {
        id: v.id,
        nome: v.nome,
        tipo: v.tipo,
        fotoUrl: v.fotoUrl,
        validoAte: v.validoAte,
        tokenUsado: v.tokenUsado,
        statusGeral,
      };
    });
  }

  async revogarVisitante(apartamentoId: string, visitanteId: string) {
    const moradorId = await this.resolverMoradorId(apartamentoId);
    const v = await this.prisma.visitante.findUnique({ where: { id: visitanteId } });
    if (!v) throw new NotFoundException('Visitante não encontrado');
    if (v.moradorId !== moradorId) throw new ForbiddenException('Não autorizado');
    await this.prisma.visitante.update({ where: { id: visitanteId }, data: { ativo: false } });
    return { ok: true };
  }

  async getTokenInfo(token: string) {
    const v = await this.prisma.visitante.findUnique({
      where: { token },
      include: { morador: { select: { nome: true } } },
    });
    if (!v || !v.ativo) throw new NotFoundException('Link inválido ou expirado');
    if (v.tokenUsado) throw new BadRequestException('Foto já registrada');
    if (v.validoAte < new Date()) throw new BadRequestException('Link expirado');
    return {
      nome: v.nome,
      tipo: v.tipo,
      moradorNome: v.morador.nome,
      validoAte: v.validoAte,
    };
  }

  async registrarFoto(token: string, buffer: Buffer, mimetype: string) {
    const v = await this.prisma.visitante.findUnique({ where: { token } });
    if (!v || !v.ativo) throw new NotFoundException('Link inválido ou expirado');
    if (v.tokenUsado) throw new BadRequestException('Foto já registrada');
    if (v.validoAte < new Date()) throw new BadRequestException('Link expirado');
    if (!mimetype.startsWith('image/')) throw new BadRequestException('Arquivo deve ser uma imagem');

    const compressed = await this.fotosService.comprimirPublico(buffer);
    const fotoUrl = `/uploads/fotos/${v.id}.jpg`;

    fs.writeFileSync(path.join(this.uploadsDir, `${v.id}.jpg`), compressed);

    await this.prisma.visitante.update({
      where: { id: v.id },
      data: { fotoUrl, tokenUsado: true },
    });

    await this.hikvisionService.enfileirarSync(v.id, Role.VISITANTE);
    return { fotoUrl };
  }
}
