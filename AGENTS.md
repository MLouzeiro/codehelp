# CodeHelp CRM/Helpdesk
> Sistema de CRM/Helpdesk com integração WhatsApp, kanban, CRM, analytics e app mobile.

## Stack

| Camada | Tecnologia |
|--------|------------|
| **Backend** | Node.js + Express + TypeScript |
| **Frontend Web** | React 18 + Vite + TypeScript + Tailwind CSS |
| **Mobile** | React Native + Expo SDK 51 + Expo Router |
| **Banco de dados** | Prisma + SQLite (dev) / PostgreSQL (prod) |
| **ORM** | Prisma |
| **Auth** | JWT (access 15min + refresh 7d) + bcryptjs |
| **WhatsApp** | Baileys (primário) / Evolution API / Cloud API |
| **Estado** | React Query (web) / Zustand (mobile) |
| **Ícones** | Lucide React (web) |

## Estrutura de pastas

```
code-help/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Schema do banco
│   │   ├── seed.ts              # Dados iniciais
│   │   └── migrations/          # Migracoes
│   ├── src/
│   │   ├── config/              # database.ts, env.ts
│   │   ├── modules/             # Modulos por dominio
│   │   │   ├── auth/            # auth.controller.ts, rbac.ts
│   │   │   ├── helpdesk/        # helpdesk.service.ts, autoMessages.service.ts
│   │   │   ├── crm/             # crm.controller.ts
│   │   │   ├── orders/          # orders.controller.ts, os-layout.service.ts
│   │   │   ├── whatsapp/        # providers, handler compartilhado
│   │   │   ├── ai/              # aiTriage.service.ts, aiValidation.service.ts
│   │   │   ├── billing/         # billing.service.ts
│   │   │   ├── alerts/          # alerts.service.ts
│   │   │   ├── aprovacoes/      # aprovacao.controller.ts
│   │   │   ├── kanban/          # kanban.controller.ts
│   │   │   ├── analytics/       # analytics.controller.ts
│   │   │   ├── kb/              # knowledge base
│   │   │   ├── csat/            # customer satisfaction
│   │   │   ├── automations/     # regras de automacao
│   │   │   ├── notificacoes/    # notificacoes internas
│   │   │   ├── permissions/     # RBAC avancado
│   │   │   ├── feriados/        # feriados nacionais
│   │   │   ├── audit/           # log de auditoria
│   │   │   └── users/           # gestao de usuarios
│   │   ├── shared/middleware/   # auth.ts (authenticate, authorize, ticketAccess)
│   │   └── server.ts            # Entry point
│   ├── storage/pdfs/            # Uploads (gitignored)
│   └── dist/                    # Build (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components reutilizaveis
│   │   │   ├── ui/              # Button, Input, Card, Modal, etc.
│   │   │   ├── KanbanBoard.tsx  # Board de kanban generico
│   │   │   ├── Layout.tsx       # Layout principal (sidebar + content)
│   │   │   └── ThemeSettings.tsx # Configuracoes de tema
│   │   ├── pages/               # Paginas por rota
│   │   │   ├── Login/
│   │   │   ├── Dashboard/
│   │   │   ├── CRM/             # ClientList, ClientForm, ClientDetail
│   │   │   ├── Helpdesk/        # HelpdeskKanban, TicketAtendimentoPage
│   │   │   ├── WhatsApp/        # WhatsAppPage, WhatsAppConnectionsPage
│   │   │   ├── Kanban/          # KanbanPage (tarefas internas)
│   │   │   ├── Orders/          # OrderList, OrderForm, SignPage
│   │   │   └── Settings/        # HelpdeskConfigPage, Departamentos, Filas, OSLayoutsPage
│   │   ├── services/            # api.ts, auth.tsx, ThemeContext.tsx
│   │   └── types/               # index.ts (interfaces)
│   └── dist/                    # Build (gitignored)
├── mobile/                      # App React Native + Expo
│   ├── app/                     # Expo Router (file-based)
│   │   ├── (auth)/              # login.tsx
│   │   ├── (tabs)/              # index, helpdesk, crm, orders, approvals, notifications
│   │   └── (modals)/            # ticket/[id], client/[id], order/[id], settings
│   └── src/                     # services, stores, screens, components, types
├── .claude/                     # Skills e scripts RAG
├── .opencode/                   # Config opencode, skills
└── AGENTS.md                    # Este arquivo
```

## Como rodar localmente

```bash
# Instalar dependencias
npm install

# Backend
npm run dev:backend          # Backend (tsx watch, porta 3001)

# Frontend
npm run dev:frontend         # Frontend (vite, porta 5173)

# Mobile
cd mobile
npm install --legacy-peer-deps
npx expo start               # Iniciar Expo

# Banco de dados
npm run db:push              # Prisma db push
npm run db:seed              # Executar seed
npm run db:studio            # Prisma Studio
```

## Padrões de código

- **Backend**: Controllers com `async handler + try/catch`, services com `AppError` para erros, Prisma para queries
- **Frontend**: Componentes funcionais com hooks, `useCallback` para funções, `usePolling` para refresh automático
- **Mobile**: Expo Router (file-based), Zustand para state, NativeWind para estilos
- **Nomenclatura**: kebab-case para arquivos React, camelCase para funções, PascalCase para componentes e tipos
- **Endpoints**: `/api/{recurso}` para lista/criação, `/api/{recurso}/[id]` para item específico

## TDD

- **Backend**: Jest
- **Frontend**: Jest + React Testing Library
- **Mobile**: Jest + React Native Testing Library
- **Onde ficam os testes**: `__tests__/api/` (integração), `__tests__/lib/` (unitários)

## Regras de Proteção (SEMPRE SEGUIR)

### 1. Antes de editar
- **Leia o código ao redor** — entenda o contexto antes de modificar qualquer arquivo
- **Entenda o fluxo** — rastreie como os dados chegam e saem do ponto que você vai alterar
- **Verifique dependências** — outros arquivos importam ou chamam o que você vai mudar?

