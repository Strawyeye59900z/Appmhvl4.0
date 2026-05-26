# Guia de Execução no LXC — Etapas 2+3

Este guia detalha todos os passos para clonar o repo, instalar dependências, rodar migrations e testes no LXC (Debian).

## Pré-requisitos

- LXC rodando Debian 12 (ou similar)
- Acesso SSH como root ou com sudo
- **PostgreSQL + Redis já instalados e rodando**

Para verificar se PostgreSQL e Redis estão rodando:

```bash
# PostgreSQL
sudo systemctl status postgresql

# Redis
sudo systemctl status redis-server
```

Se não estiverem instalados, execute:

```bash
# PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Redis
sudo apt install -y redis-server

# Node.js + npm (versão LTS)
sudo apt install -y nodejs npm

# Git
sudo apt install -y git
```

---

## Passo 1: Clonar o Repositório

```bash
# Navigate to home or desired directory
cd ~

# Clone repo
git clone https://github.com/Strawyeye59900z/Appmhvl4.0.git Condominio-app

cd Condominio-app

# Verificar estrutura
ls -la
```

**Resultado esperado:**
```
.git/
.gitignore
package.json
package-lock.json
tsconfig.json
apps/
packages/
prisma/
docs/
scripts/
```

---

## Passo 2: Configurar `.env`

```bash
# Copy template
cp .env.example .env

# Edit .env com valores reais
nano .env
```

**Conteúdo do `.env` (exemplo — AJUSTE COM SEUS VALORES):**

```env
# Database
DATABASE_URL="postgresql://postgres:SUASENHAAQUI@localhost:5432/condominio?schema=public"

# JWT
JWT_SECRET="sua-chave-jwt-secreta-de-256-bits-aqui-1234567890abc"
JWT_REFRESH_SECRET="sua-chave-refresh-secreta-de-256-bits-aqui-abcd1234567890"
JWT_EXPIRES_IN=900

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API
API_PORT=3001
API_PREFIX=/api/v1
NODE_ENV=development

# App
APP_SECRET="sua-chave-app-secret-para-criptografia-aqui"
APP_URL="http://localhost:3000"
```

**Notas importantes:**
- `DATABASE_URL`: ajuste `postgres:SUASENHAAQUI` com a senha do PostgreSQL
- Gere chaves seguras: `openssl rand -base64 32`
- `API_PORT`: porta onde a API vai escutar (padrão 3001)

---

## Passo 3: Instalar Dependências

```bash
# Install root dependencies (monorepo)
npm install

# Verify workspaces
npm ls -a --depth=0
```

**Saída esperada:**
```
@condominio/monorepo
├── @condominio/api
├── @condominio/web
└── @condominio/shared
```

---

## Passo 4: Gerar Prisma Client

```bash
# Generate Prisma client
npm run prisma:generate
```

**Resultado esperado:**
```
✔ Generated Prisma Client v5.22.0 to ./node_modules/@prisma/client in...
```

---

## Passo 5: Executar Migration

```bash
# Create migration + apply schema
npm run prisma:migrate:dev -- --name init
```

**Você será perguntado:**
```
✔ Your database is now in sync with your schema.
✔ Generated Prisma Client...
✔ Run following command to create a migration from these changes:
npx prisma migrate dev
```

Se houver erro de conexão, verifique:
1. PostgreSQL está rodando: `sudo systemctl status postgresql`
2. `DATABASE_URL` está correto: teste com `psql -c "SELECT 1"`
3. Banco `condominio` existe: `createdb condominio`

---

## Passo 6: Popular com Dados Iniciais (Seed)

```bash
# Build first (seed.cli.ts precisa ser compilado)
npm run build -w @condominio/api

# Run seed
npm run seed -w @condominio/api
```

**Resultado esperado:**
```
✔ Seeded 1 Admin (username: admin, password: admin123)
✔ Seeded 3 EspacoReserva (Quadra, Churrasqueira, Salão)
✔ Seeded 1 Configuracao (default)
✔ Seed completed successfully!
```

**Admin criado:**
- Username: `admin`
- Password: `admin123`

