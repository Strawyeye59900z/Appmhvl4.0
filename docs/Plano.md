# Plano — Condomínio App 2.0 (reconstrução)

## Contexto

O projeto anterior (NestJS + Next.js 14 + Postgres/Prisma + Baileys) tinha funções
sólidas (encomendas, reservas, facial queue, WhatsApp) mas três problemas:

1. **Sincronização Hikvision DS-K1T342MWX via ISAPI não funcionou** — terminais
   ficam em rede física separada do servidor LXC (Proxmox/Debian), exigindo
   acesso via Tailscale, autenticação Digest e upload de fotos pelo padrão ISAPI
   `FaceDataRecord`/`FDLib`.
2. **Interface ruim** — falta de design system coerente.
3. **Estrutura confusa** com o tempo — novas features quebravam organização
   porque não havia documento vivo descrevendo a arquitetura.

Esta reconstrução mantém a mesma stack (a decisão é deliberada — funciona),
mas reorganiza tudo do zero com camadas claras, design system shadcn/ui, e
um módulo Hikvision desacoplado pensado desde o início para topologia
Tailscale subnet router. Deploy continua em LXC com `install.sh` interativo
e `update.sh` para atualizações via `git pull`.

---

## Stack confirmada

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 + TypeScript |
| Frontend | Next.js 14 (App Router) + Tailwind + **shadcn/ui** |
| DB | PostgreSQL + Prisma 5 |
| WhatsApp | Baileys (volume persistente para sessão) |
| Auth | JWT (access 15m + refresh 30d cookie httpOnly) |
| Filas | **BullMQ + Redis** (novo — para sync Hikvision + retry WhatsApp) |
| Hikvision | `axios-digest-auth` via Tailscale |
| Deploy | Docker Compose em LXC Debian (Proxmox) |
| Logs | Pino |

Mudanças vs. anterior:
- **Adiciona Redis + BullMQ** — necessário para resolver o problema crítico de
  sincronização Hikvision com retry, idempotência e visibilidade.
- **Adiciona shadcn/ui** — base do design system.
- **Remove código legado Evolution** — só Baileys.

---

## Estrutura de diretórios

```
condominio-app/
├── apps/
│   ├── api/                       NestJS backend
│   │   └── src/
│   │       ├── auth/              JWT, guards, strategies (3 fluxos login)
│   │       ├── apartamentos/
│   │       ├── moradores/
│   │       ├── encomendas/
│   │       ├── reservas/
│   │       ├── funcionarios/
│   │       ├── fotos/             upload/compressão + LGPD
│   │       ├── drive/             abstração de FS (uploads/)
│   │       ├── whatsapp/          Baileys + fila de envio
│   │       ├── facial/            fila admin de cadastro
│   │       ├── hikvision/         ★ novo módulo (ISAPI)
│   │       │   ├── hikvision.service.ts        client Digest
│   │       │   ├── hikvision.controller.ts     admin: terminais CRUD, status, retry
│   │       │   ├── hikvision.processor.ts      BullMQ worker
│   │       │   ├── isapi/                      endpoints ISAPI tipados
│   │       │   │   ├── face-data.ts            FaceDataRecord upload
│   │       │   │   ├── user-info.ts            UserInfo (cria pessoa antes da foto)
│   │       │   │   └── search.ts               FDLib search/delete
│   │       │   └── dto/
│   │       ├── queue/             configuração BullMQ + Redis
│   │       ├── audit/             interceptor + service de audit log
│   │       ├── health/            DB, storage, WhatsApp, Redis, terminais
│   │       ├── me/
│   │       ├── prisma/
│   │       ├── seed/
│   │       └── common/            regras.ts, decorators, filters, utils
│   └── web/                       Next.js 14
│       └── src/
│           ├── app/               App Router (rotas iguais ao anterior)
│           │   ├── (public)/      login, change-password
│           │   ├── admin/         dashboard, moradores, encomendas, reservas,
│           │   │                  facial, hikvision (★ novo), whatsapp, perfil
│           │   ├── porteiro/
│           │   └── me/
│           ├── components/
│           │   ├── ui/            ★ shadcn/ui (button, card, dialog, form, table,
│           │   │                  toast, tabs, input, select, calendar, dropdown,
│           │   │                  sheet, sidebar, alert, badge, skeleton)
│           │   ├── layout/        AppShell, Sidebar, TopNav (mobile-first morador)
│           │   ├── encomendas/
│           │   ├── reservas/
│           │   ├── moradores/
│           │   └── hikvision/     ★ TerminalCard, SyncStatus
│           ├── lib/
│           │   ├── api.ts         cliente fetch tipado (namespaces por role)
│           │   ├── auth.ts        session storage + helpers
│           │   ├── useAuth.ts
│           │   └── design/        tokens (cores, espaçamentos, tipografia)
│           └── styles/
├── packages/
│   └── shared/                    enums + REGRAS + tipos ISAPI compartilhados
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── install.sh                 ★ interativo: pergunta vars, gera segredos
│   ├── update.sh                  ★ git pull + build + migrate + restart
│   ├── backup.sh                  pg_dump + uploads tarball
│   └── tailscale-check.sh         testa conectividade com terminais
├── docs/
│   ├── ARCHITECTURE.md            ★ documento vivo (atualizar a cada mudança)
│   ├── CHANGELOG.md               ★ log de mudanças estruturais
│   ├── HIKVISION.md               topologia Tailscale + ISAPI endpoints usados
│   ├── DEPLOY.md                  passo-a-passo LXC + Tailscale
│   └── DESIGN.md                  guia de design (tokens, padrões shadcn)
├── docker-compose.yml             db, redis, api, web
├── .env.example
└── README.md
```

