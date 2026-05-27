#!/usr/bin/env bash
# =============================================================================
# install.sh — Condomínio App 2.0
# Setup completo em LXC Debian/Ubuntu fresco.
# Uso: sudo bash install.sh
# =============================================================================
set -euo pipefail

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
hdr()  { echo -e "\n${CYAN}══ $1 ══${NC}\n"; }

# ── Verificações iniciais ──────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Execute como root: sudo bash install.sh"
command -v apt &>/dev/null || err "Este script requer Debian/Ubuntu (apt)"

INSTALL_DIR="/opt/condominio"
REPO_URL="https://github.com/Strawyeye59900z/Appmhvl4.0.git"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Condomínio App 2.0 — Instalação Completa         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# PASSO 1 — Dependências do sistema
# =============================================================================
hdr "Passo 1: Instalando dependências do sistema"

apt-get update -qq
apt-get install -y -qq curl git openssl postgresql redis-server

ok "PostgreSQL, Redis, Git, curl, openssl instalados"

# Node.js 20.x via NodeSource
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node.js: $(node --version)"
ok "npm: $(npm --version)"

# =============================================================================
# PASSO 2 — Configurar PostgreSQL
# =============================================================================
hdr "Passo 2: Configurando PostgreSQL"

systemctl start postgresql
systemctl enable postgresql

POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

# Cria user e banco (idempotente)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='condominio'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER condominio WITH PASSWORD '$POSTGRES_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='condominio'" | grep -q 1 \
  || sudo -u postgres createdb -O condominio condominio

ok "Banco 'condominio' e usuário criados"

# =============================================================================
# PASSO 3 — Redis
# =============================================================================
hdr "Passo 3: Configurando Redis"

systemctl start redis-server
systemctl enable redis-server
ok "Redis iniciado"

# =============================================================================
# PASSO 4 — Clonar repositório
# =============================================================================
hdr "Passo 4: Clonando repositório"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "Diretório já existe. Fazendo git pull..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
ok "Repositório em $INSTALL_DIR"

# Criar usuário não‑root para rodar os services (se ainda não existir)
if ! id -u condominio >/dev/null 2>&1; then
  useradd -r -s /usr/sbin/nologin condominio
  ok "Usuário 'condominio' criado"
fi

# =============================================================================
# PASSO 5 — Coletar variáveis interativamente
# =============================================================================
hdr "Passo 5: Configuração do ambiente"

read -rp "  Domínio Cloudflare (ex: condominio.exemplo.com.br): " APP_DOMAIN
[[ -z "$APP_DOMAIN" ]] && err "Domínio é obrigatório"
APP_URL="https://$APP_DOMAIN"

read -rp "  E-mail do admin: " ADMIN_EMAIL
[[ -z "$ADMIN_EMAIL" ]] && err "E-mail é obrigatório"

SUGGESTED_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)
read -rp "  Senha do admin [Enter para usar '$SUGGESTED_PASS']: " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-$SUGGESTED_PASS}

read -rp "  Cloudflare Tunnel Token (obtenha em dash.cloudflare.com > Zero Trust > Tunnels): " CF_TUNNEL_TOKEN
[[ -z "$CF_TUNNEL_TOKEN" ]] && warn "Tunnel token vazio — você precisará configurar manualmente depois"

read -rp "  Tailscale Auth Key (opcional — só para Hikvision, Enter para pular): " TAILSCALE_AUTHKEY

# Gerar segredos automaticamente
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
APP_SECRET=$(openssl rand -base64 32)

# =============================================================================
# PASSO 6 — Gravar .env
# =============================================================================
hdr "Passo 6: Gravando .env"

cat > "$INSTALL_DIR/.env" <<EOF
# Gerado por install.sh em $(date -u +"%Y-%m-%dT%H:%M:%SZ")

DATABASE_URL="postgresql://condominio:${POSTGRES_PASSWORD}@localhost:5432/condominio?schema=public"

JWT_SECRET="${JWT_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"

REDIS_HOST="localhost"
REDIS_PORT=6379

APP_URL="${APP_URL}"
NODE_ENV="production"
PORT=3001

APP_SECRET="${APP_SECRET}"

SEED_ADMIN_EMAIL="${ADMIN_EMAIL}"
SEED_ADMIN_PASSWORD="${ADMIN_PASSWORD}"

NEXT_PUBLIC_API_URL_INTERNAL=http://localhost:3001/api/v1
EOF

