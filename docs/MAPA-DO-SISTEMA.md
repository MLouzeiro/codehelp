# MAPA DO SISTEMA — CodeHelp (FASE 1: AUDITORIA)

> Auditoria SOMENTE LEITURA executada em 25/09/2026. Nenhum código, rota, componente ou dado foi alterado.
> Classificação de cada item: **MANTER / CONSOLIDAR / RENOMEAR / MOVER / CORRIGIR / REMOVER / INVESTIGAR**.

---

## 1. RESUMO EXECUTIVO

| Área | Achado principal |
|---|---|
| Escopo | 80 rotas frontend (76 páginas distintas), 578 endpoints expostos (54 routers), 10 páginas órfãs, 24 endpoints em 4 routers nunca montados |
| Indicadores | 20 fontes de cálculo de métricas; 4 cópias quase idênticas do "resumo de período"; **FCR com 8 definições**, **SLA com 6 cálculos (2 com bug)**, CSAT com 5 cópias |
| Auditorias | 12 tipos de "auditoria"; duplicidades altas (AuditStatsPage vs AuditoriaSistema; closureAudit stateless vs AIAgentClosureAudit; TomadaDecisao vs DecisaoAudit) |
| Bugs críticos | SLA do Dashboard Executivo **sempre 100%** (verificado); `/analytics/visao-geral` envia métricas zeradas; 2 conflitos de rota reais |
| Menu | 1 item duplicado; submenu com path-pai = item filho; 9 grupos + 80 itens (alta poluição) |
| Ortopedia | ~340+ strings visíveis sem acento (164 arquivos); 1 typo "Ordem de Servição"; 0 textos mojibake |
| Encoding | UTF-8 consistente, **0 ocorrências de mojibake/bytes inválidos**; 17 arquivos com BOM (inofensivo); 1 CSV sem BOM |
| Dados de teste | **34 usuários**, **~120 quadros**, 13 tickets, 3 tarefas, 2 OS de teste confirmados; 7 usuários de teste sem relacionamento |
| Performance | 1 N+1 crítico com chamadas Claude; 7 endpoints de dashboard sem cache; sem React Query; Dashboard = 7 requests/30s |

---

## 2. MAPA GERAL — FUNCIONALIDADES

Formato: `Módulo | Página/Rota | Componente | Backend | Endpoint | Existe duplicidade | Status | Ação`

### 2.1 Painel / Dashboard

| Página | Rota | Arquivo | Endpoint principal | Duplicidade | Ação |
|---|---|---|---|---|---|
| Dashboard | `/app/dashboard` | `pages/Dashboard/Dashboard.tsx` | `/analytics/kpis` + `/analytics/dashboard` + `/analytics/insights` + `/tickets-by-department` + `/csat-trending` + `/analytics/executivo` + `/helpdesk/qualidade` (7 endpoints, poll 30s) | ALTA — 4 dos 7 recalculam os mesmos agregados; `/analytics/executivo` também é a tela Executivo | CONSOLIDAR (reduzir para 2-3 fontes) |
| Dashboard Executivo | `/app/relatorios/executivo` | `Analytics/DashboardExecutivo.tsx` | `/analytics/executivo` | MESMO endpoint do Dashboard | MOVER p/ Indicadores |
| Dashboard IA | `/app/relatorios/ia` | `Analytics/DashboardIA.tsx` | `/analytics/dashboard-ia` | parcial (recompõe relatório semanal) | MOVER p/ Indicadores |
| Painel Helpdesk | `/app/helpdesk/painel` | `Helpdesk/HelpdeskDashboard.tsx` | `/helpdesk/dashboard` (poll 20s) | 5 endpoints de "dashboard" no total | MANTER |
| Painel IA (V2) | `/app/helpdesk/painel-ia` (**sem menu**) | `Helpdesk/DashboardHelpdeskV2.tsx` | `/helpdesk/dashboard/detalhado` + `agent-performance` (N+1 Claude!) | ALTA (auditoria ad-hoc) | INVESTIGAR/CORRIGIR |
| Central de Operação | `/app/helpdesk/operacao` | `Helpdesk/CentralOperacaoPage.tsx` | `/helpdesk/operacao/snapshot` (SSE + poll 30s) | queries sem `take` | MANTER + CORRIGIR perf |
| Business Metrics | `/app/helpdesk/business-metrics` | `Dashboard/HelpdeskMetrics.tsx` (**homônimo**) | `/analytics/helpdesk-metrics` | DUAS páginas chamadas "HelpdeskMetrics" | RENOMEAR |
| Métricas Operacionais | `/app/helpdesk/metrics` | `Helpdesk/HelpdeskMetrics.tsx` | `/helpdesk/metrics` | — | MANTER |

