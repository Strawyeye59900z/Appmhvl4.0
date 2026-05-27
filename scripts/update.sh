#!/usr/bin/env bash
# =============================================================================
# update.sh — Condomínio App 2.0
# Atualiza o app em produção: git pull + build + migrate + restart.
# Uso: sudo bash scripts/update.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
hdr()  { echo -e "\n${CYAN}══ $1 ══${NC}\n"; }

[[ $EUID -ne 0 ]] && err "Execute como root: sudo bash scripts/update.sh"

INSTALL_DIR="/opt/condominio"
cd "$INSTALL_DIR"

hdr "1/5 — git pull"
git pull origin main
ok "Código atualizado"

hdr "2/5 — npm install"
npm install --prefer-offline 2>&1 | tail -3
ok "Dependências sincronizadas"

hdr "3/5 — Prisma migrate deploy"
npx prisma generate --schema=./prisma/schema.prisma
npx prisma migrate deploy --schema=./prisma/schema.prisma
ok "Migrações aplicadas"

hdr "4/5 — Build"
npm run build 2>&1 | tail -10
ok "Build concluído"

hdr "5/5 — Reiniciar services"
systemctl restart condominio-api
echo -n "  Aguardando API"
for i in $(seq 1 15); do
  if curl -sf http://localhost:3001/api/v1/health &>/dev/null; then
    echo ""
    ok "API respondendo"
    break
  fi
  echo -n "."
  sleep 2
done
systemctl restart condominio-web
ok "Web reiniciado"

echo ""
ok "Atualização concluída!"
echo "  Últimas linhas da API:"
journalctl -u condominio-api --no-pager -n 10