---

## Modelos novos no Prisma

Mantém todos os modelos atuais (Admin, Funcionario, Apartamento, Morador,
Encomenda, Reserva, Configuracao, AuditLog) e adiciona:

```prisma
model HikvisionTerminal {
  id           String   @id @default(cuid())
  nome         String                       // "Portaria Principal"
  host         String                       // IP Tailscale ou LAN via subnet router
  porta        Int      @default(80)
  username     String
  passwordEnc  String                       // criptografada (AES via APP_SECRET)
  ativo        Boolean  @default(true)
  ultimoPing   DateTime?
  ultimoStatus String?                      // "ok" | "unreachable" | mensagem erro
  createdAt    DateTime @default(now())

  sincronizacoes FacialSync[]
}

model FacialSync {
  id           String   @id @default(cuid())
  moradorId    String
  terminalId   String
  status       FacialSyncStatus @default(PENDENTE)
  // PENDENTE | EM_FILA | ENVIANDO | OK | FALHOU
  tentativas   Int      @default(0)
  ultimoErro   String?
  enviadoEm    DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([moradorId, terminalId])
  @@index([status, updatedAt])
}

enum FacialSyncStatus { PENDENTE, EM_FILA, ENVIANDO, OK, FALHOU }
```

A tela `/admin/facial` deixa de ser apenas "fila manual" e passa a mostrar
o **status real por terminal** de cada morador. Cadastro vira automático:
quando admin clica "registrar", uma job BullMQ envia para todos terminais
ativos, com retry exponencial.

---

## Módulo Hikvision — desenho

**Topologia (definida com você):** subnet router Tailscale na LAN dos
terminais. O LXC acessa os IPs locais (ex: `192.168.1.50`) via subnet routing
do Tailscale — não precisa instalar Tailscale nos terminais.

**Cadastro dinâmico de terminais:** admin acessa `/admin/hikvision`, clica
"Adicionar terminal", informa nome, IP, porta, username e senha. Após salvar,
sistema testa conectividade automaticamente (`GET /ISAPI/System/deviceInfo`)
e mostra status. Senha armazenada criptografada com AES-256-GCM usando
`APP_SECRET`. Suporta de 1 a N terminais — começa com 2, escalável.

