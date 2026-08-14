# FLOWS — Fluxos de Negócio Críticos — CodeHelp CRM/Helpdesk

> Documento de fluxos de negócio. Gerado na FASE 0 (2026-08-13).
> Fluxos marcados como **CRÍTICOS** são protegidos por testes de regressão e NÃO podem ser quebrados.

---

## FLUXO 1 — Atendimento WhatsApp → Ticket → Encerramento → Avaliação  [CRÍTICO]

Protegido por: `ticket-closure-regression.test.ts` + `interactive-message-flow.test.ts`.

```
Cliente envia msg WhatsApp
   │
   ▼
Baileys recebe (filter fromMe/status_update/@g.us/status@broadcast)
   │
   ▼
whatsapp-message-handler.ts
   ├─ Sem ticket ativo (buscarTicketAtivo: status+etapa filtrados) 
   │    └─ Cria NOVO ticket (etapa inicial) → enviarMenuInicial (lista interativa dept_<slug>)
   ├─ Tem ticket ativo em atendimento → salva mensagem no ticket
   └─ Tem avaliação pendente (CSAT respondidoEm vazio)
        └─ processa resposta de avaliação → finalizeTicketAfterEvaluation
   │
   ▼
Cliente clica departamento (dept_<slug>) → detectarOpcaoMenu (aceita nome/número/slug)
   → ticket → fila → triagem → em_atendimento (atribuído a analista)
   │
   ▼
Analista atende (mensagens, checklist, prazo, horas de desenvolvimento)
   │
   ▼
Analista conclui: moveTicketEtapa(etapa='concluido') → status='fechado', dataFechamento/Conclusao
   │
   ▼
finalizarAtendimento → evaluationStatus='aguardando' → CSATResposta criado
   → enviarMensagemCsat (lista interativa rating_1..5, texto formatado + link fallback)
   │
   ▼
Cliente clica rating_N → extrairNotaAvaliacao → finalizeTicketAfterEvaluation
   → CSAT respondido, evaluationStatus='respondido', nota salva no ticket
   │
   ▼
Nova mensagem → ticket fechado NÃO reabre → NOVO ticket
```

**Regras de ouro:**
- Ticket encerrado NUNCA é reaberto por nova mensagem (defesa dupla: `STATUS_ENCERRADO` + `ETAPAS_ENCERRADAS` em `buscarTicketAtivo`).
- `finalizeTicketAfterEvaluation` é idempotente (clique duplo → `{ok:true, jaFinalizado:true}`, nota original prevalece).
- Envio interativo NUNCA deve retornar `success:true` em fallback silencioso de texto; fallback é explícito (`usedFallback:true` + log).
- `detectarOpcaoMenu` aceita nome do departamento (limitado a 80 chars), `dept_<slug>` e número.

**Arquivos:** `whatsapp-message-handler.ts`, `flow.service.ts`, `helpdesk.controller.ts` (`moveTicketEtapa`), `csat.service.ts`, `menu.ts`, `constants.ts`, `whatsapp-message-service.ts`, `baileys-provider.service.ts`.

---

## FLUXO 2 — Fora do horário de expediente

```
Mensagem do cliente fora do horário comercial (horario.ts)
   │
   ▼
Bot responde informando que está fora do horário
   │
   ▼
Ticket registrado em 'aguardando' (aguardando_cliente/aguardando_os? → fila)
   │
   ▼
Ao abrir o expediente (sla.scheduler / rules) → ticket volta para a fila
   │
   ▼
Analista assume → fluxo normal de atendimento (FLUXO 1)
```

**Arquivos:** `helpdesk/horario.ts`, `helpdesk/sla.scheduler.ts`, `helpdesk/rules.service.ts`.

---

## FLUXO 3 — Criação de ticket manual (analista no kanban)

```
Analista cria ticket (HelpdeskKanban)
   │
   ▼
POST /api/helpdesk/tickets → ticket na etapa inicial (fila)
   │
   ▼
Triagem (palavras-chave ou IA — aiTriage.service) → categoria/prioridade/departamento
   │
   ▼
Kanban 6 etapas fixas (fila, triagem, em_atendimento, aguardando_cliente, aguardando_os, concluido)
   │
   ▼
PATCH /api/helpdesk/tickets/:id/move (valida targetStage)
   │
   ▼
Encerramento → FLUXO 1 (parte de avaliação)
```

