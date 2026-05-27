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

  async salvarFoto(
    userId: string,
    role: Role,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    if (!mimetype.startsWith('image/')) {
      throw new BadRequestException('Arquivo deve ser uma imagem');
    }

    const compressed = await this.comprimir(buffer);
    const filename = `${userId}.jpg`;
    const filepath = path.join(this.uploadsDir, filename);
    fs.writeFileSync(filepath, compressed);

    const fotoUrl = `/uploads/fotos/${filename}`;

    if (role === Role.MORADOR) {
      await this.prisma.morador.update({ where: { id: userId }, data: { fotoUrl } });
    } else if (role === Role.FUNCIONARIO) {
      await this.prisma.funcionario.update({ where: { id: userId }, data: { fotoUrl } });
    }

    await this.hikvisionService.enfileirarSync(userId, role);

    return fotoUrl;
  }

  async calcularStatusFacial(userId: string, role: Role): Promise<FacialStatus> {
    let fotoUrl: string | null = null;
    if (role === Role.MORADOR) {
      const m = await this.prisma.morador.findUnique({ where: { id: userId }, select: { fotoUrl: true } });
      fotoUrl = m?.fotoUrl ?? null;
    } else {
      const f = await this.prisma.funcionario.findUnique({ where: { id: userId }, select: { fotoUrl: true } });
      fotoUrl = f?.fotoUrl ?? null;
    }

    if (!fotoUrl) return 'SEM_FOTO';

    const where =
      role === Role.MORADOR
        ? { moradorId: userId }
        : { funcionarioId: userId };

    const syncs = await this.prisma.facialSync.findMany({ where });
    if (syncs.length === 0) return 'PENDENTE';

    const totalOk = syncs.filter((s) => s.status === 'OK').length;
    const totalFalhou = syncs.filter((s) => s.status === 'FALHOU').length;

    if (totalOk === syncs.length) return 'OK';
    if (totalOk > 0 && totalFalhou > 0) return 'PARCIALMENTE_OK';
    if (totalFalhou > 0 && totalOk === 0) return 'FALHOU';
    return 'PENDENTE';
  }

  private async comprimir(input: Buffer): Promise<Buffer> {
    const qualities = [85, 70, 55, 40];
    const sizes = [800, 600];

    for (const size of sizes) {
      for (const quality of qualities) {
        const result = await sharp(input)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality })
          .toBuffer();
        if (result.length <= 1024 * 1024) return result;
      }
    }

    return sharp(input)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 30 })
      .toBuffer();
  }
}