---

## Passo 7: Rodar Testes

```bash
# Test API
npm run test -w @condominio/api
```

**Saída esperada:**
```
 PASS  src/auth/auth.service.spec.ts
  AuthService
    ✓ should hash password (XX ms)
    ✓ should validate password (XX ms)
    ✓ should create JWT (XX ms)
    ✓ should validate JWT (XX ms)
    ✓ should reject expired JWT (XX ms)
    ✓ should validate role in JWT (XX ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

Se algum teste falhar, investigue o erro — pode ser issue de timezone, JWT secret, etc.

---

## Passo 8: Build da API

```bash
# Build API
npm run build -w @condominio/api
```

**Saída esperada:**
```
src/auth/auth.controller.ts
src/auth/auth.service.ts
...
✔ Successfully compiled 42 files with tsc.
```

---

## Passo 9: Iniciar API em Modo Dev

```bash
# Start API (escuta em http://localhost:3001/api/v1)
npm run start:dev -w @condominio/api
```

**Saída esperada:**
```
[Nest] 12345   - 05/26/2026, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345   - 05/26/2026, 10:30:00 AM     LOG [InstanceLoader] PrismaModule dependencies initialized
[Nest] 12345   - 05/26/2026, 10:30:00 AM     LOG [InstanceLoader] ConfigModule dependencies initialized
[Nest] 12345   - 05/26/2026, 10:30:00 AM     LOG [InstanceLoader] AuthModule dependencies initialized
[Nest] 12345   - 05/26/2026, 10:30:00 AM     LOG [NestApplication] Nest application successfully started
```

Se vir isso, **a API está rodando**. Deixe rodando neste terminal e abra outro para smoke tests.

---

## Passo 10: Smoke Tests (Em Novo Terminal)

Abra **outro terminal SSH** e execute:

### 10.1 Test Health Check

```bash
curl http://localhost:3001/api/v1/health
```

**Resultado esperado:**
```json
{
  "database": "ok",
  "redis": "ok",
  "uptime": 15.234
}
```

### 10.2 Test Login Admin

```bash
curl -X POST http://localhost:3001/api/v1/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Resultado esperado:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "ADMIN"
}
```

### 10.3 Test List Funcionarios (Requer JWT)

```bash
# Use o accessToken do teste anterior
curl -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI" \
  http://localhost:3001/api/v1/funcionarios
```

**Resultado esperado:**
```json
[]
```

(Vazio porque ainda não há funcionários cadastrados)

---

## Troubleshooting

### ❌ `Error: connect ECONNREFUSED 127.0.0.1:5432`
PostgreSQL não está rodando ou senha está errada.

```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Testar conexão
psql -h localhost -U postgres -c "SELECT 1"

# Se pedir senha e não souber, resete:
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'sua-nova-senha';"
```

### ❌ `Error: connect ECONNREFUSED 127.0.0.1:6379`
Redis não está rodando.

```bash
# Verificar Redis
sudo systemctl status redis-server

# Testar conexão
redis-cli ping
```

### ❌ `Module not found: @condominio/shared`
Dependências não foram instaladas corretamente.

```bash
# Limpar e reinstalar
rm -rf node_modules
npm install
```

### ❌ Seed falha com `duplicate key value`
Banco já tem dados. Limpar e migrar novamente:

```bash
# Drop schema + recreate
npm run prisma:migrate:reset -- --force

# Rerun seed
npm run seed -w @condominio/api
```

---

## Next Steps

1. **Após testes passarem**, desligue a API (Ctrl+C) e retorne aqui.
2. Você pode deixar executando para testes manuais ou parar.
3. Próxima etapa: **Etapa 4 (CRUDs base)** — após confirmar que tudo funcionou.

---

## Resumo dos Comandos

```bash
# Rápido — se já tem DB, tudo instalado
cd Condominio-app
npm install
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
npm run build -w @condominio/api
npm run seed -w @condominio/api
npm run test -w @condominio/api
npm run start:dev -w @condominio/api

# Em outro terminal
curl http://localhost:3001/api/v1/health
```
