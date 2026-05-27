#!/usr/bin/env bash
# =============================================================================
# tailscale-check.sh — Condomínio App 2.0
# Testa conectividade com terminais Hikvision via Tailscale/LAN.
# Uso: bash scripts/tailscale-check.sh [HOST] [PORTA]
# Exemplo: bash scripts/tailscale-check.sh 192.168.1.50 80
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

HOST="${1:-}"
PORT="${2:-80}"

if [[ -z "$HOST" ]]; then
  echo "Uso: bash scripts/tailscale-check.sh <HOST> [PORTA]"
  echo "Exemplo: bash scripts/tailscale-check.sh 192.168.1.50 80"
  echo ""

  # Tenta listar terminais do banco se .env existir
  INSTALL_DIR="/opt/condominio"
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    warn "Lendo terminais do banco..."
    DB_URL=$(grep DATABASE_URL "$INSTALL_DIR/.env" | cut -d'"' -f2)
    PGPASSWORD=$(echo "$DB_URL" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|') \
    psql "$DB_URL" -t -c "SELECT nome, host, porta FROM \"HikvisionTerminal\" WHERE ativo = true;" 2>/dev/null \
      | while read -r line; do echo "  $line"; done || warn "Não foi possível conectar ao banco"
  fi
  exit 0
fi

echo ""
echo "Testando conectividade com $HOST:$PORT"
echo ""

# 1. Ping
echo -n "  Ping... "
if ping -c 2 -W 2 "$HOST" &>/dev/null; then
  ok "OK"
else
  err "FALHOU (host não alcançável)"
fi

# 2. Porta TCP
echo -n "  Porta TCP $PORT... "
if timeout 3 bash -c "echo >/dev/tcp/$HOST/$PORT" 2>/dev/null; then
  ok "OK"
else
  err "FALHOU (porta fechada ou timeout)"
fi

# 3. ISAPI deviceInfo (sem auth — vai retornar 401 mas confirma que o servidor responde)
echo -n "  ISAPI /ISAPI/System/deviceInfo... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$HOST:$PORT/ISAPI/System/deviceInfo" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "401" ]]; then
  ok "Servidor respondeu (401 Unauthorized — normal, requer Digest auth)"
elif [[ "$HTTP_CODE" == "200" ]]; then
  ok "Servidor respondeu (200)"
else
  err "Sem resposta HTTP (código: $HTTP_CODE)"
fi

echo ""
if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}Terminal alcançável e respondendo corretamente.${NC}"
else
  echo -e "${RED}Terminal não alcançável. Verifique:${NC}"
  echo "  1. Tailscale está ativo no LXC: tailscale status"
  echo "  2. Subnet route está anunciada: tailscale up --advertise-routes=<CIDR>"
  echo "  3. O IP do terminal está correto"
  echo "  4. O terminal está ligado e na rede"
fi
