# FLOWS — Fluxos de Negócio Críticos — CodeHelp CRM/Helpdesk

> Documento de fluxos de negócio. Gerado na FASE 0 (2026-08-13).
> Fluxos marcados como **CRÍTICOS** são protegidos por testes de regressão e NÃO podem ser quebrados.

---

## FLUXO 1 — Atendimento WhatsApp → Ticket → Encerramento → Confirmação → Avaliação  [CRÍTICO]

Protegido por: `ticket-closure-regression.test.ts` + `interactive-message-flow.test.ts` + `ticket-lifecycle-e2e.test.ts`.

```
Cliente envia msg WhatsApp
   │
   ▼
Baileys recebe (filter fromMe/status_update/@g.us/status@broadcast)
   │
   ▼
whatsapp-message-handler.ts
   ├─ Sem ticket ativo (buscarTicketAtivo: status+etapa filtrados)
   │    ├─ Confirmação de resolução pendente (aguardando_confirmacao/descricao)
   │    │    └─ SIM/NÃO/descrição interceptada → NENHUM novo ticket
   │    ├─ Avaliação pendente (CSAT respondidoEm vazio)
   │    │    └─ processa resposta de avaliação → finalizeTicketAfterEvaluation
   │    └─ Senão → Cria NOVO ticket (etapa inicial) → saudação (texto numerado dept_<slug>)
   ├─ Tem ticket ativo em atendimento → salva mensagem no ticket
   │
   ▼
Cliente clica departamento (dept_<slug> / nome / número) → detectarOpcaoMenu
   → ticket → fila → triagem → em_atendimento (atribuído a analista)
   │
   ▼
Analista atende (mensagens, checklist, prazo, horas de desenvolvimento)
   │
   ▼
Analista conclui: moveTicketEtapa(etapa='concluido') → status='fechado', dataFechamento/Conclusao
   │
   ▼
iniciarConfirmacaoResolucao → "Seu problema foi resolvido?" (texto numerado: 1 Sim / 2 Não)
   │  evaluationStatus='aguardando_confirmacao'
   ├─ SIM (1/sim/yes) → finalizarAtendimento → avaliação texto 1-5 (rating_N)
   │    → evaluationStatus='aguardando' → CSATResposta criado/enviado
   │    │
   │    ▼
   │    Cliente responde nota → extrairNotaAvaliacao → finalizeTicketAfterEvaluation
   │    → CSAT respondido, evaluationStatus='respondido', nota salva no ticket
   │
   └─ NÃO (2/nao/no) → "descreva o problema" (evaluationStatus='aguardando_descricao')
        → cliente descreve → ENCERRADO_SEM_RESOLUÇÃO (motivoStatus='encerrado_sem_resolucao',
          resumoFinal=descrição) → notificação analista/supervisores + auditoria (logAction)
        → avaliação 1-5 (mesmo fluxo do SIM)
   │
   ▼
Resposta inválida → re-pergunta a confirmação (NUNCA cria novo ticket)
   │
   ▼
Nova mensagem → ticket fechado NÃO reabre → NOVO ticket → saudação
```

**Regras de ouro:**
- Ticket encerrado NUNCA é reaberto por nova mensagem (defesa dupla: `STATUS_ENCERRADO` + `ETAPAS_ENCERRADAS` em `buscarTicketAtivo`).
- Avaliação só é enviada DEPOIS do SIM (ou após a descrição no fluxo NÃO) — nunca direto no encerramento.
- Confirmação/descrição pendente é interceptada ANTES da criação de ticket (ZERO novo ticket).
- `finalizeTicketAfterEvaluation` é idempotente (clique duplo → `{ok:true, jaFinalizado:true}`, nota original prevalece).
- Envio de mensagens do bot em Baileys/webjs é SEMPRE texto numerado (listas via `relayMessage` não são entregues). Lista interativa só em evolution/cloud.
- `detectarOpcaoMenu` aceita nome do departamento (limitado a 80 chars), `dept_<slug>` e número.

**Arquivos:** `whatsapp-message-handler.ts`, `flow.service.ts` (`iniciarConfirmacaoResolucao`, `buscarConfirmacaoPendente`, `processarRespostaEncerramento`, `finalizarAtendimento`), `helpdesk.controller.ts` (`moveTicketEtapa`), `csat.service.ts`, `constants.ts`, `menu.ts`, `whatsapp-message-service.ts` (`enviarListaInterativa`), `baileys-provider.service.ts`.

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