**Fluxo de cadastro de face:**

1. Admin clica "Sincronizar" para um morador → cria registros `FacialSync`
   (status PENDENTE) para cada terminal ativo → enfileira jobs BullMQ.
2. Worker (`hikvision.processor.ts`) pega job, marca `ENVIANDO`:
   - **PUT** `/ISAPI/AccessControl/UserInfo/Record?format=json` — cadastra
     pessoa com `employeeNo` = `morador.id` (ou um número derivado).
   - **POST** `/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json` — envia
     foto multipart com FaceDataRecord JSON.
3. Sucesso → `OK`. Falha → incrementa `tentativas`, salva `ultimoErro`,
   BullMQ faz retry exponencial (backoff 30s, 2min, 10min, max 5 tentativas).
4. Após 5 falhas → `FALHOU`, admin vê na UI e pode reenviar manualmente.

**Autenticação:** HTTP Digest (padrão Hikvision). Lib: `axios-digest-auth`.

**Endpoints ISAPI documentados em** `docs/HIKVISION.md` com exemplos de
request/response do modelo DS-K1T342MWX especificamente.

**Healthcheck:** job cron de 5 em 5 min faz `GET /ISAPI/System/deviceInfo`
para cada terminal, atualiza `ultimoPing` e `ultimoStatus`. UI mostra
indicador verde/vermelho.

**Script de diagnóstico:** `scripts/tailscale-check.sh` lista terminais
configurados e testa conectividade — útil quando algo falhar em prod.

---

## Design system (shadcn/ui)

- Instalação via CLI shadcn, componentes copiados para `components/ui/`
  (controle total, sem dependência de lib externa).
- **Tokens de cor:** paleta neutra + accent. Definidos em `globals.css` como
  CSS vars para light/dark mode.
- **Tipografia:** Inter (sans) — uma família só, escala consistente.
- **Layout admin/porteiro:** sidebar + topbar (desktop-first, pois operam
  em computador da portaria/escritório).
- **Layout morador:** mobile-first, bottom nav, cards grandes.
- Documentado em `docs/DESIGN.md` com exemplos de uso dos componentes
  principais (Form, Table, Dialog, Toast).

Componentes shadcn a instalar de início: `button`, `card`, `input`, `label`,
`form`, `dialog`, `sheet`, `tabs`, `table`, `toast`, `dropdown-menu`,
`select`, `calendar`, `popover`, `badge`, `alert`, `skeleton`, `avatar`,
`separator`.

---

## Scripts de deploy

**`scripts/install.sh`** (interativo, roda no LXC fresco):

