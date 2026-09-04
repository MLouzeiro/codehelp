# CHANGELOG — CodeHelp CRM/Helpdesk

> Registro cronológico de entregas. Formato: `Data | Escopo | Resumo`.

## v1.6.0 — 2026-08-26

### Qualidade Operacional — Sistema Unificado de Indicadores de Qualidade

**Backend**: novo `qualidadeOperacional.service.ts` — agregador central que consolida reaberturas, recorrência, retrabalho, FCR, alertas e sugestões de melhoria em um único endpoint. `calcularReaberturas()` (tickets com `totalReaberturas > 0`, métricas por analista/cliente/categoria, delta período anterior), `calcularRecorrencia()` (agrupamento por assunto/categoria, clientes afetados, retrabalho associado), `calcularRetrabalho()` (percentual de tickets com ações adicionais, tempo adicional, por analista), `calcularFcr()` (resolução no primeiro contato sem reabertura), `gerarAlertasQualidade()` (4 tipos: reabertura_aumento, retrabalho_acima_meta, fcr_abaixo_meta, problema_recorrente_sistemico), `gerarSugestoesQualidade()` (6 categorias: treinamento, desenvolvimento, base_conhecimento, processo, automação, gestão), `getDiagnosticoIa()` (análise via Claude com fallback local), `getQualidadeCliente()` (qualidade por cliente específico).

**Backend controllers/rotas**: `qualidade.controller.ts` + `qualidade.routes.ts` — 7 endpoints sob `/api/helpdesk/qualidade/*` (resumo, reaberturas, recorrência, retrabalho, diagnóstico IA, qualidade por cliente). Registrados em `app.ts`. Auth `admin/gerente/supervisor`.

**Backend alertas**: 4 novos tipos em `alertasVisaoGeral.service.ts` (`reabertura_aumento`, `retrabalho_acima_meta`, `fcr_abaixo_meta`, `problema_recorrente_sistemico`) + campo `totalPeriodo`.

**Frontend**: `QualidadeOperacionalPage.tsx` (`/app/helpdesk/qualidade`) — 4 cards indicadores (Reaberturas, Recorrência, Retrabalho, FCR) com classificação 🟢🟡🔴 e delta, seção de alertas de qualidade, sugestões de melhoria por categoria/prioridade, tabela de problemas recorrentes, retrabalho por analista, botões de diagnóstico IA. 4 modais de drill-down (Reabertura, Recorrência, Retrabalho, Diagnóstico IA). Presets Hoje/7d/30d/Mês. Menu "Qualidade Operacional" no submenu "Gestão & Indicadores".

**Frontend types**: interfaces `QualidadeOperacional`, `CardQualidade`, `ReaberturaDetalhe`, `ProblemaRecorrente`, `RetrabalhoDetalhe`, `AlertaQualidade`, `SugestaoQualidade`, `DiagnosticoIa`, `ClassificacaoQualidade` em `types/index.ts`.

**Glossário**: termos FQR (Frequência de Reaberturas), FR (Frequência de Recorrência), RR (Taxa de Retrabalho) em `metricGlossary.ts`.

**Testes**: backend tsc 0 erros novos, frontend tsc 0, vitest 5/5.

### Correção — Menu/Sidebar Piscando (Flickering)

**Causa raiz**: o `<Suspense>` no `App.tsx` envolvia todas as rotas incluindo o `Layout`. Quando o usuário navegava para uma página com componente lazy-loaded, o `Suspense` exibia `PageLoader` (tela inteira), substituindo temporariamente o Layout e a sidebar.

**Correção**: adicionado `<Suspense>` dentro do `Layout.tsx`, envolvendo `<Outlet />`. Agora o lazy-loading de páginas filhas é capturado localmente — apenas a área de conteúdo mostra spinner, enquanto a sidebar permanece estável.

**Arquivo alterado**: `frontend/src/components/Layout.tsx` (3 linhas adicionadas).

**Verificação**: frontend tsc 0, vitest 5/5, todas as funcionalidades preservadas.

## v1.5.0 — 2026-08-21

### Auditoria de Sistema Profissional + Deploy Prep

**Schema**: `AuditLog` expandido com `severity`, `clienteId`, `success`, `errorMessage`, `requestId`, `fonte`, `entidadeRelacionada`, `entidadeRelacionadaId` + 6 novos índices. Novo model `AuditAlert` (tipo, titulo, descricao, severidade, status, metadata, analisadoPor, justificativa, arquivadoEm) + 6 índices.

