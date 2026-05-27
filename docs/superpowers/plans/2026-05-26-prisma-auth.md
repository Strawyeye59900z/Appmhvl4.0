# Prisma Schema + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Etapa 2 (Prisma schema, migration, seed) and Etapa 3 (Auth: 3 login flows + JWT guards) of Condomínio App 2.0.

**Architecture:** Single Prisma schema at root consumed by `apps/api`. Three separate login endpoints (`/auth/admin`, `/auth/funcionario`, `/auth/morador`) each with distinct credential shapes, all issuing JWTs with a `role` field validated by a single `JwtStrategy`. Guards protect routes by role.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `@nestjs/bull`, BullMQ, Redis, `class-validator`, `class-transformer`, `@nestjs/config`, `cookie-parser`.

---

## File Map

### New files to create

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Complete Prisma schema (all models) |
| `apps/api/src/prisma/prisma.module.ts` | Global Prisma module |
| `apps/api/src/prisma/prisma.service.ts` | PrismaClient singleton, lifecycle hooks |
| `apps/api/src/queue/queue.module.ts` | Global BullMQ + Redis setup |
| `apps/api/src/queue/queue.constants.ts` | Queue name constants |
| `apps/api/src/common/roles.enum.ts` | `Role` enum (ADMIN, FUNCIONARIO, MORADOR) |
| `apps/api/src/auth/dto/login-admin.dto.ts` | `{ username, password }` DTO |
| `apps/api/src/auth/dto/login-funcionario.dto.ts` | `{ funcionarioId, password }` DTO |
| `apps/api/src/auth/dto/login-morador.dto.ts` | `{ apartamentoId, password }` DTO |
| `apps/api/src/auth/dto/setup-senha.dto.ts` | `{ id, novaSenha }` DTO (shared by both setup flows) |
| `apps/api/src/auth/jwt.strategy.ts` | Passport JWT strategy |
| `apps/api/src/auth/jwt-auth.guard.ts` | Guard that validates access token |
| `apps/api/src/auth/roles.decorator.ts` | `@Roles(...)` decorator |
| `apps/api/src/auth/roles.guard.ts` | Guard that checks JWT role |
| `apps/api/src/auth/auth.service.ts` | All auth business logic |
| `apps/api/src/auth/auth.controller.ts` | All auth endpoints |
| `apps/api/src/auth/auth.module.ts` | Auth module wiring |
| `apps/api/src/app.module.ts` | Root app module |
| `apps/api/src/main.ts` | NestJS bootstrap (cookie-parser, validation pipe, CORS) |
| `apps/api/src/seed/seed.ts` | Seed: admin + espacos + configuracao |
| `apps/api/src/seed/seed.cli.ts` | CLI entry point for seed script |
| `apps/api/test/auth.e2e-spec.ts` | E2E tests for all auth endpoints |

### Files to modify

| File | Change |
|---|---|
| `apps/api/package.json` | Add all runtime dependencies |
| `packages/shared/src/index.ts` | Update enums to match new schema |

---

## Task 1: Install dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install runtime dependencies in `apps/api`**

```bash
cd "apps/api" && npm install @nestjs/common@^10 @nestjs/core@^10 @nestjs/platform-express@^10 @nestjs/jwt @nestjs/passport @nestjs/config @nestjs/bull passport passport-jwt bcrypt class-validator class-transformer cookie-parser bullmq ioredis reflect-metadata rxjs
```

- [ ] **Step 2: Install type definitions**

```bash
npm install --save-dev @types/passport-jwt @types/bcrypt @types/cookie-parser @nestjs/cli @nestjs/testing
```

- [ ] **Step 3: Install Prisma client at root**

```bash
cd "../.." && npm install @prisma/client
```

- [ ] **Step 4: Verify `apps/api/package.json` has all deps**

