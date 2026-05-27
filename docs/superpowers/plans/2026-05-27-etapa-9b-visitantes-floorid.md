# Etapa 9B: Visitantes, Floor/Room ID e Melhorias Hikvision — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cadastro de personais/funcionários temporários pelos moradores via link WhatsApp, enviar floor/room ID derivado do apartamento para o terminal Hikvision, adicionar sufixo de tipo no nome, filtros na aba sync do admin e agrupamento por andar na tela de moradores.

**Architecture:** Novo model `Visitante` com token de convite, módulo NestJS `visitantes` com endpoints públicos (registro de foto) e autenticados (morador cria/revoga), função pura `parseApartamento` usada tanto no backend (ao montar `UserInfo` ISAPI) quanto no frontend (agrupamento). `FacialSync` ganha terceira chave `visitanteId`. `Role.VISITANTE` adicionado ao enum e ao processor.

**Tech Stack:** NestJS, Prisma, PostgreSQL, BullMQ, Next.js App Router, Tailwind CSS

---

## Mapa de arquivos

### Novos — Backend
- `apps/api/src/common/roles.enum.ts` — adicionar `VISITANTE`
- `apps/api/src/hikvision/isapi/parse-apartamento.ts` — função `parseApartamento`
- `apps/api/src/visitantes/visitantes.module.ts`
- `apps/api/src/visitantes/visitantes.controller.ts`
- `apps/api/src/visitantes/visitantes.service.ts`
- `apps/api/src/visitantes/dto/create-visitante.dto.ts`

### Modificados — Backend
- `prisma/schema.prisma` — enum `TipoVisitante`, model `Visitante`, `FacialSync.visitanteId`, `Morador.visitantes`
- `apps/api/src/hikvision/isapi/user-info.ts` — adicionar `floorNumber`, `roomNumber`, `sufixo`, `endTime`, `userType`
- `apps/api/src/hikvision/hikvision.processor.ts` — suporte a `Role.VISITANTE` + floorNo/roomNo
- `apps/api/src/hikvision/hikvision.service.ts` — `enfileirarSync` aceita `Role.VISITANTE`, `listarStatusSync` inclui visitantes
- `apps/api/src/hikvision/hikvision.controller.ts` — retry aceita `VISITANTE`
- `apps/api/src/app.module.ts` — importar `VisitantesModule`

### Novos — Frontend
- `apps/web/src/lib/parse-apartamento.ts` — mesma função pura
- `apps/web/src/app/visitante/[token]/page.tsx` — página pública de registro de foto

### Modificados — Frontend
- `apps/web/src/lib/api.ts` — namespace `visitantes`
- `apps/web/src/app/me/page.tsx` — seção "Meus Visitantes"
- `apps/web/src/app/admin/hikvision/page.tsx` — filtros + ordenação na aba Sync, suporte a VISITANTE
- `apps/web/src/app/admin/moradores/page.tsx` — agrupamento por andar

---

## Task 1: Migration Prisma — Visitante + FacialSync.visitanteId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enum `TipoVisitante` e model `Visitante` ao schema**

Abrir `prisma/schema.prisma` e adicionar após o enum `FacialSyncStatus`:

```prisma
enum TipoVisitante {
  PERSONAL
  FUNCIONARIO_TEMP
}
```

Adicionar após o model `Funcionario`:

```prisma
model Visitante {
  id            String        @id @default(cuid())
  codigoFacial  Int           @unique @default(autoincrement())
  nome          String
  tipo          TipoVisitante
  fotoUrl       String?
  token         String        @unique @default(uuid())
  tokenUsado    Boolean       @default(false)
  validoAte     DateTime
  ativo         Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  moradorId     String
  morador       Morador       @relation(fields: [moradorId], references: [id])

  facialSyncs   FacialSync[]
}
```

- [ ] **Step 2: Adicionar `visitanteId` ao `FacialSync` e relação em `Morador`**

No model `Morador`, adicionar na seção de relações:
```prisma
  visitantes  Visitante[]
```

No model `FacialSync`, adicionar após `funcionarioId`:
```prisma
  visitanteId   String?
  visitante     Visitante?        @relation(fields: [visitanteId], references: [id])
```

E adicionar o unique:
```prisma
  @@unique([visitanteId, terminalId])
```

- [ ] **Step 3: Gerar e aplicar a migration**

```bash
cd "e:\Apps\Condominio-app 2.0"
npx prisma migrate dev --name add_visitante_floor_room
```