**Backend segurança**: `audit-security.service.ts` (22 indicadores de segurança, detecção de anomalias: excessão_exclusões, brute_force, alteração_permissoes_frequente, acesso_fora_horario; timeline por usuário com horários de atividade; filtros de exportação). `audit-alerts.service.ts` (CRUD alertas, stats, detecção automática).

**Backend endpoints**: Controller expandido de 7 → 17 endpoints: security, anomalias, alerts CRUD, export CSV, violações, order/client audit.

**Frontend**: `AuditoriaSistemaPage.tsx` reescrita com 5 abas: Visão Geral (24 cards com delta), Eventos (filtros avançados + timeline), Segurança (22 indicadores + anomalias), Alertas (pendentes/analisados/arquivados), Relatórios (CSV funcional).

**Orders**: campos de implantação (tipoImplantacao, precoImplantacao, horasDev, horasSuporte) no createOrder/updateOrder, OrderForm e OrderDetail.

**Deploy**: Dockerfile multi-stage para Fly.io, fly.toml, .dockerignore, vercel.json atualizado, .env.example completo, .gitignore expandido.

**Documentação**: docs/GUIA-PROJETO.md, docs/GITHUB-LEIGO.md, docs/DEPLOY-VERCEL-LEIGO.md, docs/BACKUP-E-RESTAURACAO.md, docs/ARQUITETURA.md, docs/VARIAVEIS-AMBIENTE.md.

**Testes**: `audit-extended.test.ts` 23/23, `orders.test.ts` 11/11. Backend 565/566, tsc 25 preexistentes (0 novos), frontend tsc 0.

## 2026-08-20

### Fase 22 — Dark Mode Global (tema escuro para todo o sistema)

**Escopo**: correção de todos os gaps de classes light-only (`bg-white|bg-gray-50/100|text-gray-500..900|border-gray-200/300|bg-slate-50|text-slate-500..900` sem variante `dark:`) nas páginas do app que não são branded. Infraestrutura já existia (`ThemeContext` alterna `.dark` no `<html>` + CSS vars `--bg-app/--bg-card/--bg-input/--border/--fg-primary`; `darkMode:'class'` no Tailwind; `.card`/`.input`/`.badge` via CSS vars).

**Arquivos corrigidos (variantes `dark:` adicionadas)**:
- **Módulo WhatsApp**: `ConnectionsTab.tsx`, `WhatsAppPage.tsx` (maps de status, tabs, dropdowns, modais Nova Conversa/Abrir Chamado/Novo Cliente/Transferir, sidebar, lista de tickets), `WhatsAppConnectionsPage.tsx` (provider selection, cards, instâncias Evolution, Cloud API, QR modal), `TicketDetail.tsx` (cabeçalho + área de chat).
- **Pages/componentes**: `Dashboard.tsx`, `OrderDetail.tsx` (status badges, timeline, assinatura), `OrderReportsPage.tsx`, `HelpdeskConfigPage.tsx`, `PermissionsPage.tsx`, `OpportunityPipeline.tsx`, `KanbanBoard.tsx` (`src/components/KanbanBoard/`), `ClassificationPanel.tsx`, `DashboardExecutivo.tsx` (`src/pages/Analytics/`), `TicketAtendimentoPage.tsx` (badge OS).
- **Páginas de métricas/reports**: `HelpdeskMetrics.tsx`, `SmartTimeline.tsx` (inclusive mapa de cores de eventos), `TemporalBarChart.tsx`, `TicketHistoryDashboard.tsx`, `TicketMetricsPanel.tsx` (defaults de MetricCard), `TicketReplayPlayer.tsx`, `TicketTimeline.tsx` (checkbox), `AuditoriaSistemaPage.tsx`, `TarefasArquivadasPage.tsx`, `TaskDashboardPage.tsx`, `AutoMessagesPage.tsx`, `CRMThemes.tsx`, `Aprovacoes.tsx`, `AuditoriaEncerramentoPage.tsx` (fallbacks de cor).

**Sem mudança (decisões de auditadas)**: `Login.tsx` e `LandingPage.tsx` (telas públicas com visual próprio — Login já é escuro por design); `AgentCoach.tsx` e `AuditoriaAtendimento.tsx` (paletas escuras auto-contidas zinc-900/950); `TimeTrackingPage.tsx` (padrão `isDark` via `useThemeSettings()` — falsos positivos); `Layout.tsx` (sidebar sempre dark nos 2 temas); knobs de toggle `bg-white` em `AlertSettings.tsx`/`ContatosIgnoradosPage.tsx`/`AIAutoAtendimentoPage.tsx`; `bg-white/20` em `DashboardHelpdeskV2.tsx` (card gradiente); swatch "Claro" do `ThemeSettings.tsx`; dots de status `bg-gray-500` (`sla_paused`).