### 2.2 Indicadores / Relatórios (candidatos a nova área "INDICADORES")

| Página | Rota | Endpoint | O que mostra | Duplicidade | Ação |
|---|---|---|---|---|---|
| Indicadores de Atendimento | `/app/helpdesk/indicadores` | `/helpdesk/indicadores` (+alertas, metas, CSV) | TMR/PR/TME/SLA com metas 🟢🟡🔴, por analista | É a fonte mais completa de SLA | **MANTER (fonte primária de SLA)** |
| Indicadores Gerenciais | `/app/relatorios/indicadores` | `/analytics/indicadores-gerenciais` | resumo período + por analista (6 queries × N) | ALTA (Grupo A) | CONSOLIDAR |
| Qualidade Operacional | `/app/helpdesk/qualidade` | `/helpdesk/qualidade*` | reabertura, recorrência, retrabalho, FCR | Fonte primária de qualidade | MANTER |
| Relatório Gerencial | `/app/relatorios/gerencial` | `/analytics/relatorio-semanal` | resumo semanal + delta + envio WA | ALTA (Grupo A) | CONSOLIDAR |
| Relatório Analítico | `/app/relatorios/analitico` | `/analytics/relatorios` | relatório por período | ALTA (Grupo A) | CONSOLIDAR |
| Relatórios Consolidados | `/app/relatorios/consolidados` | `/analytics/relatorios` (**mesmo endpoint**) | mesmos dados em outra tela | ALTA (mesma API) | CONSOLIDAR |
| Relatório de OS | `/app/orders/relatorio` | `/orders/report/dashboard` | métricas de OS | — | MANTER |
| Glossário | `/app/glossario` | (estática) | definições + metas do `metricGlossary` | Metas divergem dos cards | CORRIGIR (metas) |
| Inteligência Operacional | `/app/helpdesk/inteligencia` | `/helpdesk/inteligencia/completa` | assuntos/clientes/progresso | — | MANTER |

### 2.3 Auditorias (candidatos a nova área "AUDITORIAS")

| # | Página | Rota | Endpoint(s) | Fonte | Duplicidade | Ação |
|---|---|---|---|---|---|---|
| 1 | Auditoria do Sistema | `/app/auditoria/sistema` (**em `pages/Kanban/`**) | `/audit/global*`, `/audit/security`, `/audit/anomalias`, `/audit/alerts*` | AuditLog, AuditAlert | ALTA vs #2 | MANTER + MOVER (arquivo) |
| 2 | Auditoria & Logs | `/app/helpdesk/audit` (**sem menu**) | `/audit/stats` | AuditLog (service próprio) | ALTA vs #1 | CONSOLIDAR (remover tela) |
| 3 | Auditoria de Atendimento ("Coach IA") | `/app/helpdesk/auditoria-ia` | `/ai/agent-monitor/ranking`, `/relatorio/:id` | AIAgentAudit | rótulo colide com #6 | MANTER + RENOMEAR |
| 4 | Auditoria de Encerramento | `/app/helpdesk/auditoria-encerramento` | `/helpdesk/closure-audit/*` | **stateless** (recalcula) | ALTA vs #5 | CONSOLIDAR (ler persistido) |
| 5 | (sem tela) Encerramento persistido | embutido em #3, DashboardIA, Qualidade | `/ai/agent-monitor/encerramentos/*` | AIAgentClosureAudit | — | MANTER (fonte correta) |
| 6 | Auditoria de Atendimentos (Profissional) | `/app/helpdesk/auditoria-profissional` | `/auditoria/list`, `/auditoria/:id` | AuditoriaProfissional (14 notas) | rótulo trocado c/ #3 | MANTER + RENOMEAR |
| 7 | Auditoria Geral (panorama) | `/app/helpdesk/auditoria-geral` | `/auditoria/panorama` | agregação de #6 | ALTA (mesmos KPIs de #6) | CONSOLIDAR (aba de #6) |
| 8 | Auditoria por Analista | `/app/helpdesk/auditoria-analista` | `/helpdesk/audit/analistas/resumo`, `/audit/agent/:id` | Ticket/Message/User + AIAgentAudit | PARCIAL (5 rankings existentes) | MANTER + alinhar KPIs |
| 9 | Tomada de Decisão | `/app/helpdesk/tomada-decisao` | `/auditoria/decisao` | auditoriaDecisao (on-the-fly) | ALTA vs #10 | CONSOLIDAR |
| 10 | Auditoria Decisões | `/app/helpdesk/decisao-audit` | `/helpdesk/decisao*` | DecisionAudit (persistido) | ALTA vs #9 | CONSOLIDAR |
| 11 | (órfão) `components/AgentCoach.tsx` | — | mesmos endpoints do #3 | — | idêntico ao #3 | REMOVER (código morto) |
| 12 | Card "Auditoria de Atendimento (IA)" em #painel-ia | `/app/helpdesk/painel-ia` | `/helpdesk/audit/agent-performance` | **N+1 com Claude por request** | ALTA vs #3/#8 | CONSOLIDAR |

### 2.4 Demais módulos (resumo)

| Módulo | Rotas | Status |
|---|---|---|
| Chamados (Kanban helpdesk) | `/app/helpdesk`, `/app/helpdesk/board`, `/app/helpdesk/ticket/:id` | MANTER |
| Clientes/CRM | `/app/crm`, `/app/crm/pipeline`, `/app/crm/tabela` (sem menu), `/app/crm/servicos` (sem menu), `/app/crm/temas` (sem menu) | MANTER (avaliar menu) |
| OS | `/app/orders*` + `/app/orders/relatorio` | MANTER |
| WhatsApp | `/app/whatsapp`, `/app/whatsapp/ignorados` | MANTER |
| Tarefas/Kanban interno | `/app/kanban`, `/app/kanban/dashboard`, `/app/kanban/arquivadas` | MANTER |
| KB / Automações / Chatbots | `/app/kb`, `/app/automations*`, `/app/robos` | MANTER |
| Tempo | `/app/timetracking` | MANTER |
| Administração | `/app/settings*` (15 subpáginas sem menu, acessíveis por URL), `/app/integracoes`, `/app/glossario` | MANTER |

---

## 3. MAPA DE DUPLICIDADE — INDICADORES

### 3.1 Grupos de consolidação

| Grupo | Indicadores | Implementações | Fonte primária candidata | Ação |
|---|---|---|---|---|
| **A — Resumo de período** | total, resolvidos, abertos, taxaResolução, TMR, SLA, CSAT, FCR | **4 cópias quase idênticas**: `relatorios.coletarResumo`, `weeklyReport.coletarResumo`, `dashboardExecutivo`, `indicadores-gerenciais` | novo `shared/metrics/resumo.service.ts` | **CONSOLIDAR** |
| **B — SLA** | taxaSla, cumprido, violado, em risco | **6 cálculos**, 2 com bug | `helpdesk/indicadores.service.ts` + `sla.service` | **CONSOLIDAR (após corrigir)** |
| **C — FCR** | fcr, taxaFCR | **8 definições** distintas | `helpdesk/fcr.service.ts` | **CONSOLIDAR** |
| **D — CSAT** | csatMedio | 5 cópias do mesmo `aggregate` | `csat.service.getEstatisticasCsat` | **CONSOLIDAR** |
| **E — Tempos** | TMR/TMA/PR/TME/MTTR | 4 fórmulas com rótulos sobrepostos | `indicadores.service.ts` (metas) + `metrics.service` (mediana/p95) | definir glossário oficial |
| **F — Qualidade** | reabertura/retrabalho/FCR | 5 fontes (período global vs subset auditado) | `qualidadeOperacional.service.ts` | rotular origem |
| **G — Alertas** | todos | 3 serviços recalculam métricas | absorver no Grupo A | INVESTIGAR |

### 3.2 Bugs confirmados (corrigir antes de consolidar)

1. **`dashboardExecutivo.service.ts` (linha ≈127) — VERIFICADO**: `taxaSla = slaData._count.id / slaData._count.id` → **SLA sempre 100%** no Dashboard Executivo e no Dashboard (`/analytics/executivo`); alerta `taxa_sla_baixa` nunca dispara por aqui.
2. **`analytics.controller.ts:40,43,45`**: `/analytics/visao-geral` envia `tempoMedioRespostaMin: 0`, `slaCumprido: 0`, `taxaSla: 0` para o motor de alertas.
3. **`relatorios.service.ts:224` / `weeklyReport.service.ts:147`**: "SLA violado" = `slaTotalMinutos > 60` (mide SLA > 1h, não violação).
4. **FCR em relatorios/weekly/executivo** = `resolvidos com 1ª resposta / total de tickets` — não é FCR.
5. **`helpdesk.controller.ts:710`**: tempo médio calculado sobre `take: 50` (amostra); **`:1213`**: `total = result.length` com `take: 200`.
6. **Metas conflitantes** para o mesmo indicador: SLA 95% (glossário/metas) vs 80% (alertas); CSAT 3.5 vs 4.0 (Dashboard); FCR 60% vs 80%; TMR 360min vs 30min.

### 3.3 Duplicidade de endpoints (evidência de rota)

- **CONFLITO REAL**: `GET /api/helpdesk/filas` — `helpdesk.routes.ts:123` montado em `app.ts:211` **antes** de `filas.routes.ts:8` (`app.ts:216`) → handler de filas **inalcançável** no GET. **VERIFICADO** (ordem de montagem).
- **CONFLITO REAL**: `GET /api/orders/layouts` — `orders.routes.ts:30` (`/:id`) casa com `/layouts` porque `app.ts:199` monta `ordersRoutes` antes de `app.ts:200`. **VERIFICADO**.
- **Código morto**: 4 routers nunca montados (`cloud-api`, `evolution`, `unified`, `whatsapp-webjs` = 24 endpoints; `unified.routes.ts` **sem auth**).
- **Código órfão**: `desempenhoAnalista.service.ts` + `.controller.ts` (46 métricas) — nenhum routes.ts importa.
- Endpoints sem consumidor web: `/api/audit/` (GET), `/audit/ticket|task|order|client/:id`, `/audit/violations`, `/audit/export/filters`, `/auditoria/{meta,fila,amostra,evolucao,relatorio}`, `/audit-ticket/{sla,activity,wait,ai-logs,performance}`.

---

## 4. MAPA DE DUPLICIDADE — AUDITORIAS (resumo)

| Par duplicado | Evidência | Ação |
|---|---|---|
| AuditoriaSistemaPage × AuditStatsPage | mesmos dados `AuditLog`, 2 services de stats | CONSOLIDAR |
| closureAudit (stateless) × AIAgentClosureAudit (persistido) | mesmo algoritmo `auditarEncerramento` | CONSOLIDAR (ler persistido) |
| TomadaDecisaoPage × DecisaoAuditPage | duas telas de "decisão" com status/revisão | CONSOLIDAR |
| AuditoriaGeralPage × AuditoriaProfissionalPage | mesmos KPIs da `AuditoriaProfissional` | CONSOLIDAR (aba) |
| 4 formas de auditar agente | `agent-performance` (ad-hoc), `audit/agent/:id`, `agent-monitor/metricas`, `agent-monitor/ranking` | CONSOLIDAR |
| 5 rankings de analistas | AuditoriaGeral, AuditoriaAnalista, AuditoriaAtendimento, agent-monitor/ranking, desempenhoAnalista (órfão) | CONSOLIDAR |
| 3 escalas de nota | 0–100 (profissional), 0–10 (encerramento/agente), 1–10 (ai-audit) | padronizar/rotular |
| Rótulos cruzados | menu "Auditoria IA" ≠ tela "Auditoria de Atendimento" e vice-versa | RENOMEAR |
| `GET /audit/stats` × `GET /audit/global/stats` | 2 agregações paralelas do AuditLog | CONSOLIDAR |

---

## 5. ROTAS E MENU

### 5.1 Menu atual (9 grupos, `config/navigation.ts`)

```
VISÃO GERAL: Dashboard
ATENDIMENTO: Chamados | Atendimento ao Vivo | Quadro de Atendimento | Central de Operação
GESTÃO: Inteligência Operacional
  ├ Gestão & Indicadores (submenu, path-pai = /app/relatorios/executivo): Métricas Operacionais,
  │  Indicadores de Atendimento, Métricas de Negócio, Dashboard Executivo, Dashboard IA,
  │  Indicadores Gerenciais, Qualidade Operacional
  └ Auditoria & Decisão (submenu): Auditoria IA, Encerramento, por Analista, de Atendimentos,
     Geral, Tomada de Decisão, Decisões, do Sistema
RELATÓRIOS: Consolidados | Gerencial | Analítico | Indicadores Gerenciais (DUPLICADO) | Relatório de OS
APROVAÇÕES: Aprovações
CLIENTES: Clientes | Negócios | Ordens de Serviço
OPERAÇÃO: Tempo & Produtividade | Tarefas Internas | Dashboard de Tarefas | Tarefas Arquivadas |
  Base de Conhecimento | Automações | Construtor de Fluxos
INTEGRAÇÕES: WhatsApp | Integrações Externas | Contatos Ignorados | Chatbots
ADMINISTRAÇÃO: Configurações | Glossário
```

**Problemas**: item duplicado `/app/relatorios/indicadores`; path-pai do submenu é também item filho; 20+ rotas acessíveis por URL sem menu; nenhuma rota tem guard de role (só o menu esconde).

### 5.2 Páginas órfãs / código morto (frontend)

10 arquivos sem rota nem import: `WhatsAppConnectionsPage`, `TicketTimeline`, `TimelineExpandida`, `SmartTimeline`, `TemporalBarChart`, `TicketMetricsPanel`, `TicketHistoryDashboard`, `TicketAIPanel`, `TicketReplayPlayer`, `ResizableChat` + componente `AgentCoach.tsx`.

---

## 6. DADOS DE TESTE (somente identificação — NADA removido)

**Banco: PostgreSQL (Neon)** — leitura apenas. Totais: 41 usuários · 168 tickets · 115 clientes · 2.366 mensagens · 123 quadros · 13 tarefas · 10 OS · 2.047 audit logs · 4 auditorias profissionais.

### 6.1 TESTE CONFIRMADO

| Candidato | Quantidade | Evidência | Relacionamentos |
|---|---|---|---|
| Usuários `*@test.dev` / `*@teste.com` / `*@test.com` | **34** | emails sintéticos com timestamp (`tec-ass-1790347348393@test.dev`), criados em 25/09/2026 | 7 sem nenhum; 27 com: 162 auditLogs, 204 notificações, 3 tickets atribuídos, 3 tarefas |
| Quadros "Board Teste <timestamp>" | **~45** | nome gerado por teste, datas 19/08–25/09 | colunas/tarefas próprias |
| Quadros "VG-Board*"-* | **~75** | padrão `VG-Board<1|2|3>-<timestamp>` (scripts de teste) | idem |
| Tickets com padrão teste em `externalId`/`assunto` | **13** | a validar individualmente antes de excluir | dep. de mensagens |
| Tarefas kanban com "teste" no título | 3 | — | — |
| OS com padrão teste em `numeroOs`/`descricaoServico` | 2 | — | — |
| Clientes com "teste" no nome | **0** | nenhum | — |

### 6.2 POSSÍVEL TESTE (manter até prova)

- Usuários seed de 11/07/2026 (`Carlos Gerente`, `João Técnico`, `Maria Técnica`, `Pedro Comercial` — todos **inativos**): são o seed padrão do sistema, não lixo de teste de agente.
- `Admin Codemed`, `Junior (ednaldo@)`, `Marcio Louzeiro` → **PRODUÇÃO**.

### 6.3 PRODUÇÃO (preservar)

- 7 usuários não-teste; 115 clientes; 168 tickets (exceto os 13 a validar); 3 quadros reais (`Desenvolvimento`, `Eu`, `Interfaceamento`); 2.047 audit logs; WhatsApp, OS, CSAT e demais dados reais.