**Arquivos:** `helpdesk.controller.ts`, `helpdesk.service.ts`, `triagem.service.ts`, `kanban/*`.

---

## FLUXO 4 — Ordem de Serviço (OS) com assinatura

```
Analista cria OS (OrderForm) → status 'rascunho'
   │
   ▼
Vincula ticket (opcional) + técnico responsável + valores + prazos
   │
   ▼
Gera PDF (orders/pdf.service.ts)
   │
   ▼
Envia link de assinatura /assinar/:token (SignPage)
   │
   ▼
Cliente assina (Signature: token único, expiração, base64, IP, userAgent)
   │
   ▼
OS concluída; horas de dev/suporte registradas (TimeEntry via timetracking)
```

**Arquivos:** `orders/*`, `orders/pdf.service.ts`, `frontend/src/pages/Orders/*`, `frontend/src/pages/Sign/SignPage.tsx`.

---

## FLUXO 5 — Aprovações

```
Analista solicita aprovação (aprovacao.service: solicitarAprovacao)
   │  tipo + motivo + observação + valorAprovado
   ▼
Cria Aprovacao (status 'pendente') + Notificacao para admin/gerente
   │
   ▼
Admin/Gerente decide (Aprovacoes.tsx → decidirAprovacao)
   ├─ aprovada → status='aprovada', dataDecisao, notificação ao solicitante
   └─ rejeitada → status='rejeitada', observação, notificação
   │
   ▼
Histórico consultável (listarAprovacoes com filtros status/tipo/ticketId)
```

**Arquivos:** `aprovacoes/aprovacao.service.ts`, `aprovacao.controller.ts`, `frontend/src/pages/Helpdesk/Aprovacoes.tsx`.

---

## FLUXO 6 — Time Tracking

```
Analista inicia timer (startTimer) → TimeEntry (tipo suporte, ticket/OS vinculado)
   │
   ▼
Para timer (stopTimer) → duracaoMin calculada
   │
   ▼
Ou cria entrada manual (createManualEntry) com duracaoMin
   │
   ▼
Relatórios: getSummary (por usuário/ticket/OS/período/billable), syncOrderHours
   │
   ▼
Frontend: TimeTrackingPage (listagem, timer ativo, totais)
```

**Arquivos:** `timetracking/*`, `frontend/src/pages/TimeTracking/TimeTrackingPage.tsx`.

---

## FLUXO 7 — Relatórios e auditoria IA

```
Mensagens de agentes → aiAgentMonitor (avaliarMensagemAgente) → AIAgentAudit
   │
   ▼
auditTicket.service loga eventos/timeline/SLA/waits/atividade IA (TicketStageEvent, TicketTimeline, etc.)
   │
   ▼
Relatório semanal (weeklyReport) → getDashboardMetrics → cards/gráficos
   │
   ▼
Dashboards: HelpdeskDashboard (ao vivo), HelpdeskMetrics, business-metrics, AuditoriaAtendimento, AuditStatsPage
```

**Arquivos:** `ai/aiAgentMonitor.service.ts`, `helpdesk/ai-audit.service.ts`, `helpdesk/auditTicket.service.ts`, `analytics/weeklyReport.service.ts`, `helpdesk/metrics.service.ts`, frontend em `pages/Helpdesk/*` e `pages/Dashboard/*`.

---

## FLUXO 8 — Multi-provider WhatsApp (Baileys / Evolution / Cloud)

```
Envio/recepção → whatsapp-provider-factory (escolhe provider ativo)
   ├─ Baileys (WebSocket, primário) — baileys-provider.service.ts
   ├─ Evolution API (REST self-hosted) — evolution-api.service.ts
   └─ Cloud API (Meta) — cloud-api.service.ts
        │
        ▼
Handlers → whatsapp-message-handler.ts (canônico) → bot/triagem/fluxo FLUXO 1
```

**Regra:** TODOS os providers devem manter os filtros `fromMe`, `status_update`, `@g.us`, `status@broadcast`.

---

## Fluxos de baixa frequência (referência)

- Notificações internas (`notificacoes/`), Automations (`automations/`), Billing (`billing/`), Alerts (`alerts/`), KB (`kb/`), Enquetes (`enquetes/`), Feriados (`feriados/`), Channels (integração de canais).