Open `apps/api/package.json` and confirm these keys exist under `dependencies`:
`@nestjs/jwt`, `@nestjs/passport`, `bcrypt`, `bullmq`, `class-validator`, `cookie-parser`

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json package-lock.json
git commit -m "chore: install api dependencies (auth, jwt, bullmq, prisma)"
```

---

## Task 2: Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema**

Create `prisma/schema.prisma` with the following content:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

model Admin {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Funcionario {
  id             String   @id @default(cuid())
  nome           String
  fotoUrl        String?
  passwordHash   String?
  primeiroAcesso Boolean  @default(true)
  ativo          Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  encomendas Encomenda[]
}

model Apartamento {
  id             String   @id @default(cuid())
  numero         String   @unique
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
  id            String   @id @default(cuid())
  nome          String
  cpf           String?  @unique
  whatsapp      String?
  fotoUrl       String?
  ativo         Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  apartamentoId String
  apartamento   Apartamento @relation(fields: [apartamentoId], references: [id])

  encomendas  Encomenda[]
  facialSyncs FacialSync[]
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
  nome      String      @unique
  tipo      TipoReserva
  ativo     Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  reservas Reserva[]
}

model Reserva {
  id          String    @id @default(cuid())
  data        DateTime  @db.Date
  horaInicio  DateTime? @db.Time
  horaFim     DateTime? @db.Time
  observacao  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  apartamentoId   String
  apartamento     Apartamento   @relation(fields: [apartamentoId], references: [id])
  espacoReservaId String
  espacoReserva   EspacoReserva @relation(fields: [espacoReservaId], references: [id])

  @@unique([espacoReservaId, data, horaInicio])
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
  acao       String
  entidade   String?
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

- [ ] **Step 2: Generate Prisma client**

```bash
npm run prisma:generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add complete Prisma schema (all models + enums)"
```

---

## Task 3: Update shared enums

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Replace the file content to match new schema**

Replace `packages/shared/src/index.ts` with:

```ts
/**
 * Enums, tipos e constantes compartilhados entre API (NestJS) e Web (Next.js).
 * Espelham o schema Prisma — manter sincronizado ao editar prisma/schema.prisma.
 */

export enum Role {
  ADMIN = 'ADMIN',
  FUNCIONARIO = 'FUNCIONARIO',
  MORADOR = 'MORADOR',
}

export enum EncomendaStatus {
  PENDENTE = 'PENDENTE',
  RETIRADA = 'RETIRADA',
  DEVOLVIDA = 'DEVOLVIDA',
}

export enum TipoReserva {
  DIARIO = 'DIARIO',
  POR_HORA = 'POR_HORA',
}

export enum FacialSyncStatus {
  PENDENTE = 'PENDENTE',
  EM_FILA = 'EM_FILA',
  ENVIANDO = 'ENVIANDO',
  OK = 'OK',
  FALHOU = 'FALHOU',
}

export type JwtPayload = {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
};

export const REGRAS = {
  fotoMaxBytes: 1024 * 1024,
  encomendaJanelaEditMin: 10,
  reservaAntecedenciaDias: 90,
  quadraHorasMaxPorAp: 4,
  cancelamentoChurrasqueiraSalaoHorasAntes: 24,
  facialSyncMaxTentativas: 5,
} as const;
```

- [ ] **Step 2: Build shared package**

```bash
npm run build -w @condominio/shared
```

Expected: no TypeScript errors, `packages/shared/dist/` created.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat: update shared enums to match new Prisma schema"
```

---

## Task 4: Prisma migration + seed

**Files:**
- Create: `apps/api/src/seed/seed.ts`
- Create: `apps/api/src/seed/seed.cli.ts`

- [ ] **Step 1: Ensure DATABASE_URL is set**

Check that `.env` at the root has `DATABASE_URL` pointing to your running PostgreSQL.
Example: `DATABASE_URL="postgresql://postgres:password@localhost:5432/condominio"`

- [ ] **Step 2: Run first migration**

```bash
npm run prisma:migrate:dev -- --name init
```

Expected: `✔ Your database is now in sync with your schema.` Migration file created at `prisma/migrations/`.

- [ ] **Step 3: Create seed file**