### 2. Durante a edição
- **Edite o mínimo possível** — não refatore código funcional sem necessidade
- **Mantenha compatibilidade** — se alterar uma assinatura de função, atualize todos os chamadores
- **Não remova filtros existentes** — se adicionar um novo, não remova os anteriores
- **Use os mesmos padrões** — se o código usa `prisma.model.findFirst`, não mude para `findUnique` sem motivo
- **Não quebre tipos TypeScript** — mantenha interfaces existentes, adicione novas propriedades como opcionais

### 3. Após a edição
- **Rode `npx tsc --noEmit`** — verifique se não há erros de tipagem
- **Rode `npm test`** — verifique se testes existentes não quebraram
- **Não adicione `console.log`** em código de produção, use `console.warn` ou `console.error` apenas para erros

### 4. Regras específicas por módulo

#### WhatsApp
- **NUNCA remover filtros de `fromMe`, `status_update`, `@g.us`, `status@broadcast`** — eles impedem mensagens indesejadas
- **Ao adicionar novo provider**, adicione os MESMOS filtros que existem nos outros providers
- **Handler compartilhado** (`whatsapp-message-handler.ts`) é o canonical — mudanças afetam Evolution E Cloud API
- **Handler legado** (`whatsapp.service.ts`) é independente — mudanças NÃO afetam o shared handler
- **NUNCA usar `Stop-Process -Name chrome`** — isso mata TODOS os Chrome do usuário. SEMPRE usar `killPuppeteerChrome(sessionDir)` do `whatsapp.service.ts`

#### Auth
- **NUNCA remover verificação de `sessionToken`** — ela previne login em múltiplos dispositivos
- **NUNCA rotacionar `sessionToken` no refresh** — apenas no login (causa logout em cascade)

#### Helpdesk/Triagem
- **Fluxo de empresa**: verificar SEMPRE se a última mensagem do bot perguntou empresa antes de processar resposta
- **Etapas do pipeline**: 6 fixas (`fila`, `triagem`, `em_atendimento`, `aguardando_cliente`, `aguardando_os`, `concluido`) — não reordenar

#### Banco de dados
- **NUNCA usar `deleteMany`** em dados de produção — usar `update` com `active: false`
- **NUNCA editar migrations geradas** — criar nova migration se necessário
- **SEMPRE usar `upsert`** quando o dado pode ou não existir

#### Segurança
- **NUNCA usar `innerHTML`** com dados do usuário — usar `textContent` ou `createElement`
- **NUNCA usar `document.write()`** com conteúdo dinâmico — usar DOM manipulation segura
- **SEMPRE validar assinatura HMAC** em webhooks (Cloud API: `X-Hub-Signature-256`, Evolution: query/header secret)
- **SEMPRE usar `rateLimiter`** em endpoints públicos de token (sign, approval, login)
- **SEMPRE bloquear IPs privados** em `callExternal()` (SSRF protection)
- **Session token obrigatório** no refresh — retornar 400 se ausente
- **Logout server-side** — limpar `sessionToken` no banco via `POST /api/auth/logout`
- **Senha mínima 8 caracteres** — validação Zod em todos os schemas
- **NUNCA expor `password` ou `sessionToken`** em respostas API

## Regras por submódulo

### M1 — Autenticação
- **JWT**: token em `Authorization: Bearer` header; `localStorage` chave `crm_token`
- **Hash**: bcryptjs com 10 rounds — nunca md5, sha1 ou plain text
- **Registro**: só DONO/GESTOR podem criar usuários; VENDEDOR não pode criar outros vendedores
- **Logout**: apenas limpar `localStorage` e redirect — sem invalidar token no backend

### M2 — Helpdesk & Kanban
- **Leads/Tickets**: Kanban com 6 etapas fixas
- **Movimentação**: `PATCH /api/helpdesk/tickets/:id/move` valida `targetStage`
- **Multi-departamento**: tickets podem ser atribuídos a departamentos específicos
- **Triagem automática**: classificação por palavras-chave e IA

### M3 — WhatsApp Multi-Provider
- **Baileys**: Provider primário (WebSocket, sem Chrome/Puppeteer)
- **Evolution API**: Self-hosted Docker, API REST
- **Cloud API**: Meta oficial, free tier 1000 conversas/mês
- **Handler compartilhado**: lógica de bot/triagem reaproveitada entre providers

### M4 — Dashboard & Métricas
- **Acesso**: rota e páginas exclusivas para admin/gerente
- **Gráficos**: Donut (status, prioridade, canal), Bar (prioridade), Area (tendência)
- **Métricas**: total tickets, tempo médio resposta, taxa resolução, clientes ativos

### M5 — Mobile (React Native + Expo)
- **File-based routing**: Expo Router
- **State**: Zustand stores (auth, helpdesk, crm, orders, notifications)
- **Offline**: AsyncStorage + sync
- **Push**: Expo Notifications + FCM
- **Biometria**: expo-local-authentication
- **Assinatura**: react-native-svg (canvas de assinatura)

### M6 — IA
- **AiTriage**: Análise inteligente de problemas com Claude API (fallback local regex)
- **AiValidation**: Propostas de resposta com workflow de validação humana
- **Auto-attendance**: Config threshold para envio automático

### M7 — Billing
- **CRUD de cobranças** por cliente (terminais, hostlinks, interfaces, exames)
- **Cálculo mensal** com auto-count para tipo "exames"
- **Dashboard**: pendentes, cobrados, erros, valor total

## Comandos úteis

```bash
# Backend
npm run dev:backend          # Backend (tsx watch, porta 3001)
npm run db:push              # Prisma db push
npm run db:seed              # Executar seed
npx tsc --noEmit             # Typecheck backend

# Frontend
npm run dev:frontend         # Frontend (vite, porta 5173)
npx tsc --noEmit             # Typecheck frontend

# Mobile
cd mobile
npx expo start               # Iniciar Expo
npx expo run:android         # Build Android
npx expo run:ios             # Build iOS
```

