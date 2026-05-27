import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService } from '../hikvision/hikvision.service';
import { Role } from '../common/roles.enum';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

export type FacialStatus = 'SEM_FOTO' | 'PENDENTE' | 'OK' | 'PARCIALMENTE_OK' | 'FALHOU';

@Injectable()
export class FotosService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'fotos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
  ) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // Para MORADOR, o JWT sub é o apartamentoId — resolve o moradorId real
  private async resolverMoradorId(apartamentoId: string): Promise<string> {
    const morador = await this.prisma.morador.findFirst({
      where: { apartamentoId, ativo: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!morador) throw new BadRequestException('Morador não encontrado para este apartamento');
    return morador.id;
  }

  async salvarFoto(
    sub: string,
    role: Role,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    if (!mimetype.startsWith('image/')) {
      throw new BadRequestException('Arquivo deve ser uma imagem');
    }

    const compressed = await this.comprimirPublico(buffer);

    if (role === Role.MORADOR) {
      const moradorId = await this.resolverMoradorId(sub);
      const filename = `${moradorId}.jpg`;
      fs.writeFileSync(path.join(this.uploadsDir, filename), compressed);
      const fotoUrl = `/uploads/fotos/${filename}`;
      await this.prisma.morador.update({ where: { id: moradorId }, data: { fotoUrl } });
      await this.hikvisionService.enfileirarSync(moradorId, role);
      return fotoUrl;
    } else if (role === Role.FUNCIONARIO) {
      const filename = `${sub}.jpg`;
      fs.writeFileSync(path.join(this.uploadsDir, filename), compressed);
      const fotoUrl = `/uploads/fotos/${filename}`;
      await this.prisma.funcionario.update({ where: { id: sub }, data: { fotoUrl } });
      await this.hikvisionService.enfileirarSync(sub, role);
      return fotoUrl;
    }

    throw new BadRequestException('Role não suportado para upload de foto');
  }

  // Admin: salva foto direto pelo ID da pessoa (moradorId ou funcionarioId)
  async salvarFotoById(
    pessoaId: string,
    role: Role,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    if (!mimetype.startsWith('image/')) {
      throw new BadRequestException('Arquivo deve ser uma imagem');
    }
    const compressed = await this.comprimirPublico(buffer);

    if (role === Role.MORADOR) {
      const filename = `${pessoaId}.jpg`;
      fs.writeFileSync(path.join(this.uploadsDir, filename), compressed);
      const fotoUrl = `/uploads/fotos/${filename}`;
      await this.prisma.morador.update({ where: { id: pessoaId }, data: { fotoUrl } });
      await this.hikvisionService.enfileirarSync(pessoaId, role);
      return fotoUrl;
    } else if (role === Role.FUNCIONARIO) {
      const filename = `${pessoaId}.jpg`;
      fs.writeFileSync(path.join(this.uploadsDir, filename), compressed);
      const fotoUrl = `/uploads/fotos/${filename}`;
      await this.prisma.funcionario.update({ where: { id: pessoaId }, data: { fotoUrl } });
      await this.hikvisionService.enfileirarSync(pessoaId, role);
      return fotoUrl;
    }

    throw new BadRequestException('Role não suportado');
  }

  async calcularStatusFacial(sub: string, role: Role): Promise<FacialStatus> {
    let fotoUrl: string | null = null;
    let pessoaId = sub;

    if (role === Role.MORADOR) {
      pessoaId = await this.resolverMoradorId(sub).catch(() => sub);
      const m = await this.prisma.morador.findUnique({ where: { id: pessoaId }, select: { fotoUrl: true } });
      fotoUrl = m?.fotoUrl ?? null;
    } else {
      const f = await this.prisma.funcionario.findUnique({ where: { id: sub }, select: { fotoUrl: true } });
      fotoUrl = f?.fotoUrl ?? null;
    }

    if (!fotoUrl) return 'SEM_FOTO';

    const where =
      role === Role.MORADOR
        ? { moradorId: pessoaId }
        : { funcionarioId: sub };

    const syncs = await this.prisma.facialSync.findMany({ where });
    if (syncs.length === 0) return 'PENDENTE';

    const totalOk = syncs.filter((s) => s.status === 'OK').length;
    const totalFalhou = syncs.filter((s) => s.status === 'FALHOU').length;

    if (totalOk === syncs.length) return 'OK';
    if (totalOk > 0 && totalFalhou > 0) return 'PARCIALMENTE_OK';
    if (totalFalhou > 0 && totalOk === 0) return 'FALHOU';
    return 'PENDENTE';
  }

  async comprimirPublico(input: Buffer): Promise<Buffer> {
    // Hikvision requer boa qualidade de imagem para análise facial
    // Prioriza qualidade sobre tamanho, com limite de 2MB
    const qualities = [95, 90, 85, 80];
    const sizes = [1024, 800];

    for (const size of sizes) {
      for (const quality of qualities) {
        const result = await sharp(input)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality, progressive: true })
          .toBuffer();
        // Permite até 2MB para garantir qualidade suficiente
        if (result.length <= 2 * 1024 * 1024) return result;
      }
    }

    // Fallback: 600x600 com qualidade 75
    return sharp(input)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
  }
}
