# Deploy — Condomínio App 2.0

## Pré-requisitos

- LXC Debian 12 ou Ubuntu 22.04 (mínimo 1 vCPU, 1 GB RAM, 10 GB disco)
- Acesso root ao LXC
- Domínio no Cloudflare com Zero Trust habilitado

## Instalação inicial (LXC fresco)

```bash
# No LXC, como root — baixa e executa o script de instalação:
curl -fsSL https://raw.githubusercontent.com/Strawyeye59900z/Appmhvl4.0/main/scripts/install.sh | bash

# Ou se já clonou o repo manualmente:
sudo bash scripts/install.sh
```

O script perguntará interativamente:

1. **Domínio Cloudflare** — ex: `condominio.meudominio.com.br`
2. **E-mail do admin**
3. **Senha do admin** (sugerida automaticamente, pode aceitar ou digitar outra)
4. **Cloudflare Tunnel Token** — veja seção abaixo
5. **Tailscale Auth Key** (opcional, só para Hikvision)

Segredos gerados automaticamente: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `APP_SECRET`, `POSTGRES_PASSWORD`.

## Configurar Cloudflare Tunnel

Antes de rodar o `install.sh`, crie o túnel no painel:

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Zero Trust** → **Networks** → **Tunnels**
2. Clique **Create a tunnel** → nome: `condominio` → Next
3. Escolha **Cloudflared** → copie o token exibido
4. Em **Public Hostnames**, configure:
   - **Subdomain:** `condominio` (ou o que preferir)
   - **Domain:** seu domínio
   - **Service:** `http://localhost:3000`
5. Salve o túnel

O `install.sh` pedirá o token (passo 4 acima) e instalará o `cloudflared` como serviço systemd apontando para `:3000`. O Next.js proxeia automaticamente `/api/v1/*` para `localhost:3001` — a porta da API não fica exposta publicamente.

## Atualizar o app

```bash
sudo bash /opt/condominio/scripts/update.sh
```

Faz: `git pull` → `npm install` → `prisma migrate deploy` → `npm run build` → restart services.

## Backup manual

```bash
sudo bash /opt/condominio/scripts/backup.sh
# Backups salvos em /opt/condominio/backups/<YYYYMMDD_HHMMSS>/
```

Inclui: dump do PostgreSQL, tarball de uploads e sessão WhatsApp (baileys-auth). Backups com mais de 30 dias são removidos automaticamente.

## Verificar status dos services

```bash
systemctl status condominio-api
systemctl status condominio-web
systemctl status cloudflared

# Logs em tempo real:
journalctl -u condominio-api -f
journalctl -u condominio-web -f
journalctl -u cloudflared -f
```

## Hikvision + Tailscale

Para que a API alcance os terminais Hikvision via Tailscale subnet router:

```bash
# 1. Instalar Tailscale no LXC
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Autenticar com a auth key gerada no install.sh
tailscale up --authkey='<TAILSCALE_AUTHKEY>'

# 3. Testar conectividade com um terminal
bash /opt/condominio/scripts/tailscale-check.sh 192.168.1.50 80
```

O `tailscale-check.sh` testa ping, porta TCP e resposta ISAPI. Uma resposta `401 Unauthorized` é normal e confirma que o terminal está alcançável (requer Digest auth, que a API faz automaticamente).

## Variáveis de ambiente

Todas em `/opt/condominio/.env`. Para alterar qualquer valor:

```bash
nano /opt/condominio/.env
systemctl restart condominio-api condominio-web
```

## Restaurar backup

```bash
# DB
gunzip -c /opt/condominio/backups/<timestamp>/db.sql.gz | sudo -u postgres psql condominio

# Uploads
tar -xzf /opt/condominio/backups/<timestamp>/uploads.tar.gz -C /opt/condominio/apps/api/

# Sessão WhatsApp
tar -xzf /opt/condominio/backups/<timestamp>/baileys-auth.tar.gz -C /opt/condominio/apps/api/
systemctl restart condominio-api
```