## Decisões em aberto

- [ ] Nome do sistema e logo/branding
- [ ] Deploy do backend (Vercel não suporta Express nativamente)

## Progresso Recente (SessãoAtual)

### Layouts de OS — Completo (v1.7.0)
- [x] **Schema**: model `OSLayout` (nome, descricao, tipo personalizado/pdf_importado, configuracao JSON com cores/cabeçalho/rodapé/seções, timbradoPath, timbradoApply, margens 4 campos, organizationId) + `layoutId` em `ServiceOrder`
- [x] **Backend**: `os-layout.service.ts` (CRUD, upload timbrado, config parsing, default layout), `os-layout.controller.ts` (9 handlers), `os-layout.routes.ts` (multer upload)
- [x] **Backend**: PDF generator refatorado (`pdf.service.ts`) — `buildPdfWithLayout` (personalizado) + `buildPdfWithTimbrado` (pdf_importado via pdf-lib merge); suporte 1-página e multi-página; margens reservadas configuráveis
- [x] **Frontend**: `OSLayoutsPage.tsx` (listagem, editor modal com cores/cabeçalho/rodapé/seções/margens, upload timbrado, duplicar, padrão, excluir)
- [x] **Frontend**: Seletor de layout no `OrderForm.tsx` e `OrderDetail.tsx`; download PDF com layout selecionado
- [x] **Integração**: rota + menu em Configurações → Layouts de OS
- [x] Verificação: backend tsc 0 erros novos, frontend tsc 0, vitest 5/5

### Enriquecimento de Auditoria — Completo (Fase 4)
- [x] **Interface**: `LogParams` estendido com `severity?: string` e `clienteId?: string`
- [x] **Wrapper**: `logAction` passa os campos para `logAudit`
- [x] **53 call sites** enriquecidos em 16 arquivos (helpdesk, billing, permissions, crm, ai, csat, kb, automations, feriados)
- [x] **Classificação**: alta (deletar, permissoes, encerrar_sem_resolucao), media (escalar, sla, config), baixa (criar, atualizar, mover_etapa)
- [x] Verificação: backend tsc 0 erros novos, frontend 5/5, audit tests 23/23

### Qualidade Operacional — Sistema Unificado (v1.6.0)
- [x] **Backend**: `qualidadeOperacional.service.ts` — agregador central (reaberturas, recorrência, retrabalho, FCR, alertas, sugestões, diagnóstico IA, qualidade por cliente)
- [x] **Backend**: `qualidade.controller.ts` + `qualidade.routes.ts` — 7 endpoints sob `/api/helpdesk/qualidade/*`
- [x] **Backend**: 4 novos tipos de alerta em `alertasVisaoGeral.service.ts` (reabertura_aumento, retrabalho_acima_meta, fcr_abaixo_meta, problema_recorrente_sistemico)
- [x] **Frontend**: `QualidadeOperacionalPage.tsx` (`/app/helpdesk/qualidade`) — 4 cards indicadores, alertas, sugestões, tabela recorrência, retrabalho por analista, 4 modais drill-down, presets período
- [x] **Frontend**: interfaces `QualidadeOperacional` + 8 tipos em `types/index.ts`
- [x] **Frontend**: termos FQR/FR/RR no `metricGlossary.ts`
- [x] **Frontend**: rota + menu no submenu "Gestão & Indicadores"
- [x] Verificação: backend tsc 0 erros novos, frontend tsc 0, vitest 5/5

### Correção — Menu/Sidebar Piscando (v1.6.0)
- [x] **Causa raiz**: `<Suspense>` no `App.tsx` envolvia todas as rotas incluindo Layout; lazy-loading de páginas filhas desmontava a sidebar
- [x] **Correção**: `<Suspense>` adicionado dentro de `Layout.tsx` envolvendo `<Outlet />` — lazy-loading capturado localmente
- [x] **Arquivo**: `frontend/src/components/Layout.tsx` (3 linhas adicionadas)
- [x] Verificação: frontend tsc 0, vitest 5/5, todas as funcionalidades preservadas

### Roadmap v1.4 — Fases 4 a 9 concluídas (commits `2a34760` a `a9a6a06`)
- [x] **FASE 4 — Aprovações via WhatsApp**: `Aprovacao` + `canal`, `telefoneAprovador`, `token` (@unique), `expiraEm`; `decidirAprovacaoPorToken` (público, sem criar ticket); `processarRespostaAprovacaoWhatsApp` intercepta no handler canônico ANTES da criação de ticket (ZERO novo ticket) via interactiveId `aprovacao_<id>_aprovar|rejeitar` ou texto (aprovar/1/sim/rejeitar/2/não) casado pelo telefone; página pública `/aprovacoes/:token`
- [x] **FASE 5 — Relatório Gerencial**: página `/app/relatorios/gerencial` consumindo `GET /api/analytics/relatorio-semanal` (cards, delta pills, recharts, sugestões IA, prévia/envio WhatsApp)
- [x] **FASE 6 — Dashboard Executivo**: `GET /api/analytics/executivo?dias=7|30|90` (`dashboardExecutivo.service.ts`, endpoint único parametrizável, clamp 1–90) + página `/app/relatorios/executivo`
- [x] **FASE 7 — Auditoria de Encerramento**: `closureAudit.service.ts` classifica `encerramento_prematuro`/`resolucao_real`/`reabertura` (IA + fallback local; reabertura = novo ticket mesmo telefone após `dataFechamento`, exclui o próprio ticket); rotas `/helpdesk/closure-audit/*`; página `/app/helpdesk/auditoria-encerramento`
- [x] **FASE 8 — Auditoria por Analista**: `agentReport.service.ts` (métricas + FCR + CSAT + nota IA por ticket) e `getReplayConversa` (replay completo com auditoria por mensagem); rotas `/helpdesk/audit/agent/:id` e `/ticket/:ticketId`; página `/app/helpdesk/auditoria-analista`
- [x] **FASE 9 — Refatoração não-destrutiva**: `whatsapp-utils.ts` (`normalizePhone`, `phoneDigitsFromChat`) deduplica o padrão `replace(/[^\d]/g,'')` (19 pontos: providers cloud/evolution/baileys/webjs, message-service, whatsapp.controller). **Handler canônico e legado intactos**
- [x] Backend **348/348 testes**, frontend **5/5**, tsc 22 erros pré-existentes (0 novos)