1. Verifica Docker + Docker Compose instalados; se não, instala.
2. Pergunta cada variável crítica com texto explicativo de onde obter:
   - `APP_URL` — "Seu domínio público (ex: condominio.seudominio.com.br).
     Se usa Cloudflare Tunnel, é o hostname do tunnel."
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — gera senha aleatória sugerida.
   - `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `APP_SECRET` —
     **gerados automaticamente** via `openssl rand`.
   - `TAILSCALE_AUTHKEY` (opcional) — "Obtenha em
     https://login.tailscale.com/admin/settings/keys. Necessário se for
     usar Hikvision."
3. Grava `.env`, faz `docker compose pull && up -d --build`.
4. Aguarda DB pronto → roda `prisma migrate deploy` → roda seed.
5. Imprime URL de acesso e credenciais admin.

**`scripts/update.sh`** (atualização rotineira):

```bash
cd /opt/condominio
git pull
docker compose build
docker compose run --rm api npx prisma migrate deploy
docker compose up -d
docker compose logs --tail=50 api
```

**`scripts/backup.sh`** — `pg_dump` + tarball de `uploads/` + `wa_auth/`,
salvos com timestamp em `/opt/condominio/backups/`.

---

## Documentação viva

- **`docs/ARCHITECTURE.md`** — descreve a estrutura atual do projeto. Toda
  vez que um módulo é adicionado/movido/removido, este arquivo é atualizado
  no **mesmo commit**. Seções: visão geral, módulos backend, módulos
  frontend, fluxos críticos (encomenda, reserva, sync facial), decisões
  estruturais.
- **`docs/CHANGELOG.md`** — formato simples: data, tipo (add/change/remove),
  descrição da mudança estrutural e motivo. Não é changelog de versões
  semânticas — é registro de evolução arquitetural.
- Regra: PRs/commits que alterem estrutura **devem** atualizar
  ARCHITECTURE.md e CHANGELOG.md. Sem exceção. Documentado no
  `CONTRIBUTING.md` (curto, 1 página).

---

## Ordem de execução

1. **Bootstrap repo + estrutura monorepo** (npm workspaces) + ARCHITECTURE
   e CHANGELOG iniciais.
2. **Prisma schema completo** (todos os modelos incl. HikvisionTerminal/FacialSync)
   + primeira migration + seed admin.
3. **Auth completo** (3 fluxos: admin/funcionário/morador) + guards + JWT.
4. **CRUDs base**: apartamentos, moradores, funcionários.
5. **shadcn/ui setup** + AppShell + LoginScreen + design tokens.
6. **Encomendas** (backend + UI porteiro/admin/morador) + integração
   WhatsApp via fila BullMQ.
7. **Reservas** (QUADRA por hora, CHURRASQUEIRA/SALÃO dia inteiro) + PDF.
8. **WhatsApp Baileys** (módulo + QR + template).
9. **Hikvision** — module + ISAPI client + processor + UI admin
   (terminais CRUD + status por morador + retry manual). **Testar com
   `tailscale-check.sh` primeiro.**
10. **Facial admin queue** integrada com sync automático Hikvision.
11. **Scripts**: install.sh + update.sh + backup.sh + tailscale-check.sh.
12. **docker-compose.yml** (db + redis + api + web) e `.env.example`.
13. **Smoke test deploy no LXC**.

Cada etapa termina com:
- Commit + push.
- Atualização de `ARCHITECTURE.md` + `CHANGELOG.md`.
- Você faz `./scripts/update.sh` no LXC e testa.

---

## Verificação

Como você não tem ambiente local, validamos por **deploy iterativo**:

1. Cada etapa acima → push para Github → `./scripts/update.sh` no LXC.
2. Healthcheck: `curl https://seu-dominio/api/v1/health` → JSON com status
   de DB, Redis, WhatsApp, terminais Hikvision.
3. Smoke test manual de cada feature após deploy (checklist em
   `docs/SMOKE_TEST.md` — checkbox por feature).
4. Para Hikvision especificamente:
   - `scripts/tailscale-check.sh <terminal-host>` antes de tudo.
   - Cadastrar 1 morador de teste, sincronizar, verificar foto aparece
     no terminal físico.
   - Verificar `FacialSync` no banco e fila BullMQ via UI admin.
5. WhatsApp: enviar mensagem teste pelo painel admin antes de cadastrar
   encomendas reais.
6. Backup: rodar `backup.sh` manualmente antes de qualquer migration
   destrutiva.

---

## Decisões confirmadas

- **Repositório**: novo repo no Github (sugestão: `condominio-app-v2` —
  você confirma o nome final no início da execução). O antigo fica arquivado.
- **Dados**: começar do zero. Apartamentos e moradores serão recadastrados
  via UI ou bulk upload CSV (mantemos o endpoint de bulk).
- **Terminais Hikvision**: 2 hoje, com expansão prevista. UI já desenhada
  para cadastro dinâmico — admin acessa `/admin/hikvision`, clica "Adicionar
  terminal", informa nome, IP (Tailscale ou LAN via subnet router), porta,
  username e senha. Após salvar, sistema testa conectividade automaticamente
  (`GET /ISAPI/System/deviceInfo`) e mostra status. Senha armazenada
  criptografada com AES-256-GCM usando `APP_SECRET`.