cat > "$INSTALL_DIR/apps/web/.env.local" <<EOF
# Gerado por install.sh
NEXT_PUBLIC_API_URL=https://${APP_DOMAIN}/api/v1
EOF

ok ".env gerado"

# =============================================================================
# PASSO 7 — Instalar dependências e build
# =============================================================================
hdr "Passo 7: npm install"

cd "$INSTALL_DIR"
npm install --prefer-offline 2>&1 | tail -5
ok "Dependências instaladas"

hdr "Passo 7b: Prisma generate + migrate + seed"

npx prisma generate --schema=./prisma/schema.prisma
npx prisma migrate deploy --schema=./prisma/schema.prisma
npm run build
npm run seed
ok "Banco migrado e seed aplicado"

hdr "Passo 7c: Build"

npm run build 2>&1 | tail -10
ok "Build concluído"

# =============================================================================
# PASSO 8 — Cloudflare Tunnel (cloudflared)
# =============================================================================
hdr "Passo 8: Instalando cloudflared"

if ! command -v cloudflared &>/dev/null; then
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm /tmp/cloudflared.deb
fi
ok "cloudflared: $(cloudflared --version 2>&1 | head -1)"

if [[ -n "$CF_TUNNEL_TOKEN" ]]; then
  cloudflared service install "$CF_TUNNEL_TOKEN"
  systemctl enable cloudflared
  systemctl start cloudflared
  ok "cloudflared service instalado e iniciado"
else
  warn "Cloudflare Tunnel token não fornecido. Configure manualmente:"
  warn "  cloudflared service install <TOKEN>"
fi

# =============================================================================
# PASSO 9 — Systemd services para API e Web
# =============================================================================
hdr "Passo 9: Criando systemd services"

# condominio-api
cat > /etc/systemd/system/condominio-api.service <<EOF
[Unit]
Description=Condomínio App — NestJS API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=condominio
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node apps/api/dist/main.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=condominio-api

[Install]
WantedBy=multi-user.target
EOF

# condominio-web
cat > /etc/systemd/system/condominio-web.service <<EOF
[Unit]
Description=Condomínio App — Next.js Web
After=network.target condominio-api.service

[Service]
Type=simple
User=condominio
WorkingDirectory=${INSTALL_DIR}/apps/web
EnvironmentFile=${INSTALL_DIR}/.env
EnvironmentFile=${INSTALL_DIR}/apps/web/.env.local
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node .next/standalone/apps/web/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=condominio-web

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
if command -v systemctl >/dev/null 2>&1; then
  systemctl enable condominio-api condominio-web
  systemctl start condominio-api

  # Aguarda API subir antes do web
  echo -n "  Aguardando API iniciar"
  for i in $(seq 1 20); do
    if curl -sf http://localhost:3001/api/v1/health &>/dev/null; then
      echo ""
      ok "API respondendo"
      break
    fi
    echo -n "."
    sleep 2
  done

  systemctl start condominio-web
  ok "Services condominio-api e condominio-web iniciados"
else
  warn "systemd não encontrado – iniciando serviços em background (dev mode)"
  # iniciar API em background
  cd "${INSTALL_DIR}"
  npm run dev:api &
  API_PID=$!
  # aguarda API
  echo -n "  Aguardando API iniciar"
  for i in $(seq 1 20); do
    if curl -sf http://localhost:3001/api/v1/health &>/dev/null; then
      echo ""
      ok "API respondendo"
      break
    fi
    echo -n "."
    sleep 2
  done
  # iniciar Web em background
  cd "${INSTALL_DIR}/apps/web"
  npm run dev:web &
  ok "API e Web iniciados em background (PID $API_PID)"
fi
# =============================================================================
# RESUMO FINAL
# =============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}Instalação concluída com sucesso!${NC}                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  URL:            https://${APP_DOMAIN}"
echo "  Admin e-mail:   ${ADMIN_EMAIL}"
echo "  Admin senha:    ${ADMIN_PASSWORD}"
echo ""
echo "  Comandos úteis:"
echo "    journalctl -u condominio-api -f    # logs da API"
echo "    journalctl -u condominio-web -f    # logs do Web"
echo "    journalctl -u cloudflared -f       # logs do túnel"
echo "    cd /opt/condominio && bash scripts/update.sh  # atualizar"
echo "    cd /opt/condominio && bash scripts/backup.sh  # backup"
echo ""
if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo "  ⚠  Tailscale auth key fornecida mas não instalada automaticamente."
  echo "     Para habilitar Hikvision: tailscale up --authkey='$TAILSCALE_AUTHKEY'"
  echo ""
fi
