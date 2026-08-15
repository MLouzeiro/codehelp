# ARCHITECTURE — CodeHelp CRM/Helpdesk

> Documento de visão arquitetural do sistema. Gerado na FASE 0 (2026-08-13).
> Fonte de verdade de estrutura/padrões; detalhes operacionais em `AGENTS.md`.

## 1. Visão geral

Sistema monolítico de **3 camadas** (backend API + frontend web + app mobile) com um único banco
SQLite (dev) / PostgreSQL (prod) via Prisma. Módulos organizados por **domínio de negócio**.

```
┌──────────────┐   REST/JSON (JWT)   ┌──────────────┐
│ Frontend Web │ ──────────────────▶ │   Backend    │
│ React + Vite │ ◀────────────────── │ Express+TS  │──▶ Prisma ──▶ SQLite/PostgreSQL
│ Tailwind     │   porta 5173        │   porta 3001 │
└──────────────┘                     └──────┬───────┘
┌──────────────┐                           │ WebSocket (Baileys)
│ Mobile Expo  │───────────────────────────┼──────────▶ WhatsApp (Baileys v6.7.23)
│ RN + Zustand │                           └── Providers alternativos: Evolution API, Cloud API
└──────────────┘
```

## 2. Stack técnica

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js + Express + TypeScript (`src/server.ts`) |
| ORM | Prisma (`backend/prisma/schema.prisma` — 77 models) |
| Auth | JWT access 15min + refresh 7d + `sessionToken` (anti multi-device) + RBAC por role |
| Frontend | React 18 + Vite + Tailwind + React Query + Lucide |
| Mobile | Expo SDK 51 + Expo Router + Zustand + NativeWind |
| WhatsApp | Baileys (primário) / Evolution API / Cloud API — via factory |

## 3. Estrutura de módulos backend

```
backend/src/
├── config/            # database.ts (Prisma singleton), env.ts
├── shared/middleware/ # auth.ts (authenticate, authorize, ticketAccess)
├── modules/
│   ├── auth/          # login/register/refresh, rbac.ts
│   ├── helpdesk/      # tickets, filas, departamentos, stages, flow, csat, sla, metrics, triagem, menu, horario, status, fila, fcr, responseTimer, checklist, ai-audit, auditTicket
│   ├── ai/            # aiTriage, aiValidation, aiTicket, aiAgentMonitor, robot.scheduler
│   ├── analytics/     # analytics.controller, weeklyReport
│   ├── aprovacoes/    # solicitar/decidir/listar
│   ├── audit/         # AuditLog + auditStats
│   ├── crm/           # clients, contatos, oportunidades
│   ├── orders/        # OS + pdf.service
│   ├── timetracking/  # TimeEntry CRUD + summary + syncOrderHours
│   ├── kanban/        # tarefas internas + ai-categorize
│   ├── integrations/  # whatsapp/, email/, facebook/, instagram/, telegram/, channels/
│   ├── csat/          # avaliação de satisfação
│   ├── notificacoes/  # notificações internas
│   ├── permissions/   # RBAC avançado
│   ├── automations/   # regras de automação
│   ├── billing/       # cobranças
│   ├── alerts/        # alertas
│   ├── kb/            # knowledge base
│   ├── feriados/      # feriados nacionais
│   └── users/         # gestão de usuários
└── server.ts          # entry point, mounts routers
```

## 4. Modelo de dados (destaques — 77 models)

- **Core helpdesk**: `Ticket` (etapas 6 fixas, status, prioridade, SLA, datas, campos IA), `Message`, `Fila`, `Departamento`, `NivelSuporte`, `CSATResposta`.
- **Trilha de auditoria**: `TicketStageEvent`, `TicketHistory`, `TicketEvent`, `TicketTimeline`, `TicketActivity`, `TicketSlaLog`, `TicketMetrics`, `TicketWaitTime`, `TicketAiLog`, `TicketPerformance`, `TicketAgentInteraction`, `AuditLog`.
- **IA**: `AIClassification`, `AIEvaluation`, `AICorrection`, `AIMetricas`, `AIAgentAudit`, `AIRespostaValidacao`.
- **Kanban interno**: `KanbanBoard/Column/Task/Subtask/Tag/Activity/Attachment/Template`.
- **OS**: `ServiceOrder`, `Signature` (token + base64), `Attachment`, `TimeEntry`.
- **Integrações**: `WhatsAppSession`, `WhatsAppConnection`, `Channel`, `ChannelMessage`, `ChannelRiskLog`.
- **Outros**: `Client`, `Opportunity`, `Colaborador`, `Contact`, `Enquete`, `AutomationRule`, `RolePermission`, `Feriado`, `HelpdeskConfig`, `SLAConfig`, `Categoria`, `Ativo`, `KBArticle`, `Billing*`, `Notificacao`, `Aprovacao`.

## 5. Padrões de código (regras fortes)

