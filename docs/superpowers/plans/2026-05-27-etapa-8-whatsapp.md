# Etapa 8 — WhatsApp Baileys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar WhatsApp via Baileys ao backend NestJS para notificar moradores sobre encomendas, exibir QR code de conexão na tela admin, e tornar o campo WhatsApp obrigatório com entrada separada DDD + número prefixada com +55.

**Architecture:** Baileys roda como singleton NestJS injectable, expõe QR code via SSE (Server-Sent Events) em endpoint admin. Processor BullMQ consome a fila `whatsapp` já existente e usa o client Baileys para enviar mensagens. O campo WhatsApp no morador muda de opcional para obrigatório — o frontend sempre prefixará `+55` e enviará o número formatado.

**Tech Stack:** `@whiskeysockets/baileys`, `qrcode` (npm), NestJS BullMQ Processor, Next.js SSE via `EventSource`, `class-validator`

---

## Mapa de arquivos

### Backend — novos
- `apps/api/src/whatsapp/whatsapp.client.ts` — singleton Baileys, QR code, send, status
- `apps/api/src/whatsapp/whatsapp.processor.ts` — BullMQ processor para `notificar-encomenda`
- `apps/api/src/whatsapp/whatsapp.controller.ts` — GET /whatsapp/status, GET /whatsapp/qr (SSE)
- `apps/api/src/whatsapp/whatsapp.module.ts` — agrupa os providers acima

### Backend — modificados
- `apps/api/package.json` — adicionar `@whiskeysockets/baileys` e `qrcode`
- `apps/api/src/app.module.ts` — importar WhatsAppModule
- `apps/api/src/moradores/dto/create-morador.dto.ts` — whatsapp obrigatório + validação E.164
- `apps/api/src/moradores/moradores.service.ts` — remover campo opcional do create

### Frontend — modificados
- `apps/web/src/app/admin/whatsapp/page.tsx` — QR code display + status badge
- `apps/web/src/app/me/moradores/page.tsx` — input DDD + número obrigatório
- `apps/web/src/components/auth/LoginScreen.tsx` — input DDD + número obrigatório no cadastro inline
- `apps/web/src/lib/api.ts` — adicionar `whatsapp.status()` e `whatsapp.qr()`

---

## Task 1: Instalar dependências Baileys

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Adicionar dependências**

```json
// Em apps/api/package.json, dentro de "dependencies":
"@whiskeysockets/baileys": "^6.7.0",
"qrcode": "^1.5.3",
"@types/qrcode": "^1.5.5"
```

- [ ] **Step 2: Instalar**

```powershell
cd "e:\Apps\Condominio-app 2.0"
npm install --workspace=apps/api @whiskeysockets/baileys qrcode @types/qrcode
```

Esperado: sem erros, `node_modules/@whiskeysockets/baileys` presente.

- [ ] **Step 3: Commit**

```powershell
git add apps/api/package.json package-lock.json
git commit -m "chore: add baileys and qrcode dependencies"
```

---

## Task 2: WhatsApp Client (Baileys singleton)

**Files:**
- Create: `apps/api/src/whatsapp/whatsapp.client.ts`

- [ ] **Step 1: Criar o client**

```typescript
// apps/api/src/whatsapp/whatsapp.client.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class WhatsAppClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppClient.name);
  private socket: WASocket | null = null;
  private qrBase64: string | null = null;
  private connected = false;
  private readonly authDir = path.join(process.cwd(), 'baileys-auth');

  async onModuleInit() {
    if (!fs.existsSync(this.authDir)) fs.mkdirSync(this.authDir, { recursive: true });
    await this.connect();
  }

  onModuleDestroy() {
    this.socket?.end(undefined);
  }

  private async connect() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    this.socket = makeWASocket({ auth: state, printQRInTerminal: false, logger: undefined as any });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrBase64 = await QRCode.toDataURL(qr);
        this.logger.log('QR code gerado — acesse /whatsapp/qr no painel admin');
      }

      if (connection === 'open') {
        this.connected = true;
        this.qrBase64 = null;
        this.logger.log('WhatsApp conectado');
      }

      if (connection === 'close') {
        this.connected = false;
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Conexão encerrada — reconectar: ${shouldReconnect}`);
        if (shouldReconnect) {
          setTimeout(() => this.connect(), 5000);
        } else {
          // Logged out: limpa auth para forçar novo QR
          fs.rmSync(this.authDir, { recursive: true, force: true });
          fs.mkdirSync(this.authDir, { recursive: true });
          setTimeout(() => this.connect(), 1000);
        }
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getQR(): string | null {
    return this.qrBase64;
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.socket || !this.connected) {
      this.logger.warn(`WhatsApp não conectado — mensagem para ${to} descartada`);
      return;
    }
    // Garantir formato JID do WhatsApp: número sem + seguido de @s.whatsapp.net
    const jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    await this.socket.sendMessage(jid, { text });
  }
}
```

- [ ] **Step 2: Verificar que o TypeScript compila**

```powershell
cd "e:\Apps\Condominio-app 2.0\apps\api"
npx tsc --noEmit
```

Esperado: sem erros relacionados ao `whatsapp.client.ts`.

---

## Task 3: WhatsApp Processor (BullMQ)

**Files:**
- Create: `apps/api/src/whatsapp/whatsapp.processor.ts`

- [ ] **Step 1: Criar o processor**

```typescript
// apps/api/src/whatsapp/whatsapp.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';
import { WhatsAppClient } from './whatsapp.client';