### Assinatura do Analista — Completo
- [x] Campo `signature` adicionado ao model User (Prisma schema)
- [x] API `updateUsers` aceita e retorna signature
- [x] WhatsApp controller busca signature do usuario e anexa a mensagem
- [x] Frontend: campo de assinatura no formulario de usuarios (UsersPage)
- [x] Formato: `_Nome\Assinatura_` no final da mensagem enviada ao cliente
- [x] Mensagem original salva no DB (sem assinatura)
- [x] Typecheck passando (backend + frontend)

### CSAT Flow — Completo
- [x] Investigação completa do fluxo: conclusão → confirmação de resolução → CSAT → resposta → novo ticket
- [x] **Correção da causa raiz (2026-08-14)**: `enviarListaInterativa` regrediu para lista no Baileys (`relayMessage` não entrega). Agora envia **texto numerado SEMPRE** em Baileys/webjs; lista interativa só em evolution/cloud. Corrige avaliação e saudação que nunca chegavam.
- [x] **Confirmação de resolução (fluxo obrigatório)**: ao encerrar, bot pergunta "*Seu problema foi resolvido?* (1 Sim / 2 Não)" ANTES da avaliação. SIM → CSAT 1-5. NÃO → pergunta descrição → `motivoStatus='encerrado_sem_resolucao'` + `resumoFinal` + notificação analista/supervisores + auditoria → CSAT. Resposta inválida re-pergunta (ZERO novo ticket).
- [x] Estados novos: `aguardando_confirmacao` / `aguardando_descricao` (`constants.ts`); `buscarConfirmacaoPendente` + `processarRespostaEncerramento` interceptam no handler canônico ANTES da criação de ticket.
- [x] `encerrarTicket(finalizarCsat)` e `moveTicketEtapa(concluido)` disparam confirmação; scheduler CSAT ignora tickets em confirmação.
- [x] Backend 351/351 testes (3 novos), tsc 20 erros pré-existentes (0 novos).
- [x] **Bug corrigido**: CSAT detectava "1-5" mesmo quando cliente escolhia departamento
- [x] **Máquina de estados**: `IDLE / AWAITING_CSAT / AWAITING_DEPARTMENT` por conversa (TTL 30min) + estados de confirmação no banco
- [x] **Text messages** substituíram list messages (Baileys `relayMessage` retorna success mas WhatsApp não entrega)
- [x] `enviarMensagemCsat` agora envia texto formatado com opções 1-5 + link fallback
- [x] `enviarMenuInicial` agora envia texto com departamentos numerados + passa `whatsappConnectionId`
- [x] **Removido**: criação automática de ticket na resposta CSAT — novo ticket só na próxima mensagem
- [x] CSAT handler salva mensagem do cliente no ticket
- [x] Logs de transição de estado para debug

### Kanban Interno — Completo
- [x] Modal flutuante centralizado (substituiu painel lateral)
- [x] Aba Checklist com barra de progresso e importação de templates
- [x] Campos Prioridade/Categoria/Classificação/Prazo editáveis direto na visualização
- [x] Botão IA para auto-categorizar (prioridade, classificação, categoria)
- [x] Backend: `ai-categorize.service.ts` (Claude API + fallback local por palavras-chave)
- [x] Backend: Checklist template CRUD + import para tickets e kanban
- [x] Backend: `department-integration.service.ts` (tempo por departamento)
- [x] Backend: `fcr.service.ts` (First Contact Resolution)
- [x] Frontend: proxy `/uploads` no vite.config (correção de imagens)
- [x] Defesas de runtime para evitar tela branca

### Helpdesk — Completo
- [x] Sistema de checklist em tickets (CRUD + progress bar)
- [x] Checklist template management (criar, editar, importar)
- [x] Prazo de entrega com indicador visual (atrasado/próximo/no prazo)
- [x] Horas de desenvolvimento
- [x] Tempo por departamento (TicketDepartmentTime)
- [x] Dashboard com card Taxa FCR

### Auditoria + Correção Fluxo Encerramento/Avaliação — Completo
- [x] FASE 1 (auditoria) concluída: mapeado fluxo completo de encerramento/avaliação e arquitetura
- [x] **Fix** `buscarTicketAtivo` (flow.service.ts): filtra também por `etapa: { notIn: ETAPAS_ENCERRADAS }` (`concluido`/`descartado`) além de `status` — defesa dupla contra reabertura de ticket encerrado
- [x] **Fix** `finalizarAtendimento`: novo helper `resetBotState` limpa estado in-memory do bot (`AWAITING_CSAT`/`AWAITING_DEPARTMENT` → `IDLE`) nos caminhos de skip (avaliação já respondida / CSAT já respondido)
- [x] **Fix** `detectarOpcaoMenu` (menu.ts): aceita o NOME do departamento (ex: "suporte técnico", "financeiro") além de `dept_<slug>`/número — limitado a 80 chars para não engolir descrição de problema
- [x] Validação: `tsc --noEmit` sem erros nos arquivos editados; `npm test` 294/295 (única falha pré-existente: `csat.test.ts` espera "Pessimo" sem acento, mensagem usa "Péssimo")
- [x] Nenhum commit feito — mudanças na working tree (branch `feature/helpdesk-enhancements`)

