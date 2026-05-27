# Design — Etapas 2 e 3: Prisma Schema + Auth

**Data:** 2026-05-26
**Escopo:** Etapa 2 (Prisma schema completo + migration + seed) e Etapa 3 (Auth: 3 fluxos + guards + JWT)

---

## 1. Prisma Schema

### Modelos e relações

```
Admin            (username + passwordHash)
Funcionario      (nome + fotoUrl + passwordHash + primeiroAcesso)
Apartamento      (numero + senhaHash + primeiroAcesso)
Morador          N──1  Apartamento
Encomenda        N──1  Morador, N──1  Funcionario
EspacoReserva    (nome + tipo: DIARIO|POR_HORA + ativo)
Reserva          N──1  Apartamento, N──1  EspacoReserva
Configuracao     (chave/valor singleton)
AuditLog         (userId + role + acao + entidadeId + payload + ip + createdAt)
HikvisionTerminal  1──N  FacialSync
FacialSync       N──1  Morador, N──1  HikvisionTerminal
```

### Schema completo

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum Role {
  ADMIN
  FUNCIONARIO
  MORADOR
}

enum EncomendaStatus {
  PENDENTE
  RETIRADA
  DEVOLVIDA
}

enum TipoReserva {
  DIARIO
  POR_HORA
}

enum FacialSyncStatus {
  PENDENTE
  EM_FILA
  ENVIANDO
  OK
  FALHOU
}

// ─── Modelos ──────────────────────────────────────────────────────────────────