interface NotificarEncomendaPayload {
  encomendaId: string;
  moradorNome: string;
  moradorWhatsapp: string | null;
  apartamento: { numero: string; bloco?: string | null };
  descricao?: string | null;
}

@Processor(QUEUE_WHATSAPP)
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(private readonly whatsapp: WhatsAppClient) {}

  @Process('notificar-encomenda')
  async handleNotificarEncomenda(job: Job<NotificarEncomendaPayload>) {
    const { moradorNome, moradorWhatsapp, apartamento } = job.data;

    if (!moradorWhatsapp) {
      this.logger.debug(`Morador ${moradorNome} sem WhatsApp — notificação ignorada`);
      return;
    }

    const apto = apartamento.bloco
      ? `Bloco ${apartamento.bloco}, Apto ${apartamento.numero}`
      : `Apto ${apartamento.numero}`;

    const texto =
      `Olá ${moradorNome}! 📦\n\n` +
      `Uma encomenda chegou para o ${apto}.\n` +
      `Retire na portaria assim que possível.\n\n` +
      `_Condomínio App_`;

    try {
      await this.whatsapp.sendMessage(moradorWhatsapp, texto);
      this.logger.log(`Notificação enviada para ${moradorWhatsapp} (${moradorNome})`);
    } catch (err) {
      this.logger.error(`Falha ao enviar para ${moradorWhatsapp}: ${err}`);
      throw err; // BullMQ vai retentar conforme configuração
    }
  }
}
```

---

## Task 4: WhatsApp Controller

**Files:**
- Create: `apps/api/src/whatsapp/whatsapp.controller.ts`

- [ ] **Step 1: Criar o controller**

```typescript
// apps/api/src/whatsapp/whatsapp.controller.ts
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppClient } from './whatsapp.client';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppClient) {}

  @Get('status')
  getStatus() {
    return { connected: this.whatsapp.isConnected() };
  }

  @Get('qr')
  getQR(@Res() res: Response) {
    const qr = this.whatsapp.getQR();
    if (!qr) {
      return res.status(204).send();
    }
    // Retorna data URL base64 diretamente — o frontend exibe como <img src={qr} />
    return res.json({ qr });
  }
}
```

> **Nota:** Verificar que `JwtAuthGuard`, `RolesGuard` e `Roles` existem nos paths acima. Se o guard estiver em caminho diferente, ajustar o import. Padrão do projeto: `apps/api/src/auth/`.

- [ ] **Step 2: Confirmar paths dos guards**

```powershell
ls "e:\Apps\Condominio-app 2.0\apps\api\src\auth\" | Select-Object Name
```

Esperado: ver `jwt-auth.guard.ts`, `roles.guard.ts`, `roles.decorator.ts`.

---

## Task 5: WhatsApp Module

**Files:**
- Create: `apps/api/src/whatsapp/whatsapp.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar o módulo**

```typescript
// apps/api/src/whatsapp/whatsapp.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_WHATSAPP } from '../queue/queue.constants';
import { WhatsAppClient } from './whatsapp.client';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppController } from './whatsapp.controller';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_WHATSAPP })],
  controllers: [WhatsAppController],
  providers: [WhatsAppClient, WhatsAppProcessor],
  exports: [WhatsAppClient],
})
export class WhatsAppModule {}
```

- [ ] **Step 2: Registrar no AppModule**

Em `apps/api/src/app.module.ts`, adicionar import:

