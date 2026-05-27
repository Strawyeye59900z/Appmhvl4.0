# Spec — Etapa 9B: Visitantes, Floor/Room ID e Melhorias Hikvision

**Data:** 2026-05-27
**Status:** Aprovado
**Escopo:** Cadastro de personais/funcionários temporários pelos moradores via link WhatsApp, floor/room ID derivado do número do apartamento enviado ao Hikvision, sufixo de tipo no nome do usuário no terminal, filtros na aba sync do admin, agrupamento por andar na tela de moradores.

---

## 1. Contexto

Extensão da Etapa 9 (fotos + Hikvision). O sistema já possui `Morador`, `Funcionario`, `FacialSync`, `HikvisionTerminal` e o processor de sync. Esta etapa adiciona:

1. Novo model `Visitante` (personal / funcionário temporário) cadastrado pelo morador via link WhatsApp
2. Floor No. e Room No. derivados do `apartamento.numero` e enviados ao terminal no `UserInfo`
3. Sufixo de tipo no nome enviado ao terminal
4. Filtros (Todos / Moradores / Funcionários / Visitantes) + ordenação por prioridade na aba Sync do admin
5. Agrupamento por andar na tela `/admin/moradores`

---

## 2. Mudanças no Schema Prisma

### 2.1 Novo enum e model `Visitante`

```prisma
enum TipoVisitante {
  PERSONAL
  FUNCIONARIO_TEMP
}

model Visitante {
  id            String        @id @default(cuid())
  codigoFacial  Int           @unique @default(autoincrement())
  nome          String
  tipo          TipoVisitante
  fotoUrl       String?
  token         String        @unique @default(uuid())
  tokenUsado    Boolean       @default(false)
  validoAte     DateTime
  ativo         Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  moradorId     String
  morador       Morador       @relation(fields: [moradorId], references: [id])

  facialSyncs   FacialSync[]
}
```

### 2.2 Relações adicionadas em modelos existentes

- `Morador`: adicionar `visitantes Visitante[]`
- `FacialSync`: adicionar `visitanteId String?` e `visitante Visitante? @relation(...)` + `@@unique([visitanteId, terminalId])`

### 2.3 Migration

Nome sugerido: `add_visitante_floor_room`

---

## 3. Utilitário `parseApartamento`

Função pura compartilhada entre backend e frontend (copiada, não importada via pacote):

```ts
function parseApartamento(numero: string): { floorNo: number; roomNo: number } {
  const n = numero.replace(/\D/g, '');
  if (n.length <= 3) {
    return { floorNo: parseInt(n.slice(0, 1)), roomNo: parseInt(n.slice(1)) };
  }
  return { floorNo: parseInt(n.slice(0, -2)), roomNo: parseInt(n.slice(-2)) };
}
// "901"  → { floorNo: 9,  roomNo: 1  }
// "1403" → { floorNo: 14, roomNo: 3  }
// Funcionário / Visitante → { floorNo: 0, roomNo: 0 }
```

No backend: `apps/api/src/hikvision/isapi/parse-apartamento.ts`
No frontend: `apps/web/src/lib/parse-apartamento.ts`

---

## 4. Mudanças no `UserInfo` Hikvision

### 4.1 Interface atualizada

```ts
export interface UserInfoRecord {
  employeeNo: string;
  name: string;
  userType: 'normal' | 'admin' | 'visitor';
  floorNumber?: number;  // andar derivado do número do apartamento (0 para funcionário/visitante)
  roomNumber?: number;   // número do quarto/apto (0 para funcionário/visitante)
  Valid: {
    enable: boolean;
    beginTime: string;
    endTime: string;
  };
}
```

### 4.2 `buildUserInfoPayload` atualizado

Recebe `floorNo`, `roomNo`, `endTime` e `sufixo`:

```ts
export function buildUserInfoPayload(params: {
  codigoFacial: number;
  nome: string;
  sufixo?: string;        // " (Porteiro)", " (Personal)", " (Func. Temp)"
  floorNo: number;
  roomNo: number;
  endTime?: string;       // ISO string — para visitantes com prazo
}): UserInfoRequest
```