Create `apps/api/src/seed/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash },
  });

  const espacos: { nome: string; tipo: 'DIARIO' | 'POR_HORA' }[] = [
    { nome: 'Quadra', tipo: 'POR_HORA' },
    { nome: 'Churrasqueira', tipo: 'DIARIO' },
    { nome: 'Salão de Festas', tipo: 'DIARIO' },
  ];

  for (const espaco of espacos) {
    await prisma.espacoReserva.upsert({
      where: { nome: espaco.nome },
      update: {},
      create: espaco,
    });
  }

  await prisma.configuracao.upsert({
    where: { chave: 'APP_NOME' },
    update: {},
    create: { chave: 'APP_NOME', valor: 'Condomínio' },
  });

  console.log('Seed concluído.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Create seed CLI entry point**

Create `apps/api/src/seed/seed.cli.ts`:

```ts
import './seed';
```

- [ ] **Step 5: Build and run seed**

```bash
npm run build -w @condominio/api && npm run seed -w @condominio/api
```

Expected output: `Seed concluído.`

- [ ] **Step 6: Verify seed in database**

```bash
npx prisma studio --schema=./prisma/schema.prisma
```

Open `http://localhost:5555`, check `Admin` table has 1 row, `EspacoReserva` has 3 rows, `Configuracao` has 1 row.

- [ ] **Step 7: Commit**

```bash
git add prisma/migrations/ apps/api/src/seed/
git commit -m "feat: first migration + seed (admin, espacos, configuracao)"
```

---

## Task 5: PrismaService + PrismaModule

**Files:**
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`

- [ ] **Step 1: Create PrismaService**

Create `apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Create PrismaModule**

Create `apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/prisma/
git commit -m "feat: add PrismaModule and PrismaService (global)"
```

---

## Task 6: QueueModule (BullMQ setup)

**Files:**
- Create: `apps/api/src/queue/queue.constants.ts`
- Create: `apps/api/src/queue/queue.module.ts`

- [ ] **Step 1: Create queue constants**

Create `apps/api/src/queue/queue.constants.ts`:

```ts
export const QUEUE_WHATSAPP = 'whatsapp';
export const QUEUE_HIKVISION = 'hikvision';
```

- [ ] **Step 2: Create QueueModule**

Create `apps/api/src/queue/queue.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { QUEUE_WHATSAPP, QUEUE_HIKVISION } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_WHATSAPP },
      { name: QUEUE_HIKVISION },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/queue/
git commit -m "feat: add QueueModule (BullMQ + Redis, global)"
```

---

## Task 7: Role enum + common helpers

**Files:**
- Create: `apps/api/src/common/roles.enum.ts`

- [ ] **Step 1: Create roles enum**

Create `apps/api/src/common/roles.enum.ts`:

```ts
export enum Role {
  ADMIN = 'ADMIN',
  FUNCIONARIO = 'FUNCIONARIO',
  MORADOR = 'MORADOR',
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/common/
git commit -m "feat: add Role enum to common"
```

---

## Task 8: Auth DTOs

**Files:**
- Create: `apps/api/src/auth/dto/login-admin.dto.ts`
- Create: `apps/api/src/auth/dto/login-funcionario.dto.ts`
- Create: `apps/api/src/auth/dto/login-morador.dto.ts`
- Create: `apps/api/src/auth/dto/setup-senha.dto.ts`

- [ ] **Step 1: Create LoginAdminDto**

Create `apps/api/src/auth/dto/login-admin.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class LoginAdminDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}
```

- [ ] **Step 2: Create LoginFuncionarioDto**

Create `apps/api/src/auth/dto/login-funcionario.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class LoginFuncionarioDto {
  @IsString()
  funcionarioId: string;

  @IsString()
  @MinLength(4)
  password: string;
}
```

- [ ] **Step 3: Create LoginMoradorDto**

Create `apps/api/src/auth/dto/login-morador.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class LoginMoradorDto {
  @IsString()
  apartamentoId: string;

  @IsString()
  @MinLength(4)
  password: string;
}
```

- [ ] **Step 4: Create SetupSenhaDto**

Create `apps/api/src/auth/dto/setup-senha.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class SetupSenhaFuncionarioDto {
  @IsString()
  funcionarioId: string;

  @IsString()
  @MinLength(6)
  novaSenha: string;
}

export class SetupSenhaMoradorDto {
  @IsString()
  apartamentoId: string;

  @IsString()
  @MinLength(6)
  novaSenha: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/dto/
git commit -m "feat: add auth DTOs (login + setup senha)"
```