- Controllers = `async handler + try/catch`; services = negócio + `AppError`; queries via Prisma.
- **Fonte única de constantes** do pipeline em `helpdesk/constants.ts` (`STATUS_ENCERRADO`, `ETAPAS_ENCERRADAS`, `EVALUATION_*`, `ETAPAS_FIXAS`).
- **Encerramento canônico**: `flow.service.ts` — `encerrarTicket` → `iniciarConfirmacaoResolucao` ("Seu problema foi resolvido?" SIM/NÃO) → `finalizarAtendimento` (CSAT) / `finalizarSemResolucao` (motivoStatus + alerta). Todos os caminhos (manual, IA, CSAT) delegam a ele.
- **WhatsApp**: handler compartilhado canônico (`whatsapp-message-handler.ts`); provider factory (`whatsapp-provider-factory.ts`); Baileys provider (`baileys-provider.service.ts`). Filtros obrigatórios `fromMe`, `status_update`, `@g.us`, `status@broadcast` em TODOS os providers.
- **Frontend**: componentes funcionais + hooks + `useCallback`; `usePolling` para refresh; kebab-case de arquivos, PascalCase de componentes/tipos.
- **Mobile**: Expo Router (file-based), Zustand stores, AsyncStorage offline.

## 6. Frontend (rotas — `frontend/src/App.tsx`)

- Públicas: `/` (landing), `/login`, `/assinar/:token`.
- `/app/*` (privadas, `PrivateRoute` + `Layout` com sidebar filtrada por role):
  - Dashboard: `dashboard`
  - Helpdesk: `helpdesk` (kanban), `helpdesk/painel` (ao vivo), `helpdesk/painel-ia`, `helpdesk/metrics`, `helpdesk/business-metrics`, `helpdesk/board`, `helpdesk/ticket/:id`, `helpdesk/relatorio/:id`, `helpdesk/timeline/:id`, `helpdesk/audit`, `helpdesk/auditoria-ia`, `helpdesk/aprovacoes`
  - CRM: `crm`, `crm/pipeline`, `crm/tabela`, `crm/servicos`, `crm/temas`, `crm/:id`, `crm/new`, `crm/:id/edit`
  - Operacional: `orders/*`, `whatsapp`, `whatsapp/tickets/:id`, `kanban`, `kb`, `automations`, `timetracking`, `robos`
  - Settings: `settings` e sub-rotas (`users`, `alerts`, `helpdesk-*`, `permissions`, `feriados`, `channels`, `auto-messages`, `enquetes`, `ai-auto-atendimento`, `alert-settings`)
- Menu (sidebar `Layout.tsx`) é derivado de `navItems` com `roles` por item.

## 7. Mobile (rotas — `mobile/app`)

- `(auth)/login`, `(tabs)/` (index, helpdesk, crm, orders, approvals, notifications), `(modals)/` (pipeline, settings, client/[id], order/[id], ticket/[id]).

## 8. Serviços de IA / auditoria existentes (base para fases 7-8)

| Serviço | Arquivo | Exporta |
|---------|---------|---------|
| Monitor de agente IA | `modules/ai/aiAgentMonitor.service.ts` | `avaliarMensagemAgente`, `gerarSugestaoResposta`, `getMetricasAgente`, `getRelatorioAuditoria`, `getRankingAgentes` |
| Auditoria de resposta IA | `modules/helpdesk/ai-audit.service.ts` | `auditAgentResponse`, `getAgentPerformance` |
| Auditoria de tickets (eventos) | `modules/helpdesk/auditTicket.service.ts` | `logTicketEvent`, `getTicketEvents`, `getTicketTimeline`, `calculateAndStoreMetrics`, `getTicketReplayData`, `exportTicketData` |
| Métricas dashboard | `modules/helpdesk/metrics.service.ts` | `getDashboardMetrics` |
| Relatório semanal | `modules/analytics/weeklyReport.service.ts` | `gerarRelatorioSemanal`, `enviarRelatorioSemanalWhatsApp`, `formatarMensagemWhatsApp` |
| FCR | `modules/helpdesk/fcr.service.ts` | — |
| Tempo por departamento | `modules/helpdesk/department-integration.service.ts` | — |
| Aprovações | `modules/aprovacoes/aprovacao.service.ts` | `solicitarAprovacao`, `decidirAprovacao`, `listarAprovacoes`, `contarApendentes` |
| Time tracking | `modules/timetracking/timetracking.service.ts` | `startTimer`, `stopTimer`, `createManualEntry`, `updateEntry`, `deleteEntry`, `listEntries`, `getRunningTimer`, `getSummary`, `syncOrderHours` |

## 9. Testes existentes (backend)

22 arquivos em `backend/src/__tests__/` (audit, auth, automations, colaboradores, csat, entities, feriados, interactive, interactive-message-flow, kb, metrics, permissions, rbac, rules, sla, sla-pausa, smoke, stages, status, ticket-closure-regression, users, whatsapp-descartar). **314/314 passando.** Framework: Vitest (executado via `npx vitest run`).

## 10. Riscos conhecidos / dívidas

- `dist/` desatualizado — NÃO usar; backend roda via `npm run dev:backend` (tsx watch do `src/`).
- 22 erros tsc pré-existentes (csurf, cookie-parser, imap, facebook, instagram, ai-categorize) — fora do escopo das fases.
- Handler legado `whatsapp.service.ts` independente do shared handler — refatoração de baixa prioridade.
- Sem E2E WhatsApp real no ambiente (depende de conexão Baileys ativa em staging/prod).
