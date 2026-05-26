# Changelog estrutural

> Mudanças arquiteturais do projeto. Mais recente primeiro.
> **Não é** changelog de versão semântica — é diário de evolução estrutural.
> Formato definido em [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## 2026-05-26 — Bootstrap do monorepo

**Tipo:** add

Reconstrução do projeto a partir do zero, após problemas estruturais na v1.
Criado monorepo `npm workspaces` com três workspaces (`apps/api`, `apps/web`,
`packages/shared`), pasta `prisma/` na raiz, `scripts/` para deploy e `docs/`
para documentação viva (este arquivo + `ARCHITECTURE.md`).

Stack confirmada: NestJS + Next.js 14 + PostgreSQL/Prisma + Redis/BullMQ +
Baileys + Tailwind/shadcn. Detalhes completos em [`Plano.md`](Plano.md).
