# Condomínio App

Sistema de gestão condominial: encomendas, reservas de espaços, reconhecimento
facial via terminais Hikvision (DS-K1T342MWX) e notificações WhatsApp.

> **Status:** reconstrução em andamento. Veja [`docs/Plano.md`](docs/Plano.md)
> para o plano completo e [`docs/CHANGELOG.md`](docs/CHANGELOG.md) para o
> histórico de mudanças estruturais.

## Stack

- **Backend:** NestJS 10 + Prisma 5 + PostgreSQL + BullMQ/Redis
- **Frontend:** Next.js 14 (App Router) + Tailwind + shadcn/ui
- **WhatsApp:** Baileys (volume persistente)
- **Facial:** Hikvision ISAPI (HTTP Digest) via Tailscale subnet router
- **Deploy:** Docker Compose em LXC (Proxmox / Debian)

## Estrutura

```
apps/
  api/        Backend NestJS
  web/        Frontend Next.js
packages/
  shared/     Tipos, enums e constantes compartilhadas
prisma/       Schema e migrations
scripts/      install.sh, update.sh, backup.sh, tailscale-check.sh
docs/         ARCHITECTURE.md, CHANGELOG.md, HIKVISION.md, DEPLOY.md, DESIGN.md
```

## Desenvolvimento

A reconstrução é validada por deploy iterativo no LXC — não há ambiente de
dev local. Veja [`docs/DEPLOY.md`](docs/DEPLOY.md) para o fluxo:

```bash
# No LXC, primeira vez:
./scripts/install.sh

# Atualizações:
./scripts/update.sh
```

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| [`docs/Plano.md`](docs/Plano.md) | Plano de reconstrução completo |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Estrutura viva do projeto |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Log de mudanças estruturais |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Regras para manter docs vivas |
