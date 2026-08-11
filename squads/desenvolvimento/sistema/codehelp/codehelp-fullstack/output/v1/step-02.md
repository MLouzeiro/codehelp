# Step 02 — Implementação Backend (Fernando Costa)

## Novos Endpoints de BI (analytics.controller.ts)

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/analytics/tickets-by-department` | Chamados por departamento (BarChart) |
| `GET /api/analytics/avg-time-by-queue` | Tempo médio de resolução por fila (BarChart) |
| `GET /api/analytics/csat-trending` | CSAT trending diário (AreaChart) |
| `GET /api/analytics/status-by-day` | Status por dia (StackedBarChart) |

## Performance Fixes

### N+1 Query Corrigido (metrics.service.ts)
- **Antes:** Loop com `findUnique` por agente + `findMany` CSAT por agente = 2N queries
- **Depois:** Batch `findMany` users + batch `findMany` CSAT = 2 queries fixas

### Índices Adicionados (schema.prisma)

**Ticket:** status, etapa, createdAt, dataAbertura, dataFechamento, assigneeId, categoria, prioridade, usuarioId, departamentoId, idFila

**Message:** ticketId, fromMe

**CSATResposta:** respondidoEm, nota

**TicketStageEvent:** ticketId, createdAt

**ServiceOrder:** status, createdAt

**Opportunity:** etapa

## Arquivos Alterados
- `backend/src/modules/analytics/analytics.controller.ts` — 4 novos endpoints
- `backend/src/modules/analytics/analytics.routes.ts` — 4 novas rotas
- `backend/src/modules/helpdesk/metrics.service.ts` — N+1 fix
- `backend/prisma/schema.prisma` — 17 novos índices

## Typecheck: ✅ LIMPO