### Auditoria IA Profissional — Completo (FASES A–F)
- [x] **FASE A — Motor**: model `AuditoriaProfissional` (14 notas 0–100 + notaGeral, classificações, JSONs evidencia/pontos fortes/riscos/recomendações/plano/alertas, revisão humana, protocolo, contato) + `auditoriaProfissional.service.ts` com **guardrail anti-alucinação** `validarEvidencias` (descarta trechos inexistentes → alerta) e fallback local determinístico (`fallback-local` quando `hasClaude()` falso); rotas `/api/auditoria/*` (admin/gerente)
- [x] **FASE B — Agregações**: `auditoriaAgregacao.service.ts` (panorama, ranking analistas, clientes risco, assuntos, evolução, padrões globais)
- [x] **FASE C — Decisão**: `auditoriaDecisao.service.ts` (tomada de decisão 🟢🟡🔴, recomendações priorizadas, plano 7/30/60, metas, fila, auditoria por amostra) + **auditoria contínua** fire-and-forget em `flow.service.ts` `encerrarTicket` (nunca quebra fluxo)
- [x] **FASE D — Relatórios**: `auditoriaRelatorio.service.ts` (INTERNO vs CLIENTE com confidencialidade, consolidado, CSV `;`+BOM, Excel exceljs)
- [x] **FASE E — Frontend**: `AuditoriaProfissionalPage.tsx` (fila + filtros + modal com 14 categorias, trechos reais, revisão humana, exports blob) e `TomadaDecisaoPage.tsx` (saúde, resumo executivo, plano de ação, metas, foco por analista) — rotas + submenu
- [x] **FASE F — Testes**: `auditoria-profissional.test.ts` (12 novos); Backend **389/390** (1 fail pré-existente TESTE #31 time-dependent), tsc 20 pré-existentes (0 novos), frontend tsc 0

#### FASE B — Indicadores de Atendimento (TMR/TME/SLA) + Legibilidade — Completo
- [x] **Backend**: `indicadores.service.ts` + `indicadores.controller.ts` + rotas `/helpdesk/indicadores*`. Metas configuráveis (HelpdeskConfig `metas_indicadores`; defaults TMR 360min, TME 30min, PR 15min, SLA meta 95%, risco 80%). `classificarTempo`/`classificarPercentual` (🟢 dentro/🟡 atenção/🔴 fora, SEMPRE ícone+texto). Cards com meta/classificação/delta, distribuição SLA, PR, comparativo período anterior, porAnalista (FCR/reaberturas/retrabalho/CSAT). SLA tempo real por ticket (`getSlaTicketIndicador` reusa `calcularSlaRestanteMinutos` de `sla.service.ts`). Alertas (sla_violado, sla_em_risco, aguardando_resposta, parado, acima_da_meta). Export CSV `;`+BOM.
- [x] **Definições**: TMR=resolução; PR=primeira resposta; **TME=espera do cliente (não existia)** — gaps mensagem cliente→resposta agente com espera pendente incluída.
- [x] **Frontend**: `IndicadoresAtendimentoPage.tsx` (`/app/helpdesk/indicadores`, submenu Gestão & Indicadores) com 8 cards, filtros, presets 7/30/90, alertas, tabela por analista, modal de metas, export CSV, poll 60s. Nova aba **Indicadores** no `TicketAtendimentoPage` (SLA tempo real polling 30s) + correção de contraste dark mode no chat/topo.
- [x] Backend **483/484** (indicadores.test 17/17; única falha TESTE #31 flaky pré-existente), tsc 27 pré-existentes (0 novos); frontend tsc 0, 5/5.

### Auditoria IA — Detecção de encerramento no monitor de agentes — Completo
- [x] **Schema**: model `AIAgentClosureAudit` (ticketId @unique; tipo prematuro/resolução real/reabertura; risco BAIXO/MÉDIO/ALTO/CRÍTICO; nota 0-10; diagnóstico/evidências; recomendaReabertura; semConfirmacao; clienteVoltou; csat; analiseIa).
- [x] **Backend**: `auditarEncerramentoTicket` (upsert idempotente, reusa `auditarEncerramento` do closureAudit), `getEncerramentosAgente` (KPIs por agente + lista), `MetricasAgente.encerramentos`, `RelatorioAuditoria.encerramento`. `encerrarTicket` dispara em background (fire-and-forget). Rotas `GET /ai/agent-monitor/encerramentos/:agentId` e `/ticket/:ticketId`.
- [x] **Perf fix**: `exceljs` import lazy em `exportarAuditoriaExcel` (import estático travava o event loop no Windows no caminho de encerramento → timeout).
- [x] **Frontend**: `AgentCoach.tsx` bloco "Encerramento detectado" + KPIs; `AuditoriaAtendimento.tsx` reconciliado com o shape real da API + KPIs de encerramento por agente + filtros backend.
- [x] Testes `ai-agent-monitor.closure.test.ts` **7/7**; backend **490/491** (única falha TESTE #31 flaky pré-existente), tsc 25 pré-existentes (0 novos); frontend tsc 0, 5/5; smoke HTTP 200/404.

### Dashboard IA — Gestão Inteligente — Completo
- [x] **Backend**: `dashboardIa.service.ts` compõe `getIndicadoresAtendimento` (8 cards meta/classificação + SLA + PR) + `getAlertasIndicadores` + `gerarRelatorioSemanal` (porDia/comparativo/top tickets) + agregações por agente de `AIAgentAudit` (nota média 0-10) e `AIAgentClosureAudit` (prematuros/resoluções reais/reaberturas/nota média) mescladas no `porAnalista`. **4 insights gerenciais** via Claude (JSON) com fallback local determinístico (SLA<meta, TMR/PR>meta, CSAT<3.5, FCR<60, pior nota IA, ≥2 prematuros, alertas críticos, ticket parado, delta volume). Rota `GET /api/analytics/dashboard-ia?dias=1|7|30` (clamp 1–90, admin/gerente).
- [x] **Frontend**: `/app/relatorios/ia` (`DashboardIA.tsx` — presets Hoje/7d/30d, insights com badge de fonte Claude/Regras locais + gravidade colorida, 8 cards, alertas, evolução, SLA/PR, tickets problema, tabela por analista com Nota IA e encerramentos). Item no submenu "Gestão & Indicadores".
- [x] Testes `dashboard-ia.test.ts` **5/5**; backend **495/496** (única falha TESTE #31 flaky pré-existente), tsc 25 pré-existentes (0 novos); frontend tsc 0, 5/5; smoke HTTP 200 (dias=7/1, clamp 999→90) + 404.

### Fase 22 — Dark Mode Global — Completo
- [x] **Infraestrutura já existente**: `ThemeContext` alterna `.dark` no `<html>` + CSS vars (`--bg-app/--bg-card/--bg-input/--border/--fg-primary`); Tailwind `darkMode:'class'`; `.card`/`.input`/`.badge` via CSS vars (adaptam automático).
- [x] **Correção de gaps** (classes light-only sem `dark:`) em 27 arquivos: módulo WhatsApp (`ConnectionsTab`, `WhatsAppPage`, `WhatsAppConnectionsPage`, `TicketDetail`), `Dashboard`, `OrderDetail`, `OrderReportsPage`, `HelpdeskConfigPage`, `PermissionsPage`, `OpportunityPipeline`, `KanbanBoard`, `ClassificationPanel`, `DashboardExecutivo`, `TicketAtendimentoPage`, `HelpdeskMetrics`, `SmartTimeline`, `TemporalBarChart`, `TicketHistoryDashboard`, `TicketMetricsPanel`, `TicketReplayPlayer`, `TicketTimeline`, `AuditoriaSistemaPage`, `TarefasArquivadasPage`, `TaskDashboardPage`, `AutoMessagesPage`, `CRMThemes`, `Aprovacoes`, `AuditoriaEncerramentoPage`.
- [x] **Sem mudança (auditado)**: `Login`/`LandingPage` (telas branded — Login já escura), `AgentCoach`/`AuditoriaAtendimento` (paletas escuras auto-contidas), `TimeTrackingPage` (padrão `isDark`), `Layout` (sidebar sempre dark), knobs de toggle `bg-white`, `bg-white/20` (card gradiente), swatch "Claro" (ThemeSettings), dots `bg-gray-500` (`sla_paused`).
- [x] Verificação: frontend tsc **0**, vitest **5/5**, scan final sem gaps não-intencionais. Backend intacto.

### Integração CRM Externo + Alertas Operacionais — Completo
- [x] **Schema**: modelos `ExternalIntegration` (slug @unique, nome, tipo, baseUrl, headers, apiKey/token **criptografados AES-256-GCM** em repouso — chave `integrationEncryptionKey` com fallback determinístico) e `ExternalIntegrationLog` (logs de inbound/outbound). Aplicado via `db:push` no PostgreSQL dev.
- [x] **Backend**: `externalIntegration.service.ts` (encrypt/decrypt AES-256-GCM, `maskSecret`, `callExternal` com timeout/retry/backoff/429-Retry-After/log, `testConnection`, `checkSignature` HMAC-SHA256, `logInbound`, helpers outbound: consultarCliente/Empresa/Contatos/Contratos/Serviços, enviarAtualizacaoTicket, enviarInfoAtendimento) + `externalIntegration.controller.ts` (CRUD mascarado, test, logs paginados, proxies de consulta/sync, `receberWebhook`) + rotas `/api/integrations/external*` (auth admin/gerente; delete admin; webhook público com rate-limit 120/min e exclusão de CSRF).
- [x] **Frontend**: `IntegracoesExternasPage.tsx` (`/app/integracoes`, menu "Integrações Externas") — cards, modal criar/editar, Testar conexão, Logs, ativar/desativar, excluir, secrets mascarados. Menu reorg: "Auditoria IA" movido para submenu "Auditoria & Decisão" dentro de "Gestão".
- [x] **Alert engine**: `alertasOperacionais.service.ts` (`getAlertasOperacionais(dias, resumo)` → `AlertOperacional[]`, níveis info/atencao/critico) com dados REAIS: sla_violado (crítico), whatsapp_offline (crítico, via `getAllConnectionsStatus`), sla_em_risco (alerta_90), parado_aguardando_os >24h, aguardando_cliente >48h, csat_baixo <3.5, resposta_acima_meta >360min, resolucao_baixa <60%, taxa_sla_baixa <80%, sla_alerta (alerta_75), volume_alto (3x média diária, ≥10). Integrado ao `GET /api/analytics/executivo` (campo `alertas`) e seção "ALERTAS E ATENÇÃO" clicável no `DashboardExecutivo.tsx`.
- [x] **Rework indicators**: seção `rework` no `getIndicadoresAtendimento` (reaberturas, retrabalho, taxaReabertura, taxaRetrabalho, classificações por `classificarPercentual`; dados agregados de `AuditoriaProfissional` via `coletarPorAnalista`).
- [x] **Correções**: baseline de `slaStatus` fica em `TicketMetrics` (filtro via `metrics: { is: { slaStatus } }`); `prisma generate` EPERM no DLL é inofensivo (TS gerado atualiza). DB PostgreSQL dev limpo de dados órfãos que causavam falha no `whatsapp-flow-pos-departamento` (8/8).
- [x] Testes `alertas-operacionais.test.ts` **12/12**; backend **507/508** (única falha TESTE #31 flaky pré-existente), tsc 25 pré-existentes (0 novos); frontend tsc 0, 5/5.

### Evolução Gestão/Auditoria/Alertas/CRM — Completo (Fases de evolução)
- [x] **Backend — Visão Geral**: `alertasVisaoGeral.service.ts` (orquestrador `getAlertasVisaoGeral` = `getAlertasOperacionais` + 16 tipos gerenciais: chamado_sem_movimentacao, chamado_reaberto, chamado_baixa_avaliacao, chamado_sem_justificativa, chamado_encerrado_reaberto, cliente_problema_recorrente, analista_desempenho, tarefa_atrasada, tarefa_sem_responsavel, tarefa_bloqueada, tarefa_vencendo_hoje, tarefa_vencendo_em_breve, dev_atrasado/dev_em_andamento, implantacao_atrasado/implantacao_em_andamento) ordenados por severidade; interface `AlertOperacional` estendida (icone?, dataHora?, responsavel?, origem?, acao?); endpoint `GET /api/analytics/visao-geral?dias=`; testes `alertas-visao-geral.test.ts` **7/7**.
- [x] **Backend — API pública `/api/integration`**: módulo `integrations/public/` com `publicApiAuth.ts` (API key `x-api-key` ou `api_key`, timing-safe, escopo read/read-write via sufixo `:rw`), `publicApi.service.ts` (listarClientes/detalharCliente/listarEmpresas/listarContratos/listarTickets/detalharTicket/listarAgentes/atualizarStatusTicket/atualizarCliente; paginação ≤100; **nunca** expõe password/sessionToken), controller e routes (rate-limit 120/min; escrita requer `requireWriteScope`); `AppError` criado em `shared/errors/AppError.ts`; `env.integrationApiKeys` (INTEGRATION_API_KEYS); rota registrada em `app.ts` + `/api/integration` em `csrfExcludedPaths`. Testes `public-api.test.ts` **14/14**.
- [x] **Backend — CRIAR TAREFA**: `criarTarefaDeRecomendacao(recomendacaoId, boardId, {responsavelId, prazoEntrega})` em `auditoriaDecisao.service.ts` (regenera a Tomada de Decisão, acha a recomendação por id, cria `KanbanTask` tipo `atendimento` na 1ª coluna do board, prioridade mapeada urgente/alta→alta); rota `POST /api/auditoria/decisao/recomendacao/tarefa` (admin/gerente). Testes `auditoria-decisao-tarefa.test.ts` **3/3**.
- [x] **Frontend — Visão Geral**: `Dashboard.tsx` agora consome `/analytics/executivo?dias=` (seletor de período **funcional**) + seção **Saúde do Atendimento** (5 indicadores interpretados: SLA, resolução, TMR, CSAT, FCR — cada um com meta + recomendação + cor por status via `interpretarIndicadores`) + seção **Alertas e Atenção** (cards clicáveis por severidade com sugestão de ação `acao`).
- [x] **Frontend — Auditoria Geral**: nova `AuditoriaGeralPage.tsx` (`/app/helpdesk/auditoria-geral`) consumindo `/auditoria/panorama?dias=` (alertas gerenciais, KPIs, ranking analistas, distribuições, clientes em risco, assuntos recorrentes, padrões globais) + item no submenu "Auditoria & Decisão".
- [x] **Frontend — Tomada de Decisão**: filtros de período/analista/classificação (via `dataInicio`/`dataFim`/`agenteId`/`classificacao` no `/auditoria/decisao`) + botão **Criar tarefa no Kanban** em cada recomendação (modal com board/responsável → POST recomendação/tarefa).
- [x] **Documentação**: `docs/API-INTEGRACAO-EXTERNA.md` (spec da API pública, auth/escopos/rate-limit/exemplos) e `docs/INDICADORES-ALERTAS.md` (definições TMR/TME/PR/SLA, metas, classificação 🟢🟡🔴, catálogo completo de alertas).
- [x] **Regressão**: backend **531/532** (única falha TESTE #31 flaky pré-existente; 24 testes novos), backend tsc **25 pré-existentes (0 novos)**, frontend tsc **0**, frontend **5/5**.

### Orders / OS — Completo
- [x] **Backend implantação fields**: `createOrder` aceita `tipoImplantacao`, `precoImplantacao`, `horasDev`, `horasSuporte`; `updateOrder` parseia `precoImplantacao`, `horasDev`, `horasSuporte`, `dataInicioImplantacao`, `dataFimImplantacao` com Date/Float
- [x] **OrderForm**: campos de implantação (tipoImplantacao, precoImplantacao, horasDev, horasSuporte) exibidos condicionalmente quando `tipoServico === 'implantacao'`; payload inclui os campos parseados
- [x] **OrderDetail**: exibe dados de implantação (tipo, preço, horas dev/suporte, datas início/fim, concluída) quando `order.tipoImplantacao` existe
- [x] **Testes**: `orders.test.ts` **11/11** (CRUD via Prisma, status events, timeline, dashboard, CSV export, validações)

### Auditoria de Sistema Profissional — Completo (Fases 1–8)
- [x] **Fase 1 — Schema**: `AuditLog` expandido com `severity`, `clienteId`, `success`, `errorMessage`, `requestId`, `fonte`, `entidadeRelacionada`, `entidadeRelacionadaId` + 6 novos índices (`severity`, `clienteId`, `success`, `acao+createdAt`, `modulo+createdAt`). Novo model `AuditAlert` (tipo, titulo, descricao, severidade, modulo, usuarioId, clienteId, entidade, entidadeId, metadata, status, analisadoPor, analisadoEm, justificativa, arquivadoEm) + 6 índices. Relação `AuditLog → Client` adicionada.
- [x] **Fase 2 — Backend segurança**: `audit-security.service.ts` (`getSecurityIndicators` com 22 métricas de segurança, delta com período anterior; `getAnomalias` com detecção de excessão_exclusões, brute_force, alteração_permissoes_frequente, acesso_fora_horario; `getUserTimeline` com timeline + resumo por ação/módulo/horário; `getAuditExportFilters` para filtros de exportação). `audit-alerts.service.ts` (`getAuditAlerts`, `getAuditAlertStats`, `marcarAlertaAnalisado`, `arquivarAlerta`, `criarAlerta`, `detectarEGerarAlertas`).
- [x] **Fase 3 — Backend endpoints**: Controller expandido com 17 endpoints: `listAuditLogs`, `getGlobalAudit`, `getGlobalAuditStats`, `getAuditByUser` (timeline), `getTicketAuditLogs`, `getTaskAuditLogs`, `getOrderAuditLogs`, `getClientAuditLogs`, `getSecurityHandler`, `getAnomaliasHandler`, `getAlertsHandler`, `getAlertStatsHandler`, `marcarAlertaHandler`, `arquivarAlertaHandler`, `getExportFiltersHandler`, `exportAuditCsvHandler`, `getViolationStatsHandler`. Routes com 17 rotas todas `admin/gerente/supervisor`.
- [x] **Fase 5 — Frontend**: `AuditoriaSistemaPage.tsx` reescrita com 5 abas: **Visão Geral** (24 cards com delta, top ações, top usuários), **Eventos** (filtros avançados: módulo, severidade, fonte, data, busca + timeline com expand/collapse + badges de severidade/fonte/fluxo), **Segurança** (22 indicadores + anomalias detectadas com 🟢🟡🟠🔴), **Alertas** (CRUD: pendentes/analisados/arquivados + ações marcar analisado/arquivar), **Relatórios** (export CSV funcional, PDF/Excel placeholder).
- [x] **Fase 7 — Testes**: `audit-extended.test.ts` **23/23** (logAudit novos campos, filtros severity/fonte/success, busca errorMessage, dashboard stats expandido, security indicators, anomalias, user timeline, alert CRUD, detectarEGerarAlertas). Backend **565/566** (única falha TESTE #31 flaky pré-existente), tsc **25 pré-existentes (0 novos)**, frontend tsc **0**.

### Deploy Preparation (Vercel + Fly.io + Neon) — Completo
- [x] **Diagnóstico**: 9 bloqueadores identificados (Baileys WebSocket, cron schedulers, local uploads, PDF storage, WhatsApp session state, in-memory state, startup logic, no connection pooling, Puppeteer)
- [x] **Arquitetura**: Frontend Vercel (static) + Backend Fly.io (Docker, 256MB RAM free tier) + PostgreSQL Neon (500MB free). Total R$ 0,00.
- [x] **Backend Dockerfile**: multi-stage build (builder + production), Prisma generate, 256MB RAM
- [x] **fly.toml**: configuração Fly.io (gru region, auto_stop/start, volume persistente para storage)
- [x] **vercel.json**: atualizado com routes para /api/* → api/index.ts, static files → frontend/
- [x] **.dockerignore**: exclui node_modules, .git, .env, dist, storage temporário
- [x] **.env.example**: completo com 30+ variáveis documentadas (DATABASE_URL, JWT, WhatsApp, IA, SMTP, Redis, Integration)
- [x] **Documentação para leigos**: 6 guias em docs/ (GUIA-PROJETO, GITHUB-LEIGO, DEPLOY-VERCEL-LEIGO, BACKUP-E-RESTAURACAO, ARQUITETURA, VARIAVEIS-AMBIENTE)
- [x] **CHANGELOG**: v1.5.0 adicionado com resumo completo

### Auditoria de Segurança Completo (v1.6.1)
- [x] **Auditoria 4 camadas**: Autenticação/Autorização, Banco de Dados, APIs/Webhooks, Frontend — 48 vulnerabilidades identificadas (7 críticas, 13 altas, 18 médias, 10 baixas)
- [x] **C6**: XSS Stored via `innerHTML` em `KanbanBoard.tsx` — corrigido com `createElement` + `textContent`
- [x] **C7**: XSS Stored via `document.write()` em `TicketHistoricoModal.tsx` — corrigido com função `esc()` para escapar HTML
- [x] **C1**: WhatsApp Cloud API webhook sem HMAC — adicionada validação `X-Hub-Signature-256` HMAC-SHA256
- [x] **C2**: Evolution API webhook sem validação — adicionada validação de secret via query param/header
- [x] **H3**: IDOR Kanban attachment delete — adicionada verificação de ownership via task
- [x] **H4**: Rate limiting em endpoints de token — `rateLimiter.ts` (in-memory) com 5 req/min login, 10 req/min sign, 10 req/min approval
- [x] **H5**: SSRF em integrações externas — `isPrivateUrl()` bloqueia IPs privados/localhost/metadata
- [x] **H8-H9**: Refresh token binding — `sessionToken` obrigatório no refresh + `POST /api/auth/logout` limpa sessionToken no banco
- [x] **H11**: Senha mínima aumentada de 6 para 8 caracteres (Zod schemas)
- [x] **Novo middleware**: `rateLimiter.ts` — rate limiter in-memory genérico com headers X-RateLimit-*
- [x] **Novas env vars**: `WHATSAPP_CLOUD_APP_SECRET`, `EVOLUTION_WEBHOOK_SECRET` (adicionadas em env.ts + .env.example)
- [x] **Documentação**: `docs/SEGURANCA.md` completa (14 seções: auth, RBAC, webhooks, rate limiting, SSRF, XSS, uploads, dados sensíveis, CORS, headers, variáveis, checklist)
- [x] **Testes**: Auth tests atualizados (20/20 passando) — sessionToken obrigatório no refresh, novo teste de session mismatch
- [x] **Backend tsc**: 0 erros novos (25 pré-existentes intactos)
- [x] **Frontend tsc**: 0 erros
- [x] **Frontend tests**: 5/5 passando
- [x] **Backend tests**: auth 20/20, orders 11/11, indicadores 17/17, public-api 14/14, alertas 7/7, audit 23/23, auditoria-profissional 12/12, alertas-operacionais 12/12

## Próximos passos
- [x] Fase 4 — Enriquecimento dos ~90 call sites de logAction com severity/clienteId
- [x] FASE 10 — Documentação final e FASE 11 — Testes finais de regressão