- `name`: `${nome}${sufixo ?? ''}`.slice(0, 32)
- `floorNumber`: `floorNo` (número inteiro)
- `roomNumber`: `roomNo` (número inteiro)
- `endTime`: se fornecido usa o prazo do visitante, caso contrário `'2037-12-31T23:59:59'`
- `userType`: visitante → `'visitor'`, demais → `'normal'`

### 4.3 Sufixos por tipo

| Tipo | Sufixo |
|------|--------|
| Morador | (nenhum) |
| Funcionário fixo | ` (Porteiro)` |
| Personal | ` (Personal)` |
| Funcionário temporário | ` (Func. Temp)` |

---

## 5. Módulo `visitantes` (Backend)

### 5.1 Endpoints públicos (sem auth)

```
GET  /visitantes/registrar-foto/:token
  → Valida token: existe, não expirado, ativo
  → Retorna: { nome, tipo, moradorNome, validoAte }
  → Erro 404 se inválido/expirado/já usado

POST /visitantes/registrar-foto/:token
  Body: multipart/form-data { file: image/* }
  → Valida token (mesmas regras)
  → Comprime foto via FotosService
  → Salva fotoUrl, tokenUsado = true
  → Enfileira sync para todos os terminais ativos
  → Retorna: { fotoUrl }
```

### 5.2 Endpoints do morador (JWT MORADOR)

```
GET  /visitantes/meus
  → Lista visitantes do morador autenticado (ativo=true), com statusGeral de sync

POST /visitantes
  Body: { nome: string, tipo: TipoVisitante, meses: number (1–12) }
  → Cria Visitante com validoAte = now + meses meses
  → Retorna: { id, token, link: "https://<APP_URL>/visitante/<token>" }

DELETE /visitantes/:id
  → Verifica que visitante pertence ao morador autenticado
  → ativo = false (soft delete)
  → Não remove FacialSync existentes — admin pode ver histórico
```

### 5.3 Endpoints admin

```
GET  /admin/visitantes
  → Lista todos os visitantes com morador, statusGeral, syncs por terminal

DELETE /admin/visitantes/:id
  → ativo = false
```

### 5.4 Validações

- `meses` entre 1 e 12, validado com class-validator
- Token com mais de 12 meses é rejeitado na criação (não no uso — se criado antes da regra, aceitar)
- `validoAte` verificado no momento do POST da foto (não apenas na criação do link)

---

## 6. Mudanças no `HikvisionProcessor`

O processor precisa suportar `role: 'VISITANTE'` além de `'MORADOR'` e `'FUNCIONARIO'`:

```ts
} else if (role === Role.VISITANTE) {
  const v = await prisma.visitante.findUniqueOrThrow({ where: { id: pessoaId } });
  nome = v.nome;
  codigoFacial = v.codigoFacial;
  sufixo = v.tipo === 'PERSONAL' ? ' (Personal)' : ' (Func. Temp)';
  floorNo = 0;
  roomNo = 0;
  endTime = v.validoAte.toISOString().replace('.000Z', '');
  userType = 'visitor';
}
```

Para moradores, busca `apartamento.numero` e chama `parseApartamento`.

---

## 7. Frontend — Página pública `/visitante/[token]`

Rota: `apps/web/src/app/visitante/[token]/page.tsx`

**Estados:**
- `validando` — spinner enquanto GET /visitantes/registrar-foto/:token
- `invalido` — token expirado/usado/não encontrado → mensagem de erro
- `pronto` — exibe saudação + `FotoCaptura`
- `concluido` — confirmação de sucesso após POST

**Sem layout de autenticação** — fora do AppShell, sem verificação de JWT.

Texto da saudação:
> "Olá, **[Nome]**! Você foi convidado como **[Personal / Funcionário Temporário]** por **[Morador]**. Seu acesso é válido até **[data formatada]**."

---

## 8. Frontend — Tela do morador `/me`

Nova seção abaixo do avatar/dados pessoais:

**"Meus Visitantes"**
- Botão "Adicionar" → Dialog com campos:
  - Nome (text)
  - Tipo (select: Personal / Funcionário Temporário)
  - Acesso por quantos meses? (input number, min=1, max=12)
- Após criação: exibe o link com botão "Enviar via WhatsApp" → `https://wa.me/?text=...` com texto pré-formatado incluindo o link
- Lista de cards: nome, badge de tipo, "Válido até: DD/MM/AAAA", badge de status facial, botão "Revogar"

---

## 9. Frontend — Painel admin `/admin/hikvision` aba Sync

**Filtros:**
Botões toggle acima da tabela: `Todos | Moradores | Funcionários | Visitantes`

**Ordenação (aplicada após filtro):**
1. Status pendentes primeiro: PENDENTE, EM_FILA, ENVIANDO
2. FALHOU
3. OK
4. Dentro de cada grupo: alfabético por nome

**Colunas adicionais para visitantes:**
- "Válido até" (data)
- "Cadastrado por" (nome do morador)

---

## 10. Frontend — Painel admin `/admin/moradores`

**Agrupamento por andar:**
- Usar `parseApartamento(apartamento.numero).floorNo` para agrupar
- Cabeçalho de seção colapsável: `"Andar 9 (3 moradores)"`, `"Andar 14 (2 moradores)"`
- Dentro de cada andar: ordenado por `apartamento.numero` crescente
- Moradores cujo número não é parseável → grupo `"Sem andar"`

---

## 11. Mapa de arquivos

### Backend — novos
```
apps/api/src/visitantes/visitantes.module.ts
apps/api/src/visitantes/visitantes.controller.ts
apps/api/src/visitantes/visitantes.service.ts
apps/api/src/visitantes/dto/create-visitante.dto.ts
apps/api/src/hikvision/isapi/parse-apartamento.ts
```

### Backend — modificados
```
prisma/schema.prisma                          → Visitante + FacialSync.visitanteId
apps/api/src/common/roles.enum.ts             → adicionar Role.VISITANTE
apps/api/src/hikvision/isapi/user-info.ts     → floorNo, roomNo, sufixo, endTime, userType
apps/api/src/hikvision/hikvision.processor.ts → suporte a Role.VISITANTE + floorNo/roomNo
apps/api/src/hikvision/hikvision.service.ts   → enfileirarSync aceita Role.VISITANTE
apps/api/src/app.module.ts                    → importar VisitantesModule
```

### Frontend — novos
```
apps/web/src/app/visitante/[token]/page.tsx
apps/web/src/lib/parse-apartamento.ts
```

### Frontend — modificados
```
apps/web/src/app/me/page.tsx                  → seção "Meus Visitantes"
apps/web/src/app/admin/hikvision/page.tsx     → filtros + ordenação na aba Sync
apps/web/src/app/admin/moradores/page.tsx     → agrupamento por andar
apps/web/src/lib/api.ts                       → endpoints visitantes
```

---

## 12. Ordem de implementação

1. Migration Prisma (`Visitante` + `FacialSync.visitanteId`)
2. `parseApartamento` (backend + frontend)
3. Atualizar `buildUserInfoPayload` — floorNo, roomNo, sufixo, endTime, userType
4. Atualizar `HikvisionProcessor` — suporte a `Role.VISITANTE`
5. Módulo `visitantes` (backend) — service + controller + DTOs
6. Página pública `/visitante/[token]` (frontend)
7. Seção "Meus Visitantes" em `/me` (frontend)
8. Filtros + ordenação na aba Sync do admin
9. Agrupamento por andar em `/admin/moradores`

---

## 13. Fora de escopo

- Notificação ao morador quando visitante registra a foto (etapa futura)
- Renovação de prazo de visitante pelo morador (etapa futura)
- Remoção da face no terminal ao revogar visitante (etapa futura)
- Limite de visitantes por morador (não planejado)
