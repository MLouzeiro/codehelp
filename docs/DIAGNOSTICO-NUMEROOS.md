# Diagnostico: Fix numeroOs Unique Constraint Error

> Data: Setembro 2026 | Status: **Implementado e verificado**

---

## Problema

Ao criar OS (Ordens de Servico) a partir de tickets ou via formulario, o sistema retornava erro:

```
Unique constraint failed on the fields: (`numeroOs`)
```

O erro so ocorria em producao quando **duas requisicoes simultaneas** tentavam criar OS no mesmo instante. Em ambiente de desenvolvimento (requisicoes sequenciais) o bug nao se manifestava.

---

## Causa Raiz

O padrao anterior de geracao de numeroOs era **race-prone**:

```typescript
// ANTES (perigoso)
const count = await prisma.serviceOrder.count({ where: { ... } });
const year = new Date().getFullYear();
const numeroOs = `${year}-${String(count + 1).padStart(4, '0')}`;
// ... create order with numeroOs
```

**Sequencia que causa o bug:**
```
Requisicao A: COUNT(*) = 50  -> gera OS-2026-0051
Requisicao B: COUNT(*) = 50  -> gera OS-2026-0051  (leu antes do A gravar)
Requisicao A: INSERT OS-2026-0051 -> OK
Requisicao B: INSERT OS-2026-0051 -> ERRO: Unique constraint
```

---

## Solucao Implementada

### 1. Novo model Prisma: `OrderSequence`

**Arquivo:** `backend/prisma/schema.prisma:291-295`

```prisma
/// Contador sequencial por ano para geracao atomica de numeroOs.
model OrderSequence {
  year    Int @unique
  lastNum Int @default(0)
}
```

- Um registro por ano (ex: `{year: 2026, lastNum: 0}`)
- `@@unique([year])` garante que so existe um contador por ano
- Aplicado via `npx prisma db push` (nao requer migration formal)

### 2. Funcao atomica: `getAtomicOsNumber()`

**Arquivo:** `backend/src/shared/utils/helpers.ts:5-17`

```typescript
export async function getAtomicOsNumber(prisma: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`INSERT INTO "OrderSequence" ("year", "lastNum") VALUES (${year}, 0) ON CONFLICT ("year") DO NOTHING`;
    const rows = await tx.$queryRaw`UPDATE "OrderSequence" SET "lastNum" = "lastNum" + 1 WHERE "year" = ${year} RETURNING "lastNum"`;
    return rows[0] as { lastNum: number };
  });
  return generateOsNumber(year, seq.lastNum);
}
```

**Como funciona:**
1. `INSERT ... ON CONFLICT DO NOTHING`: cria o registro do ano se nao existe (idempotente)
2. `UPDATE ... RETURNING`: incrementa atomica e retorna o novo valor
3. Tudo dentro de `$transaction`: se qualquer passo falhar, tudo desfaz
4. Duas transacoes concorrentes vao esperar o lock de linha e executar sequencialmente

### 3. Retry com backoff

**Arquivo:** `backend/src/modules/orders/orders.service.ts:90-99`

```typescript
let numeroOs = '';
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    numeroOs = await getAtomicOsNumber(prisma);
    break;
  } catch (e: any) {
    if (attempt === 4) throw e;
    await new Promise(r => setTimeout(r, 50));
  }
}
```

Mesmo com atomicidade, retry de 5x com 50ms de delay serve como defesa extra contra conflitos isolados.

---

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `backend/prisma/schema.prisma` | Adicionado model `OrderSequence` (3 linhas) |
| `backend/src/shared/utils/helpers.ts` | Adicionada `getAtomicOsNumber()` (13 linhas) |
| `backend/src/modules/orders/orders.service.ts` | Substituido loop de COUNT por `getAtomicOsNumber()` |
| `backend/src/modules/orders/orders.controller.ts` | Substituido loop de COUNT por `getAtomicOsNumber()` |

---

## Verificacao

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` (backend) | 0 erros novos |
| `npm test` (orders.test.ts) | 11/11 passando |
| `npx tsc --noEmit` (frontend) | 0 erros |
| `npm test` (frontend) | 5/5 passando |
| Tabela OrderSequence criada no DB | OK (via `db push`) |
| Formato numeroOs | `OS-2026-0001` (preservado) |

---

## Plano de Rollback

Se precisar reverter:

1. **Remover model do schema** (opcional - nao quebra nada se a tabela existir):
   ```bash
   # Remover as 4 linhas do model OrderSequence no schema.prisma
   ```

2. **Reverter helpers.ts**:
   ```bash
   git checkout HEAD -- backend/src/shared/utils/helpers.ts
   ```

3. **Reverter orders.service.ts e orders.controller.ts**:
   ```bash
   git checkout HEAD -- backend/src/modules/orders/orders.service.ts
   git checkout HEAD -- backend/src/modules/orders/orders.controller.ts
   ```

4. **A tabela OrderSequence pode permanecer** - nao causa conflito com o codigo antigo.

---

## Plano de Teste Pos-Deploy

### Teste manual (producao)

1. Criar OS via formulario (Usuarios > OS > Nova OS)
2. Criar OS a partir de ticket (Ticket > Criar OS)
3. Criar 2 OS rapidamente uma atras da outra
4. Verificar que numeroOs e incrementado corretamente (OS-2026-0001, OS-2026-0002, ...)
5. Verificar que nao ha erro de Unique Constraint

### Monitoramento

- Verificar logs por erros `P2002` (Prisma Unique Constraint)
- Monitorar tabela `OrderSequence` para ver se `lastNum` incrementa corretamente
- Verificar que o formato `OS-YYYY-NNNN` esta correto

---

## Impacto

- **Risco**: Baixo (mudanca isolada, sem efeito em outros modulos)
- **Performance**: Negligivel (1 transacao simples por OS criada)
- **Compatibilidade**: Total (formato do numeroOs preservado)
- **Dados existentes**: Nenhum dado e afetado (tabela OrderSequence e nova)