```typescript
import { WhatsAppModule } from './whatsapp/whatsapp.module';

// Dentro de @Module({ imports: [...] })
// Adicionar após ReservasModule:
WhatsAppModule,
```

- [ ] **Step 3: Verificar compilação**

```powershell
cd "e:\Apps\Condominio-app 2.0\apps\api"
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/api/src/whatsapp/ apps/api/src/app.module.ts
git commit -m "feat: whatsapp baileys client, processor e module"
```

---

## Task 6: WhatsApp obrigatório no DTO e Service

**Files:**
- Modify: `apps/api/src/moradores/dto/create-morador.dto.ts`
- Modify: `apps/api/src/moradores/moradores.service.ts`

**Contexto:** O campo `whatsapp` no Prisma já existe como `String?` (opcional). Vamos torná-lo obrigatório **na validação do DTO** (sem migration Prisma), exigindo um número E.164 completo no formato `+55XXXXXXXXXXX`.

- [ ] **Step 1: Atualizar o DTO**

```typescript
// apps/api/src/moradores/dto/create-morador.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateMoradorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apartamentoId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'CPF inválido' })
  cpf?: string;

  @IsString()
  @IsNotEmpty({ message: 'WhatsApp é obrigatório' })
  @Matches(/^\+55\d{10,11}$/, { message: 'WhatsApp inválido. Use o formato +55XXXXXXXXXXX' })
  whatsapp: string;
}
```

- [ ] **Step 2: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/api/src/moradores/dto/create-morador.dto.ts
git commit -m "feat: whatsapp obrigatorio no DTO de morador (validacao E.164 +55)"
```

---

## Task 7: Frontend — API client para WhatsApp

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Adicionar namespace `whatsapp`**

No final do arquivo `apps/web/src/lib/api.ts`, antes do último export ou no fim do arquivo:

```typescript
// WhatsApp
export const whatsapp = {
  status: () => request<{ connected: boolean }>('/whatsapp/status'),
  qr: () => request<{ qr: string } | null>('/whatsapp/qr'),
};
```

- [ ] **Step 2: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/web/src/lib/api.ts
git commit -m "feat: adicionar namespace whatsapp no api client"
```

---

## Task 8: Frontend — Tela admin WhatsApp (QR + status)

**Files:**
- Modify: `apps/web/src/app/admin/whatsapp/page.tsx`

- [ ] **Step 1: Implementar a tela**

```typescript
// apps/web/src/app/admin/whatsapp/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { whatsapp as whatsappApi } from '@/lib/api';

export default function WhatsAppPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await whatsappApi.status();
      setConnected(status.connected);

      if (!status.connected) {
        try {
          const qrRes = await whatsappApi.qr();
          setQr(qrRes?.qr ?? null);
        } catch {
          setQr(null);
        }
      } else {
        setQr(null);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Polling a cada 5s enquanto não conectado
    const interval = setInterval(() => {
      if (!connected) refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh, connected]);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status da conexão</CardTitle>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connected === null ? (
            <p className="text-sm text-muted-foreground">Verificando...</p>
          ) : connected ? (
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-green-600 border-green-600">
                Conectado
              </Badge>
              <span className="text-sm text-muted-foreground ml-2">
                Notificações de encomendas ativas
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-destructive" />
              <Badge variant="destructive">Desconectado</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {!connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escanear QR Code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qr ? (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo → escaneie o código abaixo:
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56 rounded-lg border" />
                <p className="text-xs text-muted-foreground">
                  O código atualiza automaticamente a cada 5 segundos
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-6">
                Aguardando geração do QR code...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/web/src/app/admin/whatsapp/page.tsx
git commit -m "feat: tela admin whatsapp com qr code e status"
```

---

## Task 9: Frontend — Input de WhatsApp (DDD + número) como componente reutilizável

**Files:**
- Create: `apps/web/src/components/ui/whatsapp-input.tsx`

Esse componente é usado em 3 lugares (formulário de morador, cadastro inline no login, tela `/me/moradores`). Criamos uma vez e reutilizamos.

- [ ] **Step 1: Criar o componente**