**Verificação**: frontend `tsc --noEmit` **0 erros**; vitest **5/5**; scan final global só com gaps intencionais. Backend intacto (nenhum arquivo backend tocado).

## 2026-08-20

### Dashboard IA — Gestão Inteligente

**Backend**: novo `dashboardIa.service.ts` que compõe em um único painel os **indicadores de atendimento** (FASE B — 8 cards com meta/classificação 🟢🟡🔴 + distribuição SLA + primeira resposta), o **relatório semanal** (`gerarRelatorioSemanal` reutilizado: porDia, comparativo, top tickets problema), as **auditorias IA** (nota média 0-10 por agente via `AIAgentAudit` e KPIs de encerramento via `AIAgentClosureAudit` — prematuros/resoluções reais/reaberturas/nota média) e os **alertas ativos** (`getAlertasIndicadores`). Gera **insights gerenciais** (4) via Claude (`callClaude` com resposta JSON) com fallback local determinístico por regras (SLA abaixo da meta, TMR/PR acima, CSAT baixo, FCR baixo, analista com pior nota IA, encerramentos prematuros, alertas críticos, ticket parado, delta de volume). Rota nova `GET /api/analytics/dashboard-ia?dias=1|7|30` (clamp 1–90, admin/gerente).

**Frontend**: página `/app/relatorios/ia` (`DashboardIA.tsx` — presets Hoje/7d/30d, painel de insights com badge de fonte Claude/Regras locais e gravidade colorida, 8 cards com classificação+meta+delta, alertas ativos, evolução de tickets, SLA/PR destacados, tickets problema, tabela de performance por analista com nota IA e encerramentos). Item "Dashboard IA" no submenu "Gestão & Indicadores".