---

## Task 9: JwtStrategy + guards + decorator

**Files:**
- Create: `apps/api/src/auth/jwt.strategy.ts`
- Create: `apps/api/src/auth/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/roles.decorator.ts`
- Create: `apps/api/src/auth/roles.guard.ts`

- [ ] **Step 1: Create JwtStrategy**

Create `apps/api/src/auth/jwt.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/roles.enum';

export interface JwtPayload {
  sub: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
```

- [ ] **Step 2: Create JwtAuthGuard**

Create `apps/api/src/auth/jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: Create Roles decorator**

Create `apps/api/src/auth/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../common/roles.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: Create RolesGuard**

Create `apps/api/src/auth/roles.guard.ts`:

```ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../common/roles.enum';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest();
    return required.includes(user?.role);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/jwt.strategy.ts apps/api/src/auth/jwt-auth.guard.ts apps/api/src/auth/roles.decorator.ts apps/api/src/auth/roles.guard.ts
git commit -m "feat: add JwtStrategy, JwtAuthGuard, RolesGuard, Roles decorator"
```

---

## Task 10: AuthService

**Files:**
- Create: `apps/api/src/auth/auth.service.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/test/auth.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

const mockPrisma = {
  admin: { findUnique: jest.fn() },
  funcionario: { findUnique: jest.fn(), update: jest.fn() },
  apartamento: { findUnique: jest.fn(), update: jest.fn() },
};

const mockJwt = { sign: jest.fn().mockReturnValue('mock.token') };
const mockConfig = { getOrThrow: jest.fn().mockReturnValue('secret') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('loginAdmin', () => {
    it('throws UnauthorizedException for unknown username', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      await expect(service.loginAdmin({ username: 'x', password: 'y' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: '1', passwordHash: await bcrypt.hash('correct', 10),
      });
      await expect(service.loginAdmin({ username: 'admin', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('returns accessToken on valid credentials', async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: '1', passwordHash: await bcrypt.hash('pass', 10),
      });
      const result = await service.loginAdmin({ username: 'admin', password: 'pass' });
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('loginFuncionario', () => {
    it('returns primeiroAcesso:true when passwordHash is null', async () => {
      mockPrisma.funcionario.findUnique.mockResolvedValue({
        id: '2', passwordHash: null, primeiroAcesso: true, ativo: true,
      });
      const result = await service.loginFuncionario({ funcionarioId: '2', password: 'any' });
      expect(result).toEqual({ primeiroAcesso: true });
    });

    it('returns accessToken on valid credentials', async () => {
      mockPrisma.funcionario.findUnique.mockResolvedValue({
        id: '2', passwordHash: await bcrypt.hash('pass', 10), primeiroAcesso: false, ativo: true,
      });
      const result = await service.loginFuncionario({ funcionarioId: '2', password: 'pass' });
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('loginMorador', () => {
    it('returns primeiroAcesso:true when senhaHash is null', async () => {
      mockPrisma.apartamento.findUnique.mockResolvedValue({
        id: '3', senhaHash: null, primeiroAcesso: true, ativo: true,
      });
      const result = await service.loginMorador({ apartamentoId: '3', password: 'any' });
      expect(result).toEqual({ primeiroAcesso: true });
    });

    it('returns accessToken on valid credentials', async () => {
      mockPrisma.apartamento.findUnique.mockResolvedValue({
        id: '3', senhaHash: await bcrypt.hash('pass', 10), primeiroAcesso: false, ativo: true,
      });
      const result = await service.loginMorador({ apartamentoId: '3', password: 'pass' });
      expect(result).toHaveProperty('accessToken');
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && npx jest test/auth.service.spec.ts --no-coverage
```

Expected: FAIL — `AuthService` not found.

- [ ] **Step 3: Create AuthService**

Create `apps/api/src/auth/auth.service.ts`:

```ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/roles.enum';
import { LoginAdminDto } from './dto/login-admin.dto';
import { LoginFuncionarioDto } from './dto/login-funcionario.dto';
import { LoginMoradorDto } from './dto/login-morador.dto';
import { SetupSenhaFuncionarioDto, SetupSenhaMoradorDto } from './dto/setup-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginAdmin(dto: LoginAdminDto) {
    const admin = await this.prisma.admin.findUnique({ where: { username: dto.username } });
    if (!admin) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.issueTokens(admin.id, Role.ADMIN);
  }

  async loginFuncionario(dto: LoginFuncionarioDto) {
    const func = await this.prisma.funcionario.findUnique({ where: { id: dto.funcionarioId } });
    if (!func || !func.ativo) throw new UnauthorizedException('Funcionário não encontrado');

    if (func.primeiroAcesso || !func.passwordHash) {
      return { primeiroAcesso: true };
    }

    const valid = await bcrypt.compare(dto.password, func.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.issueTokens(func.id, Role.FUNCIONARIO);
  }

  async setupSenhaFuncionario(dto: SetupSenhaFuncionarioDto) {
    const func = await this.prisma.funcionario.findUnique({ where: { id: dto.funcionarioId } });
    if (!func || !func.ativo) throw new UnauthorizedException('Funcionário não encontrado');
    if (!func.primeiroAcesso) throw new BadRequestException('Senha já configurada');

    const passwordHash = await bcrypt.hash(dto.novaSenha, 10);
    await this.prisma.funcionario.update({
      where: { id: dto.funcionarioId },
      data: { passwordHash, primeiroAcesso: false },
    });

    return this.issueTokens(func.id, Role.FUNCIONARIO);
  }

  async loginMorador(dto: LoginMoradorDto) {
    const apt = await this.prisma.apartamento.findUnique({ where: { id: dto.apartamentoId } });
    if (!apt || !apt.ativo) throw new UnauthorizedException('Apartamento não encontrado');

    if (apt.primeiroAcesso || !apt.senhaHash) {
      return { primeiroAcesso: true };
    }

    const valid = await bcrypt.compare(dto.password, apt.senhaHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.issueTokens(apt.id, Role.MORADOR);
  }

  async setupSenhaMorador(dto: SetupSenhaMoradorDto) {
    const apt = await this.prisma.apartamento.findUnique({ where: { id: dto.apartamentoId } });
    if (!apt || !apt.ativo) throw new UnauthorizedException('Apartamento não encontrado');
    if (!apt.primeiroAcesso) throw new BadRequestException('Senha já configurada');

    const senhaHash = await bcrypt.hash(dto.novaSenha, 10);
    await this.prisma.apartamento.update({
      where: { id: dto.apartamentoId },
      data: { senhaHash, primeiroAcesso: false },
    });

    return this.issueTokens(apt.id, Role.MORADOR);
  }

  async getFuncionariosAtivos() {
    return this.prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, fotoUrl: true },
      orderBy: { nome: 'asc' },
    });
  }

  issueTokens(sub: string, role: Role) {
    const accessToken = this.jwt.sign(
      { sub, role },
      { secret: this.config.getOrThrow('JWT_SECRET'), expiresIn: '15m' },
    );
    const refreshToken = this.jwt.sign(
      { sub, role },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
    return { accessToken, refreshToken };
  }

  verifyRefreshToken(token: string): { sub: string; role: Role } {
    try {
      return this.jwt.verify(token, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd apps/api && npx jest test/auth.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/test/auth.service.spec.ts
git commit -m "feat: add AuthService with all 3 login flows + setup senha + tests"
```

---