model Admin {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Funcionario {
  id            String   @id @default(cuid())
  nome          String
  fotoUrl       String?
  passwordHash  String?
  primeiroAcesso Boolean @default(true)
  ativo         Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  encomendas Encomenda[]
}

model Apartamento {
  id             String   @id @default(cuid())
  numero         String   @unique   // ex: "101", "202B"
  bloco          String?
  senhaHash      String?
  primeiroAcesso Boolean  @default(true)
  ativo          Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  moradores Morador[]
  reservas  Reserva[]
}

model Morador {
  id          String   @id @default(cuid())
  nome        String
  cpf         String?  @unique
  whatsapp    String?
  fotoUrl     String?
  ativo       Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  apartamentoId String
  apartamento   Apartamento @relation(fields: [apartamentoId], references: [id])

  encomendas   Encomenda[]
  facialSyncs  FacialSync[]
}

model Encomenda {
  id          String          @id @default(cuid())
  descricao   String?
  status      EncomendaStatus @default(PENDENTE)
  notificado  Boolean         @default(false)
  retiradoEm  DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  moradorId     String
  morador       Morador     @relation(fields: [moradorId], references: [id])
  funcionarioId String
  funcionario   Funcionario @relation(fields: [funcionarioId], references: [id])
}

model EspacoReserva {
  id        String      @id @default(cuid())
  nome      String      @unique  // ex: "Quadra", "Churrasqueira", "Salão de Festas"
  tipo      TipoReserva
  ativo     Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  reservas Reserva[]
}

model Reserva {
  id          String   @id @default(cuid())
  data        DateTime @db.Date
  horaInicio  DateTime? @db.Time   // null quando tipo = DIARIO
  horaFim     DateTime? @db.Time   // null quando tipo = DIARIO
  observacao  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  apartamentoId   String
  apartamento     Apartamento   @relation(fields: [apartamentoId], references: [id])
  espacoReservaId String
  espacoReserva   EspacoReserva @relation(fields: [espacoReservaId], references: [id])

  @@unique([espacoReservaId, data, horaInicio])  // evita conflito de horário
}

model Configuracao {
  chave     String   @id
  valor     String
  updatedAt DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  role       Role
  acao       String   // ex: "CREATE_ENCOMENDA", "LOGIN_ADMIN"
  entidade   String?  // ex: "Encomenda"
  entidadeId String?
  payload    Json?
  ip         String?
  createdAt  DateTime @default(now())

  @@index([userId, createdAt])
  @@index([entidade, entidadeId])
}

model HikvisionTerminal {
  id           String    @id @default(cuid())
  nome         String
  host         String
  porta        Int       @default(80)
  username     String
  passwordEnc  String
  ativo        Boolean   @default(true)
  ultimoPing   DateTime?
  ultimoStatus String?
  createdAt    DateTime  @default(now())

  sincronizacoes FacialSync[]
}

model FacialSync {
  id         String           @id @default(cuid())
  status     FacialSyncStatus @default(PENDENTE)
  tentativas Int              @default(0)
  ultimoErro String?
  enviadoEm  DateTime?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  moradorId  String
  morador    Morador           @relation(fields: [moradorId], references: [id])
  terminalId String
  terminal   HikvisionTerminal @relation(fields: [terminalId], references: [id])

  @@unique([moradorId, terminalId])
  @@index([status, updatedAt])
}
```

### Seed

O seed cria:
1. Um `Admin` com `username: "admin"` e senha definida via env `SEED_ADMIN_PASSWORD` (fallback `"admin123"` em dev).
2. Três `EspacoReserva` padrão: `Quadra` (POR_HORA), `Churrasqueira` (DIARIO), `Salão de Festas` (DIARIO).
3. Uma `Configuracao` `{ chave: "APP_NOME", valor: "Condomínio" }`.

---

## 2. Auth

### Estratégia

Opção A: três endpoints de login separados, um único `JwtStrategy`, guards por role.

### Endpoints

| Método | Rota | Body | Resposta |
|---|---|---|---|
| POST | `/auth/admin` | `{ username, password }` | `{ accessToken }` + cookie refresh |
| POST | `/auth/funcionario` | `{ funcionarioId, password }` | `{ accessToken }` ou `{ primeiroAcesso: true }` |
| POST | `/auth/funcionario/setup` | `{ funcionarioId, novaSenha }` | `{ accessToken }` + cookie refresh |
| POST | `/auth/morador` | `{ apartamentoId, password }` | `{ accessToken }` ou `{ primeiroAcesso: true }` |
| POST | `/auth/morador/setup` | `{ apartamentoId, novaSenha }` | `{ accessToken }` + cookie refresh |
| POST | `/auth/refresh` | — (cookie) | `{ accessToken }` |
| POST | `/auth/logout` | — | 200 + limpa cookie |
| GET  | `/auth/funcionarios` | — (público) | `[{ id, nome, fotoUrl }]` — lista para o select da tela de login |

### JWT Payload

```ts
interface JwtPayload {
  sub: string   // adminId | funcionarioId | apartamentoId
  role: 'ADMIN' | 'FUNCIONARIO' | 'MORADOR'
  iat: number
  exp: number
}
```

### Tokens

- **Access token:** JWT 15min, assinado com `JWT_SECRET`.
- **Refresh token:** JWT 30d, assinado com `JWT_REFRESH_SECRET`, enviado via `Set-Cookie` httpOnly, sameSite strict, secure em prod.

### Fluxos de primeiro acesso

**Funcionário:**
1. `POST /auth/funcionario` → senha ainda nula → retorna `{ primeiroAcesso: true }` (HTTP 200, sem JWT).
2. Frontend redireciona para tela de definição de senha.
3. `POST /auth/funcionario/setup` → valida que `primeiroAcesso: true` ainda → salva `bcrypt(novaSenha)`, marca `primeiroAcesso: false` → retorna JWT.

**Morador (apartamento):**
1. `POST /auth/morador` com `apartamentoId` → `senhaHash` ainda nula → retorna `{ primeiroAcesso: true }` (HTTP 200, sem JWT).
2. Frontend redireciona para tela de definição de senha.
3. `POST /auth/morador/setup` → atualiza `senhaHash` do `Apartamento`, marca `primeiroAcesso: false` → retorna JWT.

### Guards e decorators

```ts
@UseGuards(JwtAuthGuard)                     // qualquer rota autenticada
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')                              // só admin
@Roles('ADMIN', 'FUNCIONARIO')              // admin ou funcionário
```

`RolesGuard` lê `request.user.role` (populado pelo `JwtStrategy`) e compara com os roles do decorator.

### Módulos criados nesta etapa

| Módulo | Responsabilidade |
|---|---|
| `PrismaModule` | Cliente Prisma global (singleton) |
| `AuthModule` | Endpoints de login, guards, JwtStrategy |
| `QueueModule` | Setup BullMQ + Redis (global, usado nas etapas seguintes) |

---

## 3. Estrutura de arquivos gerada

```
apps/api/src/
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── queue/
│   ├── queue.module.ts
│   └── queue.constants.ts        # nomes das filas
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   ├── roles.decorator.ts
│   └── dto/
│       ├── login-admin.dto.ts
│       ├── login-funcionario.dto.ts
│       ├── login-morador.dto.ts
│       └── setup-senha.dto.ts
├── common/
│   └── roles.enum.ts
├── app.module.ts
└── main.ts
```

---

## 4. Dependências a instalar

**`apps/api`:**
```
@nestjs/jwt @nestjs/passport passport passport-jwt
@nestjs/bull bullmq ioredis
bcrypt class-validator class-transformer
@nestjs/config
cookie-parser
```

**`prisma/` (raiz):**
```
@prisma/client
```
