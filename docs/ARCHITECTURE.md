# Arquitetura — Condomínio App

> **Documento vivo.** Atualizado em todo commit que altere a estrutura do
> projeto. Veja [`../CONTRIBUTING.md`](../CONTRIBUTING.md) para as regras.

**Última atualização:** 2026-05-26 (bootstrap inicial)

---

## Visão geral

Monorepo `npm workspaces` com três workspaces:

```
apps/api/         → Backend NestJS (porta 3001 interna)
apps/web/         → Frontend Next.js 14 (porta 3000)
packages/shared/  → Tipos, enums e constantes compartilhadas
```

Mais:

```
prisma/           → Schema único + migrations (consumido pelo apps/api)
scripts/          → Scripts de deploy/manutenção (install, update, backup)
docs/             → Documentação viva
```

## Componentes externos

| Componente | Papel | Onde roda |
|---|---|---|
| PostgreSQL | Banco principal | Container `db` no Compose |
| Redis | Backend BullMQ (filas) | Container `redis` no Compose |
| Baileys | Cliente WhatsApp | Dentro do `apps/api` (volume `wa_auth`) |
| Hikvision ISAPI | Terminais facial DS-K1T342MWX | Acessados via Tailscale subnet router |

## Fluxos críticos (a documentar conforme forem implementados)

- **Encomenda** — registro → WhatsApp via fila → confirmação morador
- **Reserva** — validação de slot/quota → persistência → PDF (admin)
- **Sync facial Hikvision** — admin dispara → BullMQ enfileira por terminal →
  worker chama ISAPI com Digest auth → atualiza `FacialSync`

## Módulos backend (`apps/api/src/`)

> _A preencher conforme módulos forem criados (etapas 2+ do plano)._

## Rotas frontend (`apps/web/src/app/`)

> _A preencher conforme telas forem criadas (etapas 5+ do plano)._

## Decisões estruturais

- **Monorepo `npm workspaces`** — simples, sem Turborepo/Nx por enquanto.
  Reconsiderar se build ficar lento.
- **Prisma na raiz** (não dentro de `apps/api`) — schema é referência única
  para o projeto; futuramente pode ser consumido por scripts/migrações fora
  da API.
- **`packages/shared`** existe para evitar duplicar enums entre back e front
  (problema recorrente na v1).
- **Documento vivo + CHANGELOG** — substitui o esquema antigo de pasta
  `Context/` que ficava desatualizada.