Expected: migration criada e aplicada, Prisma Client regenerado.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: adicionar model Visitante e visitanteId em FacialSync"
```

---

## Task 2: `parseApartamento` — Backend e Frontend

**Files:**
- Create: `apps/api/src/hikvision/isapi/parse-apartamento.ts`
- Create: `apps/web/src/lib/parse-apartamento.ts`

- [ ] **Step 1: Criar utilitário no backend**

```typescript
// apps/api/src/hikvision/isapi/parse-apartamento.ts
export function parseApartamento(numero: string): { floorNo: number; roomNo: number } {
  const n = numero.replace(/\D/g, '');
  if (!n) return { floorNo: 0, roomNo: 0 };
  if (n.length <= 3) {
    return { floorNo: parseInt(n.slice(0, 1), 10), roomNo: parseInt(n.slice(1), 10) };
  }
  return { floorNo: parseInt(n.slice(0, -2), 10), roomNo: parseInt(n.slice(-2), 10) };
}
// "901"  → { floorNo: 9,  roomNo: 1  }
// "1403" → { floorNo: 14, roomNo: 3  }
// ""     → { floorNo: 0,  roomNo: 0  }
```

- [ ] **Step 2: Criar utilitário no frontend (cópia idêntica)**

```typescript
// apps/web/src/lib/parse-apartamento.ts
export function parseApartamento(numero: string): { floorNo: number; roomNo: number } {
  const n = numero.replace(/\D/g, '');
  if (!n) return { floorNo: 0, roomNo: 0 };
  if (n.length <= 3) {
    return { floorNo: parseInt(n.slice(0, 1), 10), roomNo: parseInt(n.slice(1), 10) };
  }
  return { floorNo: parseInt(n.slice(0, -2), 10), roomNo: parseInt(n.slice(-2), 10) };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/hikvision/isapi/parse-apartamento.ts apps/web/src/lib/parse-apartamento.ts
git commit -m "feat: utilitário parseApartamento — floor/room ID do número do apto"
```

---

## Task 3: Atualizar `UserInfo` ISAPI — floor, room, sufixo, endTime

**Files:**
- Modify: `apps/api/src/hikvision/isapi/user-info.ts`

- [ ] **Step 1: Substituir o conteúdo de `user-info.ts`**

```typescript
// apps/api/src/hikvision/isapi/user-info.ts
export interface UserInfoRecord {
  employeeNo: string;
  name: string;
  userType: 'normal' | 'admin' | 'visitor';
  floorNumber?: number;
  roomNumber?: number;
  Valid: {
    enable: boolean;
    beginTime: string;
    endTime: string;
  };
}

export interface UserInfoRequest {
  UserInfo: UserInfoRecord;
}

export function buildUserInfoPayload(params: {
  codigoFacial: number;
  nome: string;
  sufixo?: string;
  floorNo?: number;
  roomNo?: number;
  endTime?: string;
  userType?: 'normal' | 'visitor';
}): UserInfoRequest {
  const { codigoFacial, nome, sufixo = '', floorNo = 0, roomNo = 0, endTime, userType = 'normal' } = params;
  return {
    UserInfo: {
      employeeNo: String(codigoFacial),
      name: `${nome}${sufixo}`.slice(0, 32),
      userType,
      floorNumber: floorNo,
      roomNumber: roomNo,
      Valid: {
        enable: true,
        beginTime: '2000-01-01T00:00:00',
        endTime: endTime ?? '2037-12-31T23:59:59',
      },
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/hikvision/isapi/user-info.ts
git commit -m "feat: UserInfo ISAPI com floorNumber, roomNumber, sufixo e endTime"
```

---

## Task 4: Atualizar `Role` enum e `HikvisionProcessor`

**Files:**
- Modify: `apps/api/src/common/roles.enum.ts`
- Modify: `apps/api/src/hikvision/hikvision.processor.ts`

- [ ] **Step 1: Adicionar `VISITANTE` ao enum**

```typescript
// apps/api/src/common/roles.enum.ts
export enum Role {
  ADMIN = 'ADMIN',
  FUNCIONARIO = 'FUNCIONARIO',
  MORADOR = 'MORADOR',
  VISITANTE = 'VISITANTE',
}
```

- [ ] **Step 2: Atualizar o processor para suportar `Role.VISITANTE` e enviar floor/room**

Substituir o conteúdo de `apps/api/src/hikvision/hikvision.processor.ts`:

```typescript
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
import { parseApartamento } from './isapi/parse-apartamento';

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
      let codigoFacial: number;
      let sufixo = '';
      let floorNo = 0;
      let roomNo = 0;
      let endTime: string | undefined;
      let userType: 'normal' | 'visitor' = 'normal';

      if (role === Role.MORADOR) {
        const m = await this.prisma.morador.findUniqueOrThrow({
          where: { id: pessoaId },
          include: { apartamento: true },
        });
        nome = m.nome;
        codigoFacial = m.codigoFacial;
        const parsed = parseApartamento(m.apartamento.numero);
        floorNo = parsed.floorNo;
        roomNo = parsed.roomNo;
      } else if (role === Role.FUNCIONARIO) {
        const f = await this.prisma.funcionario.findUniqueOrThrow({ where: { id: pessoaId } });
        nome = f.nome;
        codigoFacial = f.codigoFacial;
        sufixo = ' (Porteiro)';
      } else {
        // VISITANTE
        const v = await this.prisma.visitante.findUniqueOrThrow({ where: { id: pessoaId } });
        nome = v.nome;
        codigoFacial = v.codigoFacial;
        sufixo = v.tipo === 'PERSONAL' ? ' (Personal)' : ' (Func. Temp)';
        userType = 'visitor';
        endTime = v.validoAte.toISOString().replace(/\.\d{3}Z$/, '');
      }

      // Step 1: Cadastrar UserInfo
      const userInfoPayload = buildUserInfoPayload({ codigoFacial, nome, sufixo, floorNo, roomNo, endTime, userType });
      try {
        await digestRequest({
          method: 'POST',
          url: `${base}/ISAPI/AccessControl/UserInfo/Record?format=json`,
          username: terminal.username,
          password,
          data: userInfoPayload,
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
      } catch (userErr: any) {
        const sub = userErr?.response?.data?.subStatusCode ?? '';
        if (sub !== 'deviceUserAlreadyExist' && sub !== 'employeeNoAlreadyExist') throw userErr;
        this.logger.warn(`UserInfo já existe no terminal ${terminal.nome} para ${pessoaId}, continuando...`);
      }

      // Step 2: Enviar foto
      const fotoBuffer = await this.hikvisionService.getFotoBuffer(pessoaId);
      const faceRecord = buildFaceDataRecord(codigoFacial);
      const boundary = crypto.randomBytes(16).toString('hex');

      const body = buildMultipart(boundary, [
        { name: 'FaceDataRecord', contentType: 'application/json', data: JSON.stringify(faceRecord) },
        { name: 'FaceImage', contentType: 'image/jpeg', filename: `${pessoaId}.jpg`, data: fotoBuffer },
      ]);

      try {
        await digestRequest({
          method: 'POST',
          url: `${base}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`,
          username: terminal.username,
          password,
          data: body,
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          timeout: 15000,
        });
      } catch (faceErr: any) {
        const sub = faceErr?.response?.data?.subStatusCode ?? '';
        if (sub !== 'deviceUserAlreadyExistFace') throw faceErr;
        this.logger.warn(`Face já existe no terminal ${terminal.nome} para ${pessoaId}, marcando OK`);
      }

      await this.prisma.facialSync.update({
        where: { id: syncId },
        data: { status: 'OK', enviadoEm: new Date(), ultimoErro: null },
      });

      this.logger.log(`Sync OK: ${pessoaId} → terminal ${terminal.nome}`);
    } catch (err: any) {
      const responseData = err?.response?.data;
      const msg = responseData?.statusString ?? err?.message ?? 'Erro desconhecido';
      this.logger.error(
        `Sync falhou: ${pessoaId} → ${syncId}: ${msg}` +
          (responseData ? ` | Response: ${JSON.stringify(responseData)}` : ''),
      );

      const sync = await this.prisma.facialSync.findUnique({ where: { id: syncId } });
      const tentativas = (sync?.tentativas ?? 0) + 1;
      const novoStatus = tentativas >= 5 ? 'FALHOU' : 'EM_FILA';

      await this.prisma.facialSync.update({
        where: { id: syncId },
        data: { status: novoStatus, tentativas, ultimoErro: msg.slice(0, 500) },
      });

      throw err;
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/roles.enum.ts apps/api/src/hikvision/hikvision.processor.ts
git commit -m "feat: processor suporta Role.VISITANTE com floor/room ID e sufixo de tipo"
```

---

## Task 5: Atualizar `HikvisionService` — enfileirarSync + listarStatusSync com visitantes

**Files:**
- Modify: `apps/api/src/hikvision/hikvision.service.ts`
- Modify: `apps/api/src/hikvision/hikvision.controller.ts`

- [ ] **Step 1: Atualizar `enfileirarSync` para suportar `Role.VISITANTE`**

Na função `enfileirarSync` do `hikvision.service.ts`, substituir o bloco completo:

```typescript
async enfileirarSync(pessoaId: string, role: Role): Promise<void> {
  const terminaisAtivos = await this.prisma.hikvisionTerminal.findMany({
    where: { ativo: true },
  });

  for (const terminal of terminaisAtivos) {
    let whereClause: any;
    let createData: any;

    if (role === Role.MORADOR) {
      whereClause = { moradorId_terminalId: { moradorId: pessoaId, terminalId: terminal.id } };
      createData = { moradorId: pessoaId, terminalId: terminal.id, status: 'PENDENTE', tentativas: 0, ultimoErro: null };
    } else if (role === Role.FUNCIONARIO) {
      whereClause = { funcionarioId_terminalId: { funcionarioId: pessoaId, terminalId: terminal.id } };
      createData = { funcionarioId: pessoaId, terminalId: terminal.id, status: 'PENDENTE', tentativas: 0, ultimoErro: null };
    } else {
      // VISITANTE
      whereClause = { visitanteId_terminalId: { visitanteId: pessoaId, terminalId: terminal.id } };
      createData = { visitanteId: pessoaId, terminalId: terminal.id, status: 'PENDENTE', tentativas: 0, ultimoErro: null };
    }

    const sync = await this.prisma.facialSync.upsert({
      where: whereClause,
      create: createData,
      update: { status: 'PENDENTE', tentativas: 0, ultimoErro: null },
    });

    await this.queue.add(
      'sync-facial',
      { syncId: sync.id, terminalId: terminal.id, pessoaId, role },
      { attempts: 5, backoff: { type: 'exponential', delay: 30000 } },
    );
  }
}
```

- [ ] **Step 2: Atualizar `listarStatusSync` para incluir visitantes**

Substituir o método `listarStatusSync` completo:

```typescript
async listarStatusSync() {
  const [moradores, funcionarios, visitantes] = await Promise.all([
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
    this.prisma.visitante.findMany({
      where: { fotoUrl: { not: null }, ativo: true },
      select: {
        id: true,
        nome: true,
        tipo: true,
        fotoUrl: true,
        validoAte: true,
        morador: { select: { nome: true } },
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

  const mapSyncs = (syncs: any[]) =>
    syncs.map((s) => ({
      terminalId: s.terminalId,
      terminalNome: s.terminal.nome,
      status: s.status,
      tentativas: s.tentativas,
      ultimoErro: s.ultimoErro,
      enviadoEm: s.enviadoEm,
    }));

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
      syncs: mapSyncs(m.facialSyncs),
    })),
    ...funcionarios.map((f) => ({
      id: f.id,
      nome: f.nome,
      tipo: 'FUNCIONARIO' as const,
      apto: null,
      fotoUrl: f.fotoUrl,
      statusGeral: calcStatus(f.facialSyncs),
      syncs: mapSyncs(f.facialSyncs),
    })),
    ...visitantes.map((v) => ({
      id: v.id,
      nome: v.nome,
      tipo: 'VISITANTE' as const,
      tipoVisitante: v.tipo,
      apto: null,
      fotoUrl: v.fotoUrl,
      validoAte: v.validoAte.toISOString(),
      moradorNome: v.morador.nome,
      statusGeral: calcStatus(v.facialSyncs),
      syncs: mapSyncs(v.facialSyncs),
    })),
  ];
}
```

- [ ] **Step 3: Atualizar `reenviarSync` no controller para aceitar `VISITANTE`**

Em `apps/api/src/hikvision/hikvision.controller.ts`, substituir o método `reenviarSync`:

```typescript
@Post('sync/:pessoaId/retry')
reenviarSync(
  @Param('pessoaId') pessoaId: string,
  @Body() body: { role: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE' },
) {
  let role: Role;
  if (body.role === 'MORADOR') role = Role.MORADOR;
  else if (body.role === 'FUNCIONARIO') role = Role.FUNCIONARIO;
  else role = Role.VISITANTE;
  return this.hikvisionService.reenviarSync(pessoaId, role).then(() => ({ ok: true }));
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/hikvision/hikvision.service.ts apps/api/src/hikvision/hikvision.controller.ts
git commit -m "feat: HikvisionService inclui visitantes em enfileirarSync e listarStatusSync"
```

---

## Task 6: Módulo `visitantes` — Backend

**Files:**
- Create: `apps/api/src/visitantes/dto/create-visitante.dto.ts`
- Create: `apps/api/src/visitantes/visitantes.service.ts`
- Create: `apps/api/src/visitantes/visitantes.controller.ts`
- Create: `apps/api/src/visitantes/visitantes.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar DTO**

```typescript
// apps/api/src/visitantes/dto/create-visitante.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsInt, Min, Max } from 'class-validator';

export enum TipoVisitanteDto {
  PERSONAL = 'PERSONAL',
  FUNCIONARIO_TEMP = 'FUNCIONARIO_TEMP',
}

export class CreateVisitanteDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoVisitanteDto)
  tipo: TipoVisitanteDto;

  @IsInt()
  @Min(1)
  @Max(12)
  meses: number;
}
```

- [ ] **Step 2: Criar Service**

```typescript
// apps/api/src/visitantes/visitantes.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService } from '../hikvision/hikvision.service';
import { FotosService } from '../fotos/fotos.service';
import { Role } from '../common/roles.enum';
import { CreateVisitanteDto } from './dto/create-visitante.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VisitantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
    private readonly fotosService: FotosService,
    private readonly config: ConfigService,
  ) {}

  async criarVisitante(moradorId: string, dto: CreateVisitanteDto) {
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

  async listarMeus(moradorId: string) {
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

  async revogarVisitante(moradorId: string, visitanteId: string) {
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

    const fs = await import('fs');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'fotos');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, `${v.id}.jpg`), compressed);

    await this.prisma.visitante.update({
      where: { id: v.id },
      data: { fotoUrl, tokenUsado: true },
    });

    await this.hikvisionService.enfileirarSync(v.id, Role.VISITANTE);
    return { fotoUrl };
  }
}
```

- [ ] **Step 3: Expor `comprimir` como método público no `FotosService`**

Em `apps/api/src/fotos/fotos.service.ts`, renomear `private async comprimir` para `async comprimirPublico` (remover `private`):

```typescript
async comprimirPublico(input: Buffer): Promise<Buffer> {
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
```

E atualizar as chamadas internas `this.comprimir(buffer)` → `this.comprimirPublico(buffer)` (são 2 chamadas em `salvarFoto` e `salvarFotoById`).

- [ ] **Step 4: Criar Controller**

```typescript
// apps/api/src/visitantes/visitantes.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { VisitantesService } from './visitantes.service';
import { CreateVisitanteDto } from './dto/create-visitante.dto';

@Controller('visitantes')
export class VisitantesController {
  constructor(private readonly visitantesService: VisitantesService) {}

  // Público — info do token
  @Get('registrar-foto/:token')
  getTokenInfo(@Param('token') token: string) {
    return this.visitantesService.getTokenInfo(token);
  }

  // Público — registrar foto
  @Post('registrar-foto/:token')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async registrarFoto(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.visitantesService.registrarFoto(token, file.buffer, file.mimetype);
  }

  // Morador autenticado
  @Get('meus')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MORADOR)
  listarMeus(@Request() req: { user: { id: string } }) {
    return this.visitantesService.listarMeus(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MORADOR)
  criar(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateVisitanteDto,
  ) {
    return this.visitantesService.criarVisitante(req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MORADOR)
  revogar(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.visitantesService.revogarVisitante(req.user.id, id);
  }
}
```

**Nota:** O JWT do morador tem `sub = apartamentoId`. O `moradorId` real precisa ser resolvido. Atualizar o método `criarVisitante` e `listarMeus` e `revogarVisitante` no service para aceitar `apartamentoId` e resolver o moradorId:

```typescript
// Em VisitantesService, adicionar helper:
private async resolverMoradorId(apartamentoId: string): Promise<string> {
  const morador = await this.prisma.morador.findFirst({
    where: { apartamentoId, ativo: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!morador) throw new BadRequestException('Morador não encontrado');
  return morador.id;
}
```

E nos três métodos públicos do morador, adicionar `const moradorId = await this.resolverMoradorId(apartamentoId);` antes de usar `moradorId`.

- [ ] **Step 5: Criar Module**

```typescript
// apps/api/src/visitantes/visitantes.module.ts
import { Module } from '@nestjs/common';
import { VisitantesController } from './visitantes.controller';
import { VisitantesService } from './visitantes.service';
import { HikvisionModule } from '../hikvision/hikvision.module';
import { FotosModule } from '../fotos/fotos.module';

@Module({
  imports: [HikvisionModule, FotosModule],
  controllers: [VisitantesController],
  providers: [VisitantesService],
})
export class VisitantesModule {}
```

- [ ] **Step 6: Registrar no AppModule**

Em `apps/api/src/app.module.ts`, adicionar import:

```typescript
import { VisitantesModule } from './visitantes/visitantes.module';
```

E adicionar `VisitantesModule` ao array `imports`.

- [ ] **Step 7: Buildar o backend para verificar erros de compilação**

```bash
cd "e:\Apps\Condominio-app 2.0"
npx nx build api --skip-nx-cache 2>&1 | tail -30
```

Expected: sem erros de TypeScript.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/visitantes/ apps/api/src/fotos/fotos.service.ts apps/api/src/app.module.ts
git commit -m "feat: módulo visitantes — criação, registro de foto e sync Hikvision"
```

---

## Task 7: Frontend — `api.ts` + namespace `visitantes`

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Adicionar namespace `visitantes` e atualizar `hikvision.retry` para aceitar VISITANTE**

Ao final de `apps/web/src/lib/api.ts`, adicionar antes do último `}`:

```typescript
// Visitantes (morador)
async function uploadFotoVisitante(blob: Blob, token: string): Promise<{ fotoUrl: string }> {
  const form = new FormData();
  form.append('file', blob, 'foto.jpg');
  const res = await fetch(`${BASE}/visitantes/registrar-foto/${token}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export const visitantes = {
  tokenInfo: (token: string) =>
    fetch(`${BASE}/visitantes/registrar-foto/${token}`)
      .then((r) => { if (!r.ok) throw new Error('Link inválido'); return r.json(); }),
  registrarFoto: (token: string, blob: Blob) => uploadFotoVisitante(blob, token),
  meus: () => request<any[]>('/visitantes/meus'),
  criar: (body: { nome: string; tipo: string; meses: number }) =>
    request<{ id: string; token: string; link: string }>('/visitantes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revogar: (id: string) => request<{ ok: boolean }>(`/visitantes/${id}`, { method: 'DELETE' }),
};
```

E atualizar `hikvision.retry`:

```typescript
retry: (pessoaId: string, role: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE') =>
  request<{ ok: boolean }>(`/hikvision/sync/${pessoaId}/retry`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: api.ts — namespace visitantes e retry com VISITANTE"
```

---

## Task 8: Frontend — Página pública `/visitante/[token]`

**Files:**
- Create: `apps/web/src/app/visitante/[token]/page.tsx`

- [ ] **Step 1: Criar a página**

```typescript
// apps/web/src/app/visitante/[token]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { visitantes as visitantesApi } from '@/lib/api';
import { Camera, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TIPO_LABEL: Record<string, string> = {
  PERSONAL: 'Personal Trainer',
  FUNCIONARIO_TEMP: 'Funcionário Temporário',
};

export default function VisitantePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [estado, setEstado] = useState<'validando' | 'invalido' | 'ja_usado' | 'pronto' | 'concluido'>('validando');
  const [info, setInfo] = useState<{ nome: string; tipo: string; moradorNome: string; validoAte: string } | null>(null);
  const [erroMsg, setErroMsg] = useState('');

  // Captura
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturaEstado, setCapturaEstado] = useState<'idle' | 'capturando' | 'preview' | 'enviando' | 'erro'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [usarInput, setUsarInput] = useState(false);
  const [capturaErro, setCapturaErro] = useState('');

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => pararStream(), [pararStream]);

  useEffect(() => {
    visitantesApi.tokenInfo(token)
      .then((data) => {
        setInfo(data);
        setEstado('pronto');
      })
      .catch((err: Error) => {
        if (err.message.includes('já registrada')) setEstado('ja_usado');
        else setEstado('invalido');
        setErroMsg(err.message);
      });
  }, [token]);

  const abrirCamera = useCallback(async () => {
    setCapturaErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCapturaEstado('capturando');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      if (['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(err?.name)) {
        setUsarInput(true);
      } else {
        setCapturaErro(`Erro ao abrir câmera: ${err?.message ?? 'desconhecido'}`);
      }
    }
  }, []);

  const tirarFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      pararStream();
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setCapturaEstado('preview');
    }, 'image/jpeg', 0.92);
  }, [pararStream]);

  const refazer = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setCapturaEstado('idle');
  }, [previewUrl]);

  const enviar = useCallback(async () => {
    if (!previewBlob) return;
    setCapturaEstado('enviando');
    try {
      await visitantesApi.registrarFoto(token, previewBlob);
      setEstado('concluido');
    } catch (err: any) {
      setCapturaErro(err.message ?? 'Erro ao enviar foto');
      setCapturaEstado('erro');
    }
  }, [previewBlob, token]);

  const handleInputFoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCapturaEstado('preview');
  }, []);

  if (estado === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Verificando link...</p>
      </div>
    );
  }

  if (estado === 'invalido') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-destructive">Link inválido ou expirado</p>
          <p className="text-sm text-muted-foreground">Solicite um novo link ao morador.</p>
        </div>
      </div>
    );
  }

  if (estado === 'ja_usado') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold">Foto já registrada</p>
          <p className="text-sm text-muted-foreground">Seu acesso facial já está cadastrado. Contate o morador se precisar atualizar.</p>
        </div>
      </div>
    );
  }

  if (estado === 'concluido') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xl font-semibold">Foto registrada com sucesso!</p>
          <p className="text-sm text-muted-foreground">Seu acesso facial será ativado em breve.</p>
        </div>
      </div>
    );
  }

  // estado === 'pronto'
  const validoAteFormatado = info
    ? new Date(info.validoAte).toLocaleDateString('pt-BR')
    : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-2xl font-bold">Olá, {info?.nome}!</p>
        <p className="text-muted-foreground">
          Você foi convidado como <strong>{TIPO_LABEL[info?.tipo ?? ''] ?? info?.tipo}</strong> por <strong>{info?.moradorNome}</strong>.
        </p>
        <p className="text-sm text-muted-foreground">Acesso válido até {validoAteFormatado}.</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <canvas ref={canvasRef} className="hidden" />

        {usarInput ? (
          <div className="space-y-3">
            {capturaEstado === 'preview' && previewUrl ? (
              <div className="space-y-3">
                <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full mx-auto border-2" />
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={refazer}>Escolher outra</Button>
                  <Button onClick={enviar}>Usar esta foto</Button>
                </div>
              </div>
            ) : capturaEstado === 'enviando' ? (
              <p className="text-center text-muted-foreground">Enviando...</p>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Selecionar foto</span>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleInputFoto} />
              </label>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className={capturaEstado === 'capturando' ? 'flex flex-col items-center gap-3' : 'hidden'}>
              <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 bg-black">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
              </div>
              <Button onClick={tirarFoto}><Camera className="h-4 w-4 mr-2" /> Tirar foto</Button>
            </div>

            {capturaEstado === 'idle' && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-40 h-40 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                  <Camera className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm text-center text-muted-foreground">Tire uma foto do seu rosto para registrar seu acesso</p>
                <Button onClick={abrirCamera}>Abrir câmera</Button>
              </div>
            )}

            {capturaEstado === 'preview' && previewUrl && (
              <div className="flex flex-col items-center gap-3">
                <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full border-2" />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={refazer}><RefreshCw className="h-4 w-4 mr-2" /> Tirar novamente</Button>
                  <Button onClick={enviar}><Check className="h-4 w-4 mr-2" /> Usar esta foto</Button>
                </div>
              </div>
            )}

            {capturaEstado === 'enviando' && (
              <p className="text-center text-muted-foreground">Enviando...</p>
            )}

            {capturaEstado === 'erro' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-destructive">{capturaErro}</p>
                <Button variant="outline" onClick={refazer}>Tentar novamente</Button>
              </div>
            )}
          </div>
        )}

        {capturaErro && capturaEstado !== 'erro' && (
          <p className="text-sm text-destructive text-center">{capturaErro}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/visitante/
git commit -m "feat: página pública /visitante/[token] para registro de foto"
```

---

## Task 9: Frontend — Seção "Meus Visitantes" em `/me`

**Files:**
- Modify: `apps/web/src/app/me/page.tsx`

- [ ] **Step 1: Adicionar imports e estado de visitantes**

No início do arquivo, adicionar ao import do `api`:
```typescript
import { encomendas as encomendasApi, fotos as fotosApi, visitantes as visitantesApi } from '@/lib/api';
```

Adicionar interfaces:
```typescript
interface Visitante {
  id: string;
  nome: string;
  tipo: 'PERSONAL' | 'FUNCIONARIO_TEMP';
  fotoUrl: string | null;
  validoAte: string;
  tokenUsado: boolean;
  statusGeral: string;
}
```

Adicionar estados dentro do componente `MePage`:
```typescript
const [visitantes, setVisitantes] = useState<Visitante[]>([]);
const [modalVisitante, setModalVisitante] = useState(false);
const [nomeVisitante, setNomeVisitante] = useState('');
const [tipoVisitante, setTipoVisitante] = useState<'PERSONAL' | 'FUNCIONARIO_TEMP'>('PERSONAL');
const [mesesVisitante, setMesesVisitante] = useState(1);
const [linkGerado, setLinkGerado] = useState('');
const [salvandoVisitante, setSalvandoVisitante] = useState(false);
const [erroVisitante, setErroVisitante] = useState('');
```

- [ ] **Step 2: Carregar visitantes no `useEffect` de carregamento**

Localizar o bloco onde encomendas são carregadas e adicionar:
```typescript
visitantesApi.meus().then(setVisitantes).catch(() => {});
```

- [ ] **Step 3: Adicionar seção "Meus Visitantes" no JSX**

Antes do fechamento do `return`, adicionar após a seção de encomendas:

```tsx
{/* Meus Visitantes */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold">Meus Visitantes</h2>
    <Button size="sm" variant="outline" onClick={() => { setNomeVisitante(''); setTipoVisitante('PERSONAL'); setMesesVisitante(1); setLinkGerado(''); setErroVisitante(''); setModalVisitante(true); }}>
      <Plus className="h-4 w-4 mr-2" /> Adicionar
    </Button>
  </div>

  {visitantes.length === 0 && (
    <p className="text-sm text-muted-foreground">Nenhum visitante cadastrado.</p>
  )}

  <div className="space-y-2">
    {visitantes.map((v) => (
      <Card key={v.id}>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="font-medium truncate">{v.nome}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {v.tipo === 'PERSONAL' ? 'Personal' : 'Func. Temp'}
              </span>
              <span className="text-xs text-muted-foreground">
                Válido até {new Date(v.validoAte).toLocaleDateString('pt-BR')}
              </span>
              {!v.tokenUsado && (
                <span className="text-xs text-amber-600">Aguardando foto</span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={async () => {
              if (!confirm(`Revogar acesso de "${v.nome}"?`)) return;
              await visitantesApi.revogar(v.id);
              setVisitantes((prev) => prev.filter((x) => x.id !== v.id));
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    ))}
  </div>
</div>

{/* Modal novo visitante */}
{modalVisitante && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={() => { if (!linkGerado) setModalVisitante(false); }} />
    <div className="relative bg-background rounded-xl border shadow-lg p-6 w-full max-w-sm space-y-4">
      {!linkGerado ? (
        <>
          <h2 className="text-lg font-semibold">Adicionar Visitante</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Nome completo"
                value={nomeVisitante}
                onChange={(e) => setNomeVisitante(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={tipoVisitante}
                onChange={(e) => setTipoVisitante(e.target.value as any)}
              >
                <option value="PERSONAL">Personal Trainer</option>
                <option value="FUNCIONARIO_TEMP">Funcionário Temporário</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Acesso por quantos meses? (máx. 12)</label>
              <input
                type="number"
                min={1}
                max={12}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={mesesVisitante}
                onChange={(e) => setMesesVisitante(Math.min(12, Math.max(1, Number(e.target.value))))}
              />
            </div>
            {erroVisitante && <p className="text-sm text-destructive">{erroVisitante}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModalVisitante(false)}>Cancelar</Button>
              <Button
                disabled={salvandoVisitante || !nomeVisitante.trim()}
                onClick={async () => {
                  setSalvandoVisitante(true);
                  setErroVisitante('');
                  try {
                    const res = await visitantesApi.criar({ nome: nomeVisitante, tipo: tipoVisitante, meses: mesesVisitante });
                    setLinkGerado(res.link);
                    visitantesApi.meus().then(setVisitantes).catch(() => {});
                  } catch (err: any) {
                    setErroVisitante(err.message ?? 'Erro ao criar visitante');
                  } finally {
                    setSalvandoVisitante(false);
                  }
                }}
              >
                {salvandoVisitante ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Link gerado!</h2>
          <p className="text-sm text-muted-foreground">Envie este link para {nomeVisitante} tirar a foto e ativar o acesso facial.</p>
          <div className="bg-muted rounded p-3 text-xs break-all font-mono">{linkGerado}</div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                const texto = encodeURIComponent(`Olá ${nomeVisitante}! Acesse o link abaixo para registrar sua foto e ativar seu acesso facial:\n${linkGerado}`);
                window.open(`https://wa.me/?text=${texto}`, '_blank');
              }}
            >
              Enviar via WhatsApp
            </Button>
            <Button variant="outline" onClick={() => setModalVisitante(false)}>Fechar</Button>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

Adicionar `Plus` ao import de `lucide-react` (já existe `X`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/me/page.tsx
git commit -m "feat: seção Meus Visitantes em /me com criação e link WhatsApp"
```

---

## Task 10: Frontend — Filtros e ordenação na aba Sync do admin Hikvision

**Files:**
- Modify: `apps/web/src/app/admin/hikvision/page.tsx`

- [ ] **Step 1: Adicionar estado de filtro e tipos de SyncEntry**

No topo do arquivo, atualizar a interface `SyncEntry`:

```typescript
interface SyncEntry {
  id: string;
  nome: string;
  tipo: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE';
  tipoVisitante?: 'PERSONAL' | 'FUNCIONARIO_TEMP';
  apto: string | null;
  fotoUrl: string | null;
  validoAte?: string;
  moradorNome?: string;
  statusGeral: string;
  syncs: { terminalId: string; terminalNome: string; status: string; tentativas: number; ultimoErro: string | null }[];
}
```

Adicionar estado de filtro:

```typescript
const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE'>('TODOS');
```

- [ ] **Step 2: Adicionar lógica de filtro e ordenação**

Adicionar função de ordenação por status antes do `return`:

```typescript
const STATUS_ORDER: Record<string, number> = {
  PENDENTE: 0, EM_FILA: 0, ENVIANDO: 0, FALHOU: 1, PARCIALMENTE_OK: 2, OK: 3,
};

const syncFiltrado = syncStatus
  .filter((s) => filtroTipo === 'TODOS' || s.tipo === filtroTipo)
  .sort((a, b) => {
    const oa = STATUS_ORDER[a.statusGeral] ?? 4;
    const ob = STATUS_ORDER[b.statusGeral] ?? 4;
    if (oa !== ob) return oa - ob;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
```

- [ ] **Step 3: Adicionar botões de filtro e atualizar tabela**

Substituir o cabeçalho da aba sync (a div `flex justify-between`):

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <div className="flex gap-1 flex-wrap">
    {(['TODOS', 'MORADOR', 'FUNCIONARIO', 'VISITANTE'] as const).map((f) => (
      <button
        key={f}
        onClick={() => setFiltroTipo(f)}
        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
          filtroTipo === f
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-input hover:bg-muted'
        }`}
      >
        {f === 'TODOS' ? 'Todos' : f === 'MORADOR' ? 'Moradores' : f === 'FUNCIONARIO' ? 'Funcionários' : 'Visitantes'}
        {' '}
        <span className="opacity-70">
          ({f === 'TODOS' ? syncStatus.length : syncStatus.filter((s) => s.tipo === f).length})
        </span>
      </button>
    ))}
  </div>
  <Button variant="outline" size="sm" onClick={carregarSync}>
    <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
  </Button>
</div>
```

E substituir `syncStatus.map(...)` por `syncFiltrado.map(...)` na tabela. Atualizar a célula de tipo:

```tsx
<td className="p-3 text-muted-foreground">
  {pessoa.tipo === 'MORADOR' ? 'Morador'
   : pessoa.tipo === 'FUNCIONARIO' ? 'Porteiro'
   : pessoa.tipoVisitante === 'PERSONAL' ? 'Personal'
   : 'Func. Temp'}
</td>
```

Adicionar coluna "Válido até" na tabela para visitantes — adicionar header e célula:

```tsx
// No thead:
<th className="text-left p-3 font-medium">Válido até</th>
// Na tr de cada pessoa:
<td className="p-3 text-muted-foreground text-xs">
  {pessoa.validoAte ? new Date(pessoa.validoAte).toLocaleDateString('pt-BR') : '—'}
</td>
```

Atualizar `handleRetry` para aceitar VISITANTE:

```typescript
async function handleRetry(pessoaId: string, tipo: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE') {
  await hikvisionApi.retry(pessoaId, tipo);
  await carregarSync();
}
```

E na célula de retry: `onClick={() => handleRetry(pessoa.id, pessoa.tipo)}`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/hikvision/page.tsx
git commit -m "feat: filtros Todos/Moradores/Funcionários/Visitantes e ordenação por prioridade na aba Sync"
```

---

## Task 11: Frontend — Agrupamento por andar em `/admin/moradores`

**Files:**
- Modify: `apps/web/src/app/admin/moradores/page.tsx`

- [ ] **Step 1: Importar `parseApartamento` e adicionar lógica de agrupamento**

No topo do arquivo, adicionar:

```typescript
import { parseApartamento } from '@/lib/parse-apartamento';
```

Adicionar função de agrupamento antes do `return`:

```typescript
const moradoresPorAndar = lista.reduce<Record<string, Morador[]>>((acc, m) => {
  const { floorNo } = parseApartamento(m.apartamento.numero);
  const key = floorNo > 0 ? `Andar ${floorNo}` : 'Sem andar';
  if (!acc[key]) acc[key] = [];
  acc[key].push(m);
  return acc;
}, {});

const andares = Object.keys(moradoresPorAndar).sort((a, b) => {
  if (a === 'Sem andar') return 1;
  if (b === 'Sem andar') return -1;
  return parseInt(a.replace('Andar ', '')) - parseInt(b.replace('Andar ', ''));
});
```

- [ ] **Step 2: Substituir a renderização da lista por agrupamento por andar**

Localizar o bloco `{!loading && lista.length > 0 && ( <> ... </> )}` e substituir a parte interna da tabela para renderizar por andar:

```tsx
{!loading && lista.length > 0 && (
  <div className="space-y-6">
    <span className="text-sm text-muted-foreground">
      {lista.length} {lista.length === 1 ? 'morador' : 'moradores'}
    </span>
    {andares.map((andar) => (
      <div key={andar} className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {andar} — {moradoresPorAndar[andar].length} {moradoresPorAndar[andar].length === 1 ? 'morador' : 'moradores'}
        </h3>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Apartamento</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Foto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {moradoresPorAndar[andar]
                .sort((a, b) => a.apartamento.numero.localeCompare(b.apartamento.numero, 'pt-BR', { numeric: true }))
                .map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{m.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatApt(m.apartamento)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{m.whatsapp ?? '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {m.fotoUrl ? (
                        <img
                          src={`http://localhost:3001${m.fotoUrl}`}
                          alt={m.nome}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem foto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemover(m.id, m.nome)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/moradores/page.tsx
git commit -m "feat: agrupamento de moradores por andar em /admin/moradores"
```

---

## Task 12: Verificação final de build

- [ ] **Step 1: Build do backend**

```bash
cd "e:\Apps\Condominio-app 2.0"
npx nx build api --skip-nx-cache 2>&1 | tail -40
```

Expected: sem erros TypeScript.

- [ ] **Step 2: Build do frontend**

```bash
npx nx build web --skip-nx-cache 2>&1 | tail -40
```

Expected: sem erros TypeScript/Next.js.

- [ ] **Step 3: Commit final se necessário**

Se algum ajuste foi feito:

```bash
git add -A
git commit -m "fix: ajustes de compilação etapa 9B"
```

---

## Self-Review

### Cobertura do spec:
- ✅ Floor/Room ID derivado do apartamento → Task 2 + Task 4
- ✅ Sufixo de tipo no nome → Task 3 + Task 4
- ✅ Model `Visitante` + migration → Task 1
- ✅ `Role.VISITANTE` → Task 4
- ✅ Módulo visitantes backend → Task 6
- ✅ Página pública `/visitante/[token]` → Task 8
- ✅ Seção "Meus Visitantes" em `/me` → Task 9
- ✅ Filtros na aba Sync + ordenação → Task 10
- ✅ Agrupamento por andar em moradores → Task 11
- ✅ `enfileirarSync` com `VISITANTE` → Task 5
- ✅ `listarStatusSync` com visitantes → Task 5

### Observações críticas:
1. O JWT do morador usa `sub = apartamentoId` (não moradorId) — o `VisitantesService` resolve isso com `resolverMoradorId`.
2. `comprimirPublico` precisa ser público no `FotosService` para ser chamado pelo `VisitantesService` — coberto na Task 6 Step 3.
3. `FotosModule` exporta `FotosService` — já exporta via `exports: [FotosService]` no módulo existente.
