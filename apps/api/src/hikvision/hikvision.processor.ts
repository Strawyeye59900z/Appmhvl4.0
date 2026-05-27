import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService, digestRequest } from './hikvision.service';
import { QUEUE_HIKVISION } from '../queue/queue.constants';
import { Role } from '../common/roles.enum';
import { buildUserInfoPayload } from './isapi/user-info';
import { buildFaceDataRecord } from './isapi/face-data';

interface SyncFacialPayload {
  syncId: string;
  terminalId: string;
  pessoaId: string;
  role: Role;
}

function buildMultipart(
  boundary: string,
  parts: { name: string; contentType: string; filename?: string; data: Buffer | string }[],
): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += `\r\nContent-Type: ${part.contentType}\r\n\r\n`;
    chunks.push(Buffer.from(header, 'utf8'));
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data, 'utf8'));
    chunks.push(Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}

@Processor(QUEUE_HIKVISION)
export class HikvisionProcessor {
  private readonly logger = new Logger(HikvisionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
  ) {}

  @Process('sync-facial')
  async handleSyncFacial(job: Job<SyncFacialPayload>) {
    const { syncId, terminalId, pessoaId, role } = job.data;

    await this.prisma.facialSync.update({
      where: { id: syncId },
      data: { status: 'ENVIANDO' },
    });

    try {
      const terminal = await this.hikvisionService.getTerminalOrThrow(terminalId);
      const password = this.hikvisionService.decryptPassword(terminal.passwordEnc);
      const base = `http://${terminal.host}:${terminal.porta}`;

      let nome: string;
      if (role === Role.MORADOR) {
        const m = await this.prisma.morador.findUniqueOrThrow({ where: { id: pessoaId } });
        nome = m.nome;
      } else {
        const f = await this.prisma.funcionario.findUniqueOrThrow({ where: { id: pessoaId } });
        nome = f.nome;
      }

      // Step 1: Cadastrar UserInfo no terminal
      const userInfoPayload = buildUserInfoPayload(pessoaId, nome);
      await digestRequest({
        method: 'PUT',
        url: `${base}/ISAPI/AccessControl/UserInfo/Record?format=json`,
        username: terminal.username,
        password,
        data: userInfoPayload,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      // Step 2: Enviar foto como multipart (sem dependência form-data)
      const fotoBuffer = await this.hikvisionService.getFotoBuffer(pessoaId);
      const faceRecord = buildFaceDataRecord(pessoaId);
      const boundary = crypto.randomBytes(16).toString('hex');

      const body = buildMultipart(boundary, [
        {
          name: 'FaceDataRecord',
          contentType: 'application/json',
          data: JSON.stringify(faceRecord),
        },
        {
          name: 'FaceImage',
          contentType: 'image/jpeg',
          filename: `${pessoaId}.jpg`,
          data: fotoBuffer,
        },
      ]);

      await digestRequest({
        method: 'POST',
        url: `${base}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`,
        username: terminal.username,
        password,
        data: body,
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        timeout: 15000,
      });

      await this.prisma.facialSync.update({
        where: { id: syncId },
        data: { status: 'OK', enviadoEm: new Date(), ultimoErro: null },
      });

      this.logger.log(`Sync OK: ${pessoaId} → terminal ${terminal.nome}`);
    } catch (err: any) {
      const msg = err?.response?.data?.statusString ?? err?.message ?? 'Erro desconhecido';
      this.logger.error(`Sync falhou: ${pessoaId} → ${syncId}: ${msg}`);

      const sync = await this.prisma.facialSync.findUnique({ where: { id: syncId } });
      const tentativas = (sync?.tentativas ?? 0) + 1;
      const novoStatus = tentativas >= 5 ? 'FALHOU' : 'EM_FILA';

      await this.prisma.facialSync.update({
        where: { id: syncId },
        data: { status: novoStatus, tentativas, ultimoErro: msg.slice(0, 500) },
      });

      throw err; // BullMQ retry
    }
  }
}