**Testes**: `dashboard-ia.test.ts` **5/5** (estrutura sem dados, clamp 1–90, enriquecimento porAnalista com nota IA + encerramentos, insight local de encerramento prematuro, fonte claude quando chave presente). Backend **495/496** (única falha TESTE #31 flaky pré-existente), tsc 25 pré-existentes (0 novos); frontend tsc 0, 5/5. Smoke HTTP validado (dias=7/1/999 clamp + 404).

## 2026-08-20

### Auditoria IA evoluída — Detecção de encerramento no monitor de agentes

**Schema**: novo model `AIAgentClosureAudit` (ticketId @unique, tipo, riscoReabertura, nota 0-10, diagnostico, detalhes, recomendaReabertura, semConfirmacao, motivoStatus, clienteVoltou, mensagensAposEncerramento, csatNota, analiseIa, dataFechamento). `db push` + generate.

**Backend**: `aiAgentMonitor.service.ts` ganhou `auditarEncerramentoTicket` (reusa `auditarEncerramento` do closureAudit — sem duplicar IA — e faz upsert idempotente por ticket), `getEncerramentosAgente` (KPIs agregados por agente: prematuros/resoluções reais/reaberturas/taxa/nota média/risco alto+crítico + lista), `MetricasAgente.encerramentos` e `RelatorioAuditoria.encerramento` (bloco com tipo, risco, nota, diagnóstico, evidências, recomendação de reabertura). Rotas novas: `GET /ai/agent-monitor/encerramentos/:agentId` e `GET /ai/agent-monitor/encerramentos/ticket/:ticketId`. `encerrarTicket` (flow.service) dispara a detecção em background (fire-and-forget, nunca quebra o fluxo).

**Perf fix**: `closureAudit.service.ts` passou a importar `exceljs` via `await import()` (lazy) em `exportarAuditoriaExcel` — o ExcelJS é pesado e, importado estaticamente, era carregado no caminho de todo encerramento, travando o event loop do Windows (causava timeout de 5s em `ticket-closure-regression.test`).

**Frontend**: `AgentCoach.tsx` mostra bloco "Encerramento detectado" (pill tipo/risco, nota, diagnóstico, evidências, CSAT, IA) + mini-cards de KPIs de encerramento nas métricas; `AuditoriaAtendimento.tsx` (ranking) corrigida para o shape real da API (agentId/agentName/notaGeralMedia/…) e exibe KPIs de encerramento por agente + bloco de encerramento no relatório do ticket + filtros de classificação do backend.

**Testes**: `ai-agent-monitor.closure.test.ts` **7/7** (upsert, idempotência, prematuro, resolução real, reabertura, agregação por agente, metricas e relatório com encerramento). Backend **490/491** (única falha TESTE #31 flaky pré-existente), tsc 25 pré-existentes (0 novos); frontend tsc 0, 5/5. Smoke HTTP das rotas novas validado (200/404).

## 2026-08-20

### FASE B — Indicadores de Atendimento (TMR/TME/SLA) + Legibilidade

**Backend**: `indicadores.service.ts` (metas configuráveis em HelpdeskConfig `metas_indicadores`, `classificarTempo`/`classificarPercentual` 🟢🟡🔴, `getIndicadoresAtendimento` com 8 cards + distribuição SLA + PR + comparativo período anterior + porAnalista, `getSlaTicketIndicador` tempo real reusando `calcularSlaRestanteMinutos`, `getAlertasIndicadores` — sla_violado/sla_em_risco/aguardando_resposta/parado/acima_da_meta —, `exportarIndicadoresCsv` `;`+BOM), `indicadores.controller.ts` + rotas (`/helpdesk/indicadores*`). Definições: TMR=resolução, PR=primeira resposta, TME=espera do cliente (não existia — calculado por gaps cliente→agente). Nenhuma regra de negócio existente alterada.

**Frontend**: página `/app/helpdesk/indicadores` (`IndicadoresAtendimentoPage.tsx` — 8 cards, filtros, presets, alertas, tabela por analista com FCR/reaberturas/retrabalho/CSAT, modal de metas, export CSV, poll 60s) + submenu "Gestão & Indicadores" + nova aba **Indicadores** no ticket com SLA em tempo real (polling 30s) e correção de contraste dark mode no chat/topo.

**Testes**: `indicadores.test.ts` 17/17. Backend **483/484** (única falha TESTE #31 flaky pré-existente), tsc 27 pré-existentes (0 novos); frontend tsc 0, 5/5. Build bloqueado apenas por erro pré-existente `@tiptap/pm`.

## 2026-08-19

### FASE A — Categorias e Assuntos do Helpdesk

**Schema**: novo model `Assunto` (slug único, categoriaId, icone, cor, prioridadePadrao, slaPadraoMin, departamentoId, idFila, ordem, ativo) + `Categoria.departamentoId` + `Ticket.assuntoId`/`assuntoRef`. db push + generate.

**Backend**: `categorias.service.ts` (CRUD categorias/assuntos, config `exigir_classificacao`, `aplicarClassificacao` com defaults + TicketEvent + AuditLog, `sugerirClassificacao` regex+Claude), `categorias.controller.ts` (13 handlers), rotas em `helpdesk.routes.ts` (categorias/assuntos/config/options/sugerir/aplicar). Validação de classificação obrigatória em `moveTicketEtapa` e `postResolverTicket` no encerramento (admin isento; bot/WhatsApp intactos).

**Seed**: 11 categorias + ~30 assuntos com prioridade/SLA padrão; `ensureCategoriasAssuntos()` idempotente.

**Frontend**: página `/app/settings/categorias-assuntos` (CRUD hierárquico + toggle obrigatoriedade) e `ClassificationPanel` no ticket (selects + sugestão IA com Aceitar/Alterar).

**Validação live**: sugestão regex → assunto `Impressora não imprime`; aplicação só com assunto resolveu categoria `Impressoras` + defaults `prioridade=alta`/`slaTotal=240`; encerramento: admin conclui (isento), técnico sem classificação → HTTP 400; histórico TicketEvent + AuditLog gravados.

**Testes**: `categorias-assuntos.test.ts` 16/16. Backend 466/467 (1 fail pré-existente time-dependent TESTE #31), tsc 25 pré-existentes (0 novos); frontend tsc 0, 5/5. Build `vite build` bloqueado por erro pré-existente de `@tiptap/pm`.

### Correção crítica — Assinatura de OS (CSRF) e fluxo de recusa

`/api/orders/sign` adicionado a `csrfExcludedPaths` (POSTs públicos `/sign/:token` e `/recusar` eram bloqueados pelo csurf → 500). Fluxo completo validado: envio, assinatura pública (200), recusa (400 sem motivo / 200 com motivo / GET 410), dados temporários limpos. Ver `docs/IMPLEMENTATION_PROGRESS.md` Fase 18.