# Como contribuir

Este projeto foi reconstruído do zero para resolver problemas de organização
estrutural que apareceram na versão anterior. Para que isso não se repita,
existem **duas regras obrigatórias** que precisam ser seguidas em todo commit
que altere a estrutura do projeto.

## Regra 1 — ARCHITECTURE.md sempre atualizado

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) descreve a estrutura atual:
módulos backend, módulos frontend, fluxos críticos, decisões estruturais.

**Sempre que você:**

- Adicionar, mover ou remover um módulo (`apps/api/src/<modulo>/`)
- Adicionar, mover ou remover uma rota frontend (`apps/web/src/app/<rota>/`)
- Alterar o schema Prisma de forma significativa
- Adicionar/trocar uma dependência arquitetural (lib de fila, ORM, auth, etc.)

→ Atualize `docs/ARCHITECTURE.md` no **mesmo commit**.

## Regra 2 — CHANGELOG.md registra cada mudança

[`docs/CHANGELOG.md`](docs/CHANGELOG.md) é o log cronológico de mudanças
estruturais. **Não é um changelog de versões semânticas** — é um diário
de evolução arquitetural.

Formato de cada entrada:

```markdown
## YYYY-MM-DD — Título curto da mudança

**Tipo:** add | change | remove

Descrição em 1–3 frases: o que mudou e por que.
```

Adicione uma entrada no topo do arquivo (mais recente primeiro).

## Commits

- Mensagens em português, imperativo: "adiciona módulo X", "remove Y"
- Um commit = uma mudança lógica
- Commits que tocam estrutura **devem** incluir o update de ARCHITECTURE e CHANGELOG

## Deploy

Fluxo padrão:

1. Desenvolver + commitar localmente
2. `git push` para `main`
3. No LXC: `cd /opt/condominio && ./scripts/update.sh`
4. Validar via healthcheck e smoke test manual

Para a primeira instalação use `./scripts/install.sh` (interativo).
