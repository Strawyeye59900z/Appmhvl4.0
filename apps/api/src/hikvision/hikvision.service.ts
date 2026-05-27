import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/roles.enum';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import { QUEUE_HIKVISION } from '../queue/queue.constants';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios, { Method } from 'axios';

// ── Digest Auth helper ────────────────────────────────────────────────────────

function parseDigestChallenge(wwwAuthenticate: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(wwwAuthenticate)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

function buildDigestAuth(
  method: string,
  uri: string,
  username: string,
  password: string,
  challenge: Record<string, string>,
): string {
  const { realm, nonce, qop, opaque } = challenge;
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = crypto
    .createHash('md5')
    .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    .digest('hex');

  let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", nc=${nc}, cnonce="${cnonce}", response="${response}", qop=${qop}`;
  if (opaque) header += `, opaque="${opaque}"`;
  return header;
}

export async function digestRequest(opts: {
  method: string;
  url: string;
  username: string;
  password: string;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}): Promise<any> {
  const { method, url, username, password, data, headers = {}, timeout = 10000 } = opts;

  const axiosMethod = method.toUpperCase() as Method;

  // First request — will get 401 with WWW-Authenticate
  let challenge: Record<string, string>;
  try {
    await axios({ method: axiosMethod, url, data, headers, timeout });
    // If no 401, no auth needed (shouldn't happen with Hikvision, but handle gracefully)
    return;
  } catch (err: any) {
    if (err?.response?.status !== 401) throw err;
    const wwwAuth: string = err.response.headers['www-authenticate'] ?? '';
    challenge = parseDigestChallenge(wwwAuth);
  }

  // Parse URI path from full URL
  const urlObj = new URL(url);
  const uri = urlObj.pathname + urlObj.search;

  const authHeader = buildDigestAuth(axiosMethod, uri, username, password, challenge);

  return axios({
    method: axiosMethod,
    url,
    data,
    headers: { ...headers, Authorization: authHeader },
    timeout,
  });
}

// ── HikvisionService ──────────────────────────────────────────────────────────

@Injectable()
export class HikvisionService {
  private readonly logger = new Logger(HikvisionService.name);
  private readonly encKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_HIKVISION) private readonly queue: Queue,
  ) {
    const secret = this.config.getOrThrow<string>('APP_SECRET');
    this.encKey = crypto.scryptSync(secret, 'hikvision-salt', 32) as Buffer;
  }

  // ── Criptografia ──────────────────────────────────────────────────────────

  encryptPassword(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
  }

  decryptPassword(enc: string): string {
    const [ivB64, encB64, tagB64] = enc.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(encB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }

  // ── CRUD terminais ────────────────────────────────────────────────────────

  async listarTerminais() {
    const terminais = await this.prisma.hikvisionTerminal.findMany({
      orderBy: { nome: 'asc' },
    });
    return terminais.map(({ passwordEnc: _, ...t }) => t);
  }

  async criarTerminal(dto: CreateTerminalDto) {
    const passwordEnc = this.encryptPassword(dto.password);
    const terminal = await this.prisma.hikvisionTerminal.create({
      data: {
        nome: dto.nome,
        host: dto.host,
        porta: dto.porta ?? 80,
        username: dto.username,
        passwordEnc,
      },
    });

    const status = await this.pingTerminalById(terminal.id);
    const { passwordEnc: _, ...safe } = terminal;
    return { ...safe, ultimoStatus: status };
  }

  async atualizarTerminal(id: string, dto: UpdateTerminalDto) {
    await this.getTerminalOrThrow(id);
    const data: Record<string, unknown> = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.host !== undefined) data.host = dto.host;
    if (dto.porta !== undefined) data.porta = dto.porta;
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.password !== undefined) data.passwordEnc = this.encryptPassword(dto.password);
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.prisma.hikvisionTerminal.update({ where: { id }, data });
    const { passwordEnc: _, ...safe } = updated;
    return safe;
  }

  async removerTerminal(id: string) {
    await this.getTerminalOrThrow(id);
    await this.prisma.facialSync.deleteMany({ where: { terminalId: id } });
    await this.prisma.hikvisionTerminal.delete({ where: { id } });
    return { ok: true };
  }

  async pingTerminalById(id: string): Promise<string> {
    const terminal = await this.getTerminalOrThrow(id);
    try {
      const password = this.decryptPassword(terminal.passwordEnc);
      await digestRequest({
        method: 'GET',
        url: `http://${terminal.host}:${terminal.porta}/ISAPI/System/deviceInfo`,
        username: terminal.username,
        password,
        timeout: 5000,
      });
      const status = 'ok';
      await this.prisma.hikvisionTerminal.update({
        where: { id },
        data: { ultimoPing: new Date(), ultimoStatus: status },
      });
      return status;
    } catch (err: any) {
      const status = err?.message ?? 'unreachable';
      await this.prisma.hikvisionTerminal.update({
        where: { id },
        data: { ultimoPing: new Date(), ultimoStatus: status.slice(0, 200) },
      });
      return status;
    }
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async enfileirarSync(pessoaId: string, role: Role): Promise<void> {
    const terminaisAtivos = await this.prisma.hikvisionTerminal.findMany({
      where: { ativo: true },
    });

    for (const terminal of terminaisAtivos) {
      const sync = await this.prisma.facialSync.upsert({
        where:
          role === Role.MORADOR
            ? { moradorId_terminalId: { moradorId: pessoaId, terminalId: terminal.id } }
            : { funcionarioId_terminalId: { funcionarioId: pessoaId, terminalId: terminal.id } },
        create:
          role === Role.MORADOR
            ? { moradorId: pessoaId, terminalId: terminal.id, status: 'PENDENTE', tentativas: 0, ultimoErro: null }
            : { funcionarioId: pessoaId, terminalId: terminal.id, status: 'PENDENTE', tentativas: 0, ultimoErro: null },
        update: { status: 'PENDENTE', tentativas: 0, ultimoErro: null },
      });

      await this.queue.add(
        'sync-facial',
        { syncId: sync.id, terminalId: terminal.id, pessoaId, role },
        { attempts: 5, backoff: { type: 'exponential', delay: 30000 } },
      );
    }
  }

  async listarStatusSync() {
    const [moradores, funcionarios] = await Promise.all([
      this.prisma.morador.findMany({
        where: { fotoUrl: { not: null }, ativo: true },
        select: {
          id: true,
          nome: true,
          fotoUrl: true,
          apartamento: { select: { numero: true, bloco: true } },
          facialSyncs: { include: { terminal: { select: { id: true, nome: true } } } },
        },
      }),
      this.prisma.funcionario.findMany({
        where: { fotoUrl: { not: null }, ativo: true },
        select: {
          id: true,
          nome: true,
          fotoUrl: true,
          facialSyncs: { include: { terminal: { select: { id: true, nome: true } } } },
        },
      }),
    ]);

    const calcStatus = (syncs: { status: string }[]) => {
      if (syncs.length === 0) return 'PENDENTE';
      const ok = syncs.filter((s) => s.status === 'OK').length;
      const falhou = syncs.filter((s) => s.status === 'FALHOU').length;
      if (ok === syncs.length) return 'OK';
      if (ok > 0 && falhou > 0) return 'PARCIALMENTE_OK';
      if (falhou > 0 && ok === 0) return 'FALHOU';
      return 'PENDENTE';
    };

    return [
      ...moradores.map((m) => ({
        id: m.id,
        nome: m.nome,
        tipo: 'MORADOR' as const,
        apto: m.apartamento
          ? `${m.apartamento.bloco ? `Bl. ${m.apartamento.bloco} ` : ''}${m.apartamento.numero}`
          : null,
        fotoUrl: m.fotoUrl,
        statusGeral: calcStatus(m.facialSyncs),
        syncs: m.facialSyncs.map((s) => ({
          terminalId: s.terminalId,
          terminalNome: s.terminal.nome,
          status: s.status,
          tentativas: s.tentativas,
          ultimoErro: s.ultimoErro,
          enviadoEm: s.enviadoEm,
        })),
      })),
      ...funcionarios.map((f) => ({
        id: f.id,
        nome: f.nome,
        tipo: 'FUNCIONARIO' as const,
        apto: null,
        fotoUrl: f.fotoUrl,
        statusGeral: calcStatus(f.facialSyncs),
        syncs: f.facialSyncs.map((s) => ({
          terminalId: s.terminalId,
          terminalNome: s.terminal.nome,
          status: s.status,
          tentativas: s.tentativas,
          ultimoErro: s.ultimoErro,
          enviadoEm: s.enviadoEm,
        })),
      })),
    ];
  }

  async reenviarSync(pessoaId: string, role: Role): Promise<void> {
    await this.enfileirarSync(pessoaId, role);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async getTerminalOrThrow(id: string) {
    const t = await this.prisma.hikvisionTerminal.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Terminal não encontrado');
    return t;
  }

  async getFotoBuffer(pessoaId: string): Promise<Buffer> {
    const fotoPath = path.join(process.cwd(), 'uploads', 'fotos', `${pessoaId}.jpg`);
    if (!fs.existsSync(fotoPath)) throw new BadRequestException('Foto não encontrada para esta pessoa');
    return fs.readFileSync(fotoPath);
  }
}