## FLUXO 9 — Fluxo pós-departamento (bot NÃO para)  [CRÍTICO]

Protegido por: `whatsapp-flow-pos-departamento.test.ts`.

Regressão corrigida (2026-08-15): depois que o cliente escolhia o departamento, o bot parava
(estado zerado para IDLE sem persistência, empresa só era perguntada depois da descrição e só se a IA
rodasse, empresa não encontrada era criada automaticamente, assunto não classificado). Estado agora é
persistido em `Ticket.botFluxo` (`awaiting_company` / `awaiting_description`) — fonte de verdade no banco,
sobrevive a reinício do serviço.

```
Departamento selecionado (dept_<slug> / número / NOME — detectarOpcaoMenu)
   │  inválido → montarOpcaoInvalida → re-pergunta (NUNCA salva departamento)
   ▼
Ticket: departamentoId + etapa='fila' + botFluxo
   ├─ contato JÁ vinculado a empresa (clientId por telefone)
   │    └─ botFluxo='awaiting_description' → pergunta descrição (montarAckDepartamento)
   └─ contato SEM empresa vinculada
        └─ botFluxo='awaiting_company' → pergunta NOME da empresa
             ├─ exata/única no CRM → vincula (clientId) + cria/atualiza Colaborador por telefone
             │    → botFluxo='awaiting_description' → pergunta descrição
             ├─ múltiplas → lista numerada (pendingCompanyCandidates, TTL 10min)
             │    → cliente escolhe por número ou nome → vincula
             └─ NÃO encontrada → "Não localizamos a empresa..." → NÃO cria vínculo,
                  NUNCA cria empresa nova → re-pergunta (continua awaiting_company)
   ▼
Descrição recebida (botFluxo='awaiting_description')
   → analisarDescricaoProblema (IA + fallback local determinístico)
   → assunto/categoria/prioridade salvos no ticket + observacoes
   → PROTOCOLO gerado (#TKT-YYYYMMDD-NNNN) — generateProtocolo (lock thread-safe)
   → botFluxo=NULL
   ▼
Mensagem ao cliente: "atendimento registrado com sucesso! ✅  *Protocolo: #XXXXXX*  *Assunto:* ..."
   → posição na fila (montarPosicaoFilaComInfo)
   ▼
Ticket na fila do departamento → analista assume (FLUXO 1/3)
```

**Regras de ouro:**
- Estado da conversa = `Ticket.botFluxo` no banco (não in-memory). Reinício/restart não perde o fluxo.
- Idempotência: `recentMessageIds` (TTL) + `processingLocks` (30s) + `buscarTicketAtivo` → ZERO tickets duplicados.
- Empresa não encontrada → NUNCA cria empresa/vínculo automático.
- Protocolo é gerado na criação (confirmação ao cliente), não só quando o analista abre o chamado;
  `abrirChamadoPorAtendente` reutiliza protocolo existente (não retorna mais "Ticket ja triado").
- Timeline: `TicketStageEvent` registra "Departamento selecionado", "Empresa identificada",
  "Descrição recebida / assunto identificado".
- Fluxo legado (botFluxo null) preservado intacto na seção 9 do handler.
- Encerramento/confirmação/CSAT (FLUXO 1) NÃO são alterados por este fluxo.

**Arquivos:** `whatsapp-message-handler.ts` (helpers `vincularColaboradorTelefone`, `confirmarEmpresaTicket`,
`getPendingCompanyCandidates`, `processarNomeEmpresaBot`, `processarDescricaoBot`), `menu.ts`, `flow.service.ts`
(`buscarTicketAtivo`), `triagem.service.ts` (`abrirChamadoPorAtendente`), `whatsapp.service.ts`
(`generateProtocolo`), `schema.prisma` (`Ticket.botFluxo`).

---

## Fluxos de baixa frequência (referência)

- Notificações internas (`notificacoes/`), Automations (`automations/`), Billing (`billing/`), Alerts (`alerts/`), KB (`kb/`), Enquetes (`enquetes/`), Feriados (`feriados/`), Channels (integração de canais).