```typescript
// apps/web/src/components/ui/whatsapp-input.tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WhatsAppInputProps {
  ddd: string;
  numero: string;
  onDddChange: (v: string) => void;
  onNumeroChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}

/** Retorna o número completo no formato E.164: +55DDNNNNNNNNN */
export function formatWhatsApp(ddd: string, numero: string): string {
  return `+55${ddd.replace(/\D/g, '')}${numero.replace(/\D/g, '')}`;
}

/** Valida se o número montado é válido (+55 + 2 dígitos DDD + 8 ou 9 dígitos) */
export function isWhatsAppValid(ddd: string, numero: string): boolean {
  const clean = ddd.replace(/\D/g, '') + numero.replace(/\D/g, '');
  return /^\d{10,11}$/.test(clean);
}

export function WhatsAppInput({
  ddd,
  numero,
  onDddChange,
  onNumeroChange,
  required = true,
  disabled = false,
}: WhatsAppInputProps) {
  return (
    <div className="space-y-1.5">
      <Label>
        WhatsApp{required ? '' : ' (opcional)'}
      </Label>
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground font-mono shrink-0">+55</span>
        <Input
          className="w-16 shrink-0"
          placeholder="11"
          maxLength={2}
          value={ddd}
          onChange={(e) => onDddChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          aria-label="DDD"
        />
        <Input
          placeholder="999990000"
          maxLength={9}
          value={numero}
          onChange={(e) => onNumeroChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          aria-label="Número"
        />
      </div>
      <p className="text-xs text-muted-foreground">DDD + número (ex: 11 + 999990000)</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/web/src/components/ui/whatsapp-input.tsx
git commit -m "feat: componente WhatsAppInput reutilizavel (DDD + numero)"
```

---

## Task 10: Frontend — Formulário de morador (`/me/moradores`) com WhatsApp obrigatório

**Files:**
- Modify: `apps/web/src/app/me/moradores/page.tsx`

- [ ] **Step 1: Atualizar o formulário**

Substituir o conteúdo do arquivo com a versão abaixo (usa `WhatsAppInput`):

```typescript
// apps/web/src/app/me/moradores/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { WhatsAppInput, formatWhatsApp, isWhatsAppValid } from '@/components/ui/whatsapp-input';
import { moradores as moradoresApi } from '@/lib/api';

interface Morador {
  id: string;
  nome: string;
  whatsapp: string | null;
}

export default function MeusMoradoresPage() {
  const [lista, setLista] = useState<Morador[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [ddd, setDdd] = useState('');
  const [numero, setNumero] = useState('');
  const [criando, setCriando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLista(await moradoresApi.meus());
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSucesso('');
    if (!isWhatsAppValid(ddd, numero)) {
      setErro('WhatsApp inválido. Preencha o DDD (2 dígitos) e o número (8 ou 9 dígitos).');
      return;
    }
    setCriando(true);
    try {
      await moradoresApi.create({ nome, whatsapp: formatWhatsApp(ddd, numero) });
      setSucesso(`${nome} adicionado.`);
      setNome(''); setDdd(''); setNumero('');
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar morador');
    } finally {
      setCriando(false);
    }
  }

  async function handleRemover(id: string, nomeMorador: string) {
    if (!confirm(`Remover ${nomeMorador}?`)) return;
    setErro(''); setSucesso('');
    setRemovendo(id);
    try {
      await moradoresApi.remove(id);
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover morador');
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Moradores do apartamento</h1>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <form onSubmit={handleCriar} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setErro(''); }}
                required
              />
            </div>
            <WhatsAppInput
              ddd={ddd}
              numero={numero}
              onDddChange={(v) => { setDdd(v); setErro(''); }}
              onNumeroChange={(v) => { setNumero(v); setErro(''); }}
              required
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}
            <Button type="submit" className="w-full" disabled={criando || !nome.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {criando ? 'Adicionando...' : 'Adicionar morador'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loading && lista.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhum morador cadastrado ainda.</p>
        </div>
      )}

      {lista.length > 0 && (
        <div className="space-y-2">
          {lista.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{m.nome}</p>
                  {m.whatsapp && (
                    <p className="text-xs text-muted-foreground">{m.whatsapp}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo === m.id}
                  onClick={() => handleRemover(m.id, m.nome)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/web/src/app/me/moradores/page.tsx
git commit -m "feat: whatsapp obrigatorio na tela de moradores do apt"
```

---

## Task 11: Frontend — Cadastro inline no LoginScreen com WhatsApp obrigatório

**Files:**
- Modify: `apps/web/src/components/auth/LoginScreen.tsx`

O `LoginScreen.tsx` tem a seção de cadastro inline de morador pós-login. Precisamos trocar os states `moradorWhats` (string única) por `moradorDdd` + `moradorNumero`, e usar o `WhatsAppInput`.