## Task 11: AuthController

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`

- [ ] **Step 1: Create AuthController**

Create `apps/api/src/auth/auth.controller.ts`:

```ts
import { Controller, Post, Get, Body, Req, Res, HttpCode, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { LoginFuncionarioDto } from './dto/login-funcionario.dto';
import { LoginMoradorDto } from './dto/login-morador.dto';
import { SetupSenhaFuncionarioDto, SetupSenhaMoradorDto } from './dto/setup-senha.dto';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('funcionarios')
  getFuncionarios() {
    return this.auth.getFuncionariosAtivos();
  }

  @Post('admin')
  @HttpCode(200)
  async loginAdmin(@Body() dto: LoginAdminDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.loginAdmin(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS);
    return { accessToken: tokens.accessToken };
  }

  @Post('funcionario')
  @HttpCode(200)
  async loginFuncionario(@Body() dto: LoginFuncionarioDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginFuncionario(dto);
    if ('primeiroAcesso' in result) return result;
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Post('funcionario/setup')
  @HttpCode(200)
  async setupFuncionario(@Body() dto: SetupSenhaFuncionarioDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.setupSenhaFuncionario(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS);
    return { accessToken: tokens.accessToken };
  }

  @Post('morador')
  @HttpCode(200)
  async loginMorador(@Body() dto: LoginMoradorDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginMorador(dto);
    if ('primeiroAcesso' in result) return result;
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Post('morador/setup')
  @HttpCode(200)
  async setupMorador(@Body() dto: SetupSenhaMoradorDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.setupSenhaMorador(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh token ausente');
    const payload = this.auth.verifyRefreshToken(token);
    const { accessToken, refreshToken } = this.auth.issueTokens(payload.sub, payload.role);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts
git commit -m "feat: add AuthController (all auth endpoints)"
```

---

## Task 12: AuthModule

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Create AuthModule**

Create `apps/api/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/auth/auth.module.ts
git commit -m "feat: add AuthModule"
```

---

## Task 13: AppModule + main.ts

**Files:**
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/main.ts`

- [ ] **Step 1: Create AppModule**

Create `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Create main.ts**

Create `apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  app.enableCors({ origin, credentials: true });

  await app.listen(3001);
  console.log(`API running on http://localhost:3001/api/v1`);
}

bootstrap();
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat: add AppModule and main.ts bootstrap"
```

---

## Task 14: Build and smoke test

**Files:** none new

- [ ] **Step 1: Ensure .env has required vars**

At the project root, confirm `.env` contains:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/condominio
JWT_SECRET=dev-jwt-secret-change-in-prod
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-prod
REDIS_HOST=localhost
REDIS_PORT=6379
APP_URL=http://localhost:3000
```

- [ ] **Step 2: Build the API**

```bash
npm run build -w @condominio/api
```

Expected: `Successfully compiled` with no errors.

- [ ] **Step 3: Start the API**

```bash
npm run start:dev -w @condominio/api
```

Expected: `API running on http://localhost:3001/api/v1`

- [ ] **Step 4: Test GET /auth/funcionarios (should return empty array)**

```bash
curl http://localhost:3001/api/v1/auth/funcionarios
```

Expected: `[]`

- [ ] **Step 5: Test POST /auth/admin with seed credentials**

```bash
curl -X POST http://localhost:3001/api/v1/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: `{"accessToken":"eyJ..."}`

- [ ] **Step 6: Test POST /auth/admin with wrong password**

```bash
curl -X POST http://localhost:3001/api/v1/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"errada"}'
```

Expected: HTTP 401 `{"message":"Credenciais inválidas"}`

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: etapas 2 e 3 completas — Prisma schema + Auth (3 fluxos + JWT + guards)"
```

- [ ] **Step 8: Update ARCHITECTURE.md and CHANGELOG.md**

Add to `docs/ARCHITECTURE.md` under **Módulos backend**:

```
- `PrismaModule` (global) — cliente Prisma singleton
- `QueueModule` (global) — BullMQ + Redis, filas: whatsapp, hikvision
- `AuthModule` — 3 fluxos de login (admin/funcionario/morador), JWT, guards
```

Add to `docs/CHANGELOG.md`:

```
## 2026-05-26 — Etapas 2 e 3: Prisma schema + Auth

**Tipo:** add

Schema Prisma completo com todos os modelos: Admin, Funcionario, Apartamento,
Morador, Encomenda, EspacoReserva, Reserva, Configuracao, AuditLog,
HikvisionTerminal, FacialSync. Primeira migration + seed (admin + espacos padrão).

Auth: três endpoints de login separados (admin/funcionario/morador), JWT access
15min + refresh 30d httpOnly cookie, PrismaModule e QueueModule globais.
Fluxo de primeiro acesso para funcionário e apartamento.
```

```bash
git add docs/
git commit -m "docs: update ARCHITECTURE.md and CHANGELOG.md for etapas 2 e 3"
```
