#!/usr/bin/env bash
# =============================================================================
# backup.sh — Condomínio App 2.0
# Faz pg_dump + tarball de uploads e sessão WhatsApp.
# Uso: sudo bash scripts/backup.sh
# Backups salvos em /opt/condominio/backups/
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Execute como root: sudo bash scripts/backup.sh"

INSTALL_DIR="/opt/condominio"
BACKUP_DIR="$INSTALL_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

# Carregar variáveis de ambiente
set -a; source "$INSTALL_DIR/.env"; set +a

echo "Backup em: $BACKUP_PATH"
echo ""

# 1. pg_dump
echo "  PostgreSQL..."
sudo -u postgres pg_dump condominio | gzip > "$BACKUP_PATH/db.sql.gz"
ok "DB: $BACKUP_PATH/db.sql.gz ($(du -sh "$BACKUP_PATH/db.sql.gz" | cut -f1))"

# 2. uploads
UPLOADS_DIR="$INSTALL_DIR/apps/api/uploads"
if [[ -d "$UPLOADS_DIR" ]]; then
  tar -czf "$BACKUP_PATH/uploads.tar.gz" -C "$INSTALL_DIR/apps/api" uploads
  ok "Uploads: $BACKUP_PATH/uploads.tar.gz ($(du -sh "$BACKUP_PATH/uploads.tar.gz" | cut -f1))"
else
  warn "Diretório uploads não encontrado ($UPLOADS_DIR) — pulando"
fi

# 3. Sessão Baileys (wa_auth)
WA_DIR="$INSTALL_DIR/apps/api/baileys-auth"
if [[ -d "$WA_DIR" ]]; then
  tar -czf "$BACKUP_PATH/baileys-auth.tar.gz" -C "$INSTALL_DIR/apps/api" baileys-auth
  ok "Baileys auth: $BACKUP_PATH/baileys-auth.tar.gz"
else
  warn "baileys-auth não encontrado — WhatsApp ainda não conectado"
fi

# Limpar backups com mais de 30 dias
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo ""
ok "Backup completo em $BACKUP_PATH"
echo "  Para restaurar DB: gunzip -c $BACKUP_PATH/db.sql.gz | sudo -u postgres psql condominio"