> Regra para FASE 7: excluir apenas após relatório individual com ID/relacionamentos + backup. Atenção a FKs: `Notificacao.destinatarioId`, `AuditLog.usuarioId`, `Ticket.assigneeId` (RESTRICT) — ordem de exclusão importa.

---

## 7. ORTOGRAFIA

- **~340+ strings visíveis sem acento** confirmadas em 164 arquivos (piso; varredura ampla: 2.987 linhas/277 arquivos incluindo identificadores).
- Maiores concentrações: `ConnectionsTab.tsx` (41), `WhatsAppConnectionsPage.tsx` (24), `Dashboard/HelpdeskMetrics.tsx` (11), `WhatsAppPage.tsx` (11), `kanban.service.ts` (39 mensagens de erro), integrações WhatsApp (~110), helpdesk (~70).
- Typo real: `orders-signature.service.ts:356` → "**Ordem de Servição**" (mensagem ao cliente).
- Headers CSV sem acento: `audit.controller.ts:270`, `auditTicket.service.ts:605`, `orders.service.ts:347`, `taskReport.service.ts:174`.
- NÃO alterar: rotas, enums persistidos (`media`, `atencao`), identificadores, prompts de IA, keyword lists de triagem.

## 8. ENCODING

- **0** textos mojibake; **0** arquivos com UTF-8 inválido (478 arquivos verificados).
- 17 arquivos `.ts/.tsx` com UTF-8 BOM (inofensivo).
- CSV: todos com `charset=utf-8` + BOM **exceto** `auditTicket.controller.ts:328` (única lacuna).
- PDF: pdfkit Helvetica (WinAnsi) — acentos OK. `index.html` e `htmlExport` com charset UTF-8 ✓.
- Testes: `accent-encoding.test.ts` (56 testes) cobre normalização/CSV/HTML, **não** cobre regressão de strings de UI.

---

## 9. PERFORMANCE

| Prioridade | Item |
|---|---|
| 🔴 | `ai-audit.service.ts:102` — N agentes × 50 chamadas Claude **sequenciais** por request (load do painel V2) |
| 🔴 | `operacao.service.ts:230` — `findMany` de todos os tickets abertos **sem `take`**, poll 30s + cada evento SSE |
| 🔴 | `indicadores.service.ts:270/309/852/870` — todas as mensagens do período sem `take`, duplicadas entre `/indicadores` e `/indicadores/alertas` no mesmo poll de 60s |
| 🟠 | `indicadores-gerenciais.service.ts:178` (6 queries × N analistas); `alertDetail.service.ts:62/90` (2 queries/dia, até 180); `audit-security.service.ts:74` (6 awaits sequenciais de 22 queries) |
| 🟠 | `helpdesk.controller.ts:668` — `findMany` sem `take` no dashboard pollado a 20s |
| 🟡 | Só `/analytics/executivo` tem cache (60s); Redis conectado porém **nunca usado**; frontend **sem React Query** (useState+useEffect manual); hook `usePolling` do AGENTS.md **não existe** |
| 🟡 | `WhatsAppPage`: `/whatsapp/connections/status` chamado **2× por tick** (8s/20s); `IndicadoresAtendimentoPage`: 2 chamadas sequenciais (2 RTT) |
| 🟡 | 4 páginas chamam `/analytics/relatorios/opcoes` (dados estáticos) |

---

## 10. PRÓXIMAS FASES (não executadas)

- **FASE 2** — Plano de consolidação (ANTES/DEPOIS/MOTIVO/IMPACTO/RISCO) para grupos A-G de indicadores e pares de auditoria.
- **FASE 3** — Corrigir ortografia/encoding (~340 strings, typo, BOM do CSV) + teste de regressão.
- **FASE 4** — Menu: novo agrupamento (PAINEL / ATENDIMENTO / GESTÃO / ANÁLISES / OPERAÇÃO / ADMINISTRAÇÃO) com abas internas e redirects das rotas antigas.
- **FASE 5** — Consolidar indicadores + corrigir bugs de SLA/FCR + drill-down interativo.
- **FASE 6** — Central de auditorias com abas (somente abas com funcionalidade real).
- **FASE 7** — Limpeza de dados de teste (backup + relatório individual + FKs na ordem correta).