- [ ] **Step 1: Atualizar LoginScreen**

Localizar no `LoginScreen.tsx` a seção do step `cadastro` e fazer as seguintes mudanças:

**Trocar state:**
```typescript
// Remover:
const [moradorWhats, setMoradorWhats] = useState('');

// Adicionar:
const [moradorDdd, setMoradorDdd] = useState('');
const [moradorNumero, setMoradorNumero] = useState('');
```

**Import adicional no topo do arquivo:**
```typescript
import { WhatsAppInput, formatWhatsApp, isWhatsAppValid } from '@/components/ui/whatsapp-input';
```

**No `handleCadastrarMorador`, trocar a referência a `moradorWhats`:**
```typescript
// Antes:
body: JSON.stringify({ nome: moradorNome, whatsapp: moradorWhats || undefined }),

// Depois:
body: JSON.stringify({ nome: moradorNome, whatsapp: formatWhatsApp(moradorDdd, moradorNumero) }),
```

**E adicionar validação antes do fetch:**
```typescript
async function handleCadastrarMorador(e: React.FormEvent) {
  e.preventDefault();
  setError('');
  if (!isWhatsAppValid(moradorDdd, moradorNumero)) {
    setError('WhatsApp inválido. Preencha o DDD (2 dígitos) e o número (8 ou 9 dígitos).');
    return;
  }
  setCadastrandoMorador(true);
  // ... resto do handler igual
```

**Trocar o bloco JSX do input de WhatsApp no formulário de cadastro:**
```tsx
{/* Remover este bloco: */}
<div className="space-y-2">
  <Label>WhatsApp (opcional)</Label>
  <Input
    placeholder="11999990000"
    value={moradorWhats}
    onChange={(e) => setMoradorWhats(e.target.value)}
  />
</div>

{/* Substituir por: */}
<WhatsAppInput
  ddd={moradorDdd}
  numero={moradorNumero}
  onDddChange={(v) => { setMoradorDdd(v); setError(''); }}
  onNumeroChange={(v) => { setMoradorNumero(v); setError(''); }}
  required
/>
```

**Limpar states no `setSucesso` handler (após salvar):**
```typescript
setMoradorSucesso(`${moradorNome} cadastrado!`);
setMoradorNome(''); setMoradorDdd(''); setMoradorNumero('');
```

- [ ] **Step 2: Commit**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git add apps/web/src/components/auth/LoginScreen.tsx
git commit -m "feat: whatsapp obrigatorio no cadastro inline de morador no login"
```

---

## Task 12: Commit bcryptjs pendente + push final

**Contexto:** Da sessão anterior, a troca `bcrypt` → `bcryptjs` não foi commitada. Precisa commitar antes do push para o LXC não quebrar.

- [ ] **Step 1: Verificar diff atual**

```powershell
cd "e:\Apps\Condominio-app 2.0"
git status
git diff --stat
```

- [ ] **Step 2: Commitar arquivos modificados da etapa anterior se ainda não commitados**

Se `auth.service.ts` e outros aparecerem no diff sem commit (bcryptjs), adicionar ao commit final junto com as mudanças da etapa 8.

- [ ] **Step 3: Push**

```powershell
git push origin main
```

Esperado: push aceito. No LXC: `git pull && npm install && npm run build --workspace=apps/api`.

---

## Self-Review

**Spec coverage:**
- ✅ QR code na tela admin — Task 8 (polling + `<img src={qr}>`)
- ✅ Baileys client singleton com reconexão — Task 2
- ✅ Processor BullMQ envia mensagem — Task 3
- ✅ WhatsApp obrigatório no morador — Tasks 6, 9, 10, 11
- ✅ Prefixo +55, DDD separado, número separado — Task 9 (componente reutilizável)
- ✅ Registrado no AppModule — Task 5
- ✅ Integração com fila existente — sem mudança no `encomendas.service.ts` (já enfileira)
- ✅ Auth guard ADMIN nos endpoints — Task 4

**Placeholders:** nenhum encontrado — todos os steps têm código completo.

**Type consistency:**
- `WhatsAppClient` — nome consistente entre module, processor e controller ✅
- `formatWhatsApp` e `isWhatsAppValid` — exportados do componente e usados em Tasks 10 e 11 ✅
- `QUEUE_WHATSAPP` — importado de `queue.constants.ts` em todos os arquivos que precisam ✅
- Payload `notificar-encomenda` — interface definida no processor bate com o que `encomendas.service.ts` enfileira ✅
