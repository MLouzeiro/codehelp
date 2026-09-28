# ARQUITETURA - CodeHelp CRM/Helpdesk

> Documento de referencia tecnica do sistema. Ultima atualizacao: Setembro 2026.

---

## 1. Visao Geral

CodeHelp e uma plataforma de **CRM/Helpdesk** com integracao WhatsApp, Kanban interno, auditoria por IA, analytics, OS (Ordens de Servico) com PDF e assinatura, e app mobile. O sistema e **multi-tenant** (isolamento por `organizationId`) e opera como um bot de atendimento automatizado + painel web para analistas/gestores.

---

## 2. Stack Tecnologica

| Camada | Tecnologia |
|--------|------------|
| **Backend** | Node.js + Express + TypeScript |
| **Frontend Web** | React 18 + Vite + TypeScript + Tailwind CSS |
| **Mobile** | React Native + Expo SDK 51 + Expo Router |
| **Banco de dados** | PostgreSQL (prod Neon) / SQLite (dev) |
| **ORM** | Prisma 5.22 |
| **Auth** | JWT (access 15min + refresh 7d) + bcryptjs |
| **WhatsApp** | Baileys (WebSocket), Evolution API (REST), Cloud API (Meta) |
| **Estado (web)** | React Query + React Context |
| **Estado (mobile)** | Zustand 4.5 |
| **PDF** | PDFKit + pdf-lib |
| **Charts** | Recharts 2.12 |
| **Rich Text** | TipTap 3.27 |
| **Drag and Drop** | @dnd-kit 6.3 |
| **Flow Builder** | ReactFlow 11.11 |
| **Cache** | Redis (ioredis, opcional, fallback in-memory) |
| **Agendamento** | node-cron 3.0 |
| **Search** | Fuse.js 7.4 (fuzzy) |
| **Email** | Nodemailer 6.9 |
| **Browser Automation** | Puppeteer 25.3 |
| **Validacao** | Zod 3.25 |
| **Testes** | Vitest 2.1 (backend + frontend) |

---

## 3. Estrutura de Pastas

```
code-help/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 2442 linhas, ~60 models
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # Prisma client singleton
│   │   │   └── env.ts             # Variaveis de ambiente tipadas
│   │   ├── modules/               # 24 modulos de dominio
│   │   ├── shared/
│   │   │   ├── middleware/        # auth, ticketAccess, rateLimiter, audit, upload
│   │   │   └── utils/helpers.ts
│   │   ├── app.ts                 # Express app (46 route groups)
│   │   └── server.ts             # Entry point
│   └── storage/uploads/
├── frontend/
│   ├── src/
│   │   ├── components/            # ~30 componentes compartilhados
│   │   ├── pages/                 # 80+ paginas, 17 diretorios
│   │   ├── services/              # api.ts, auth.tsx, ThemeContext
│   │   ├── hooks/                 # useKanban, useModal, useSSE
│   │   ├── lib/                   # metricGlossary.ts
│   │   ├── utils/                 # text.ts
│   │   ├── config/                # navigation.ts
│   │   └── types/                 # index.ts (1314 linhas)
│   └── test/
├── mobile/                        # React Native + Expo
│   ├── app/                       # Expo Router (file-based)
│   └── src/                       # services, stores, screens
└── ARQUITETURA.md                 # Este arquivo
```

---

## 4. Backend - Modulos (24)

| Modulo | Path | Responsabilidade |
|--------|------|------------------|
| **auth** | `modules/auth/` | Login JWT, refresh, registro, sessao, RBAC (4 roles) |
| **helpdesk** | `modules/helpdesk/` | Core: tickets, maquinas de estados, triagem IA, SLA, auto-messages, horario comercial |
| **integrations/whatsapp** | `modules/integrations/whatsapp/` | 3 providers WhatsApp, handler canonico, factory |
| **ai** | `modules/ai/` | Triagem IA (Claude API + fallback regex), categorizacao, coach, robot scheduler |
| **crm** | `modules/crm/` | Clientes, contatos, empresas, pipeline de oportunidades |
| **orders** | `modules/orders/` | OS, PDF generation (869 linhas), layouts, timbrado, assinatura |
| **kanban** | `modules/kanban/` | Kanban interno: boards, colunas, tarefas, subtasks, tags, anexos, templates |
| **analytics** | `modules/analytics/` | Dashboards (executivo, IA, gerencial), relatorios semanais, indicadores |
| **billing** | `modules/billing/` | Cobranca mensal por cliente (terminais, hostlinks, interfaces, exames) |
| **alerts** | `modules/alerts/` | Alertas semanais via WhatsApp, verificacao de tickets atrasados |
| **auditoria** | `modules/auditoria/` | Auditoria profissional (14 categorias IA), tomada de decisao, relatorios |
| **csat** | `modules/csat/` | Customer Satisfaction: envio, agendamento, resposta |
| **kb** | `modules/kb/` | Knowledge Base: artigos, categorias, votos |
| **automations** | `modules/automations/` | Regras de automacao: triggers, condicoes, acoes, flow builder |
| **notificacoes** | `modules/notificacoes/` | Notificacoes internas (in-app, push) |
| **permissions** | `modules/permissions/` | RBAC avancado: permissoes por resource/action, override por role |
| **feriados** | `modules/feriados/` | Feriados nacionais/estaduais/municipais (cache 1h) |
| **enquetes** | `modules/enquetes/` | Enquetes interativas via WhatsApp |
| **aprovacoes** | `modules/aprovacoes/` | Aprovacoes via WhatsApp (token publico, sem auth) |
| **teams** | `modules/teams/` | Equipes de trabalho |
| **timetracking** | `modules/timetracking/` | Controle de horas: sessoes, pausas, blocos, billable |
| **users** | `modules/users/` | Gestao de usuarios CRUD |
| **search** | `modules/search/` | Busca global (Fuse.js fuzzy) |
| **audit** | `modules/audit/` | Auditoria de sistema: logs, alertas, seguranca, anomalias, export |

---

## 5. Maquina de Estados do Bot (WhatsApp)

### 5.1 Fluxo Geral

```
Mensagem WhatsApp
  -> processIncomingMessageHandler()
    -> Dedup (by phone + content hash)
    -> Lock de conversa (in-memory, 10s TTL)
    -> Verificar aprovacao pendente
    -> Verificar horario comercial
    -> Verificar feriado
    -> Buscar/criar ticket ativo
    -> [Fluxo do bot conforme estado do ticket]
```

### 5.2 Etapas do Ticket (constants.ts)

| Etapa | Descricao |
|-------|-----------|
| `fila` | Na fila de atendimento |
| `triagem` | Em triagem (menu/IA) |
| `em_atendimento` | Atendido por agente |
| `aguardando_cliente` | Aguardando resposta do cliente |
| `aguardando_os` | Aguardando OS |
| `concluido` | Encerrado |
| `descartado` | Descartado |

### 5.3 Estados de Avaliacao (evaluationStatus)

| Estado | Descricao |
|--------|-----------|
| `null` | Sem avaliacao pendente |
| `aguardando_confirmacao` | Bot perguntou "Seu problema foi resolvido?" |
| `aguardando_descricao` | Cliente disse NAO, bot pediu descricao |
| `aguardando` | Avaliacao CSAT enviada, aguardando resposta |
| `respondida` | Avaliacao respondida |

### 5.4 Fluxo Deterministico Pos-Departamento (botFluxo)

| Estado | Descricao |
|--------|-----------|
| `null` | Sem fluxo ativo |
| `awaiting_company` | Aguardando nome da empresa (sem Client vinculado) |
| `awaiting_description` | Aguardando descricao do problema |

### 5.5 Fluxo Completo

```
[1] Mensagem chega
  -> Dedup + Lock
  -> Verificar se e aprovacao pendente (intercepta e retorna)
  -> Verificar horario comercial (se fechado, envia mensagem e retorna)
  -> Verificar se e feriado (se feriado, envia mensagem e retorna)

[2] Buscar ticket ativo
  -> Se nao existe, criar ticket com etapa 'triagem'
  -> Se existe e esta em etapa encerrada, criar novo ticket

[3] Se etapa = 'concluido' e evaluationStatus = null
  -> Iniciar confirmacao de resolucao (flow.service.ts)

[4] Se evaluationStatus = 'aguardando_confirmacao'
  -> processarRespostaEncerramento()
  -> SIM -> encerrar + CSAT
  -> NAO -> pedir descricao -> encerrar sem resolucao

[5] Se evaluationStatus = 'aguardando_descricao'
  -> finalizarSemResolucao()

[6] Se etapa = 'aguardando_expediente'
  -> Enviar mensagem de fora de horario (1a vez apenas)

[7] Se needsMenu (triagem/boas_vindas/fila sem protocolo e sem dept)
  -> Enviar menu de departamentos

[8] Se AWAITING_DEPARTMENT + opcao valida
  -> Resolver departamento
  -> Se tem Client vinculado -> botFluxo = 'awaiting_description'
  -> Se nao tem Client -> botFluxo = 'awaiting_company'

[9] Classificacao por palavras-chave (se sem categoria)

[10] Se etapa = 'fila' + departamento + sem protocolo + tem texto
  -> Se botFluxo = 'awaiting_company' -> processarNomeEmpresaBot()
  -> Se botFluxo = 'awaiting_description' -> processarDescricaoBot()

[11] IA de triagem (se aplicavel)
  -> Classificar prioridade, assunto, sugestao
  -> Gerar protocolo
  -> Mover para 'em_atendimento'

[12] Se em_atendimento e tem assignee
  -> Notificar agente
```

---

## 6. WhatsApp - Integracao Multi-Provider

### 6.1 Providers

| Provider | Transporte | Status |
|----------|------------|--------|
| **Baileys** | WebSocket | Primario (padrao) |
| **Evolution API** | REST API | Opcional (self-hosted Docker) |
| **Cloud API** | REST API | Opcional (Meta, free tier 1000 conversas/mes) |

### 6.2 Handler Compartilhado

`whatsapp-message-handler.ts` (1057 linhas) e o **canonical** - toda a logica de bot/triagem/fluxo vive aqui. Os providers sao wrappers que convertem formatos e chamam `processIncomingMessageHandler()`.

### 6.3 Filtros Anti-Lixo (NUNCA remover)

- `fromMe` - ignora mensagens enviadas pelo proprio sistema
- `status_update` - ignora atualizacoes de status
- `@g.us` - ignora mensagens de grupo
- `status@broadcast` - ignora status broadcasts

### 6.4 Dedup e Lock

- **Dedup**: hash `phone + content + timestamp` (janela 5s)
- **Lock**: in-memory `Map<phone, lock>` com TTL 10s

### 6.5 Horario Comercial

Configuravel em `HelpdeskConfig.horarioExpediente`:
- **Padrao**: Seg-Sex 07:00-18:00, Sab 07:00-12:00
- **Feriados**: tabela `Feriado` (cache 1h in-memory)
- **Fora de horario**: bot envia mensagem (1a vez apenas)

---

## 7. OS (Ordens de Servico) e PDF

### 7.1 Geracao de PDF (`pdf.service.ts`, 869 linhas)

Duas rotas:
1. **`buildPdfWithLayout()`** - Layout personalizado (cores, cabecalho, rodape, secoes)
2. **`buildPdfWithTimbrado()`** - PDF importado (pdf-lib merge) com timbrado

### 7.2 Timbrado

- Upload de imagem PNG/JPG via `OSLayoutsPage`
- Embedding automatico no PDF (overlay no topo de cada pagina)
- Deteccao automatica de header/footer via operadores PDF
- Margens reservadas configuraveis

### 7.3 Assinatura

- Link publico `/assinar/:token` (sem auth)
- Canvas de assinatura com pressao (`SignatureCanvas.tsx`)
- Validacao de CPF
- Salvamento no banco + merge no PDF

### 7.4 Numero OS (numeroOs) - Geracao Atomica

- Tabela `OrderSequence` com `year @unique` + `lastNum`
- Transacao Prisma `INSERT ON CONFLICT DO NOTHING` + `UPDATE RETURNING`
- Formato: `{ano}/{numero sequencial}` (ex: `2026/001`)

---

## 8. Autenticacao e RBAC

### 8.1 JWT

| Token | Duracao | Armazenamento |
|-------|---------|---------------|
| Access Token | 15 min | Cookie `accessToken` |
| Refresh Token | 7 dias | Cookie `refreshToken` |
| Session Token | - | Cookie `sessionToken` + DB |

### 8.2 Roles (Hierarquia)

| Role | Nivel | Permissoes |
|------|-------|------------|
| `solicitante` | 1 | Ver apenas proprios tickets |
| `agente` | 2 | Ver/editar tickets atribuidos, Kanban |
| `supervisor` | 3 | Ver/editar todos tickets do departamento, dashboard, auditoria |
| `admin` | 4 | Tudo + gestao de usuarios, configuracoes, permissoes |

### 8.3 Middleware

| Middleware | Arquivo | Uso |
|------------|---------|-----|
| `authenticate` | `auth.ts` | Verifica JWT, busca user, valida sessionToken |
| `authorize(...roles)` | `auth.ts` | Checa role exata |
| `requireRole(...roles)` | `auth.ts` | Checa role hierarquica |
| `requireTicketAccess(action)` | `ticketAccess.ts` | RBAC granular por ticket |
| `rateLimiter(opts)` | `rateLimiter.ts` | Rate limiting in-memory |
| `auditLog(acao, entidade)` | `audit.ts` | Log de auditoria automatico |
| `uploadMiddleware` | `upload.ts` | Multer com whitelist de tipos |

### 8.4 Ticket-Level RBAC

| Acao | admin | supervisor | agente | solicitante |
|------|-------|------------|--------|-------------|
| Ver ticket | sempre | sempre | se atribuido ou dept match | apenas proprios |
| Editar ticket | sempre | se dept match | apenas se atribuido | nunca |
| Atribuir ticket | sempre | se dept match | pode assumir | nunca |

---

## 9. Agendamento (Schedulers)

| Scheduler | Modulo | Frequencia | O que faz |
|-----------|--------|------------|-----------|
| `startScheduler()` | alerts | Semanal + 10min | Relatorio semanal WhatsApp + verificar atrasados |
| `startSlaScheduler()` | helpdesk/sla | Periodico | Monitorar SLA dos tickets |
| `startResponseTimer()` | helpdesk | Periodico | Timer de primeira resposta |
| `startCsatScheduler()` | csat | Periodico | Enviar CSAT para tickets encerrados |
| `startBillingScheduler()` | billing | Mensal | Calcular cobrancas pendentes |
| `startTaskAlertScheduler()` | kanban | Periodico | Alertas de prazo de tarefas |
| `startRobotScheduler()` | ai | Configuravel | Executar regras de chatbot |

Horario do relatorio semanal configuravel via env: `ALERT_DAY` (0-6), `ALERT_HOUR` (0-23), `TIMEZONE`.

---

## 10. Frontend

### 10.1 Estrutura

- **82 rotas** definidas em `App.tsx`
- **Lazy loading** com `React.lazy` + `Suspense`
- **Layout**: Sidebar vertical/horizontal/colapsavel + Header + Outlet
- **Dark mode**: CSS vars + `.dark` class no `<html>`
- **Temas**: 5 esquemas de cor, 3 modos de fundo, 3 escalas de fonte

### 10.2 Paginas Principais

| Pagina | Arquivo | Descricao |
|--------|---------|-----------|
| Dashboard | `Dashboard.tsx` | KPIs, graficos, saude do atendimento, alertas |
| Helpdesk Kanban | `HelpdeskKanban.tsx` | 6 etapas, drag-and-drop, som |
| Atendimento | `TicketAtendimentoPage.tsx` | Workspace completo: chat, sidebar, checklist, IA |
| WhatsApp | `WhatsAppPage.tsx` | Chat multi-conexao, QR code, conversas |
| Clientes | `ClientList.tsx` | Lista com busca, paginacao, filtros |
| OS | `OrderForm.tsx` | Criar/editar OS com campos de implantacao |
| Auditoria IA | `AuditoriaProfissionalPage.tsx` | Fila de auditoria, 14 categorias |
| Dashboard IA | `DashboardIA.tsx` | Insights, metricas por analista |
| Configuracoes | `SettingsPage.tsx` | Hub de 17 configuracoes |

### 10.3 Hooks Customizados

| Hook | Arquivo | Uso |
|------|---------|-----|
| `useKanban` | `hooks/useKanban.ts` | CRUD completo do Kanban (45+ metodos) |
| `useModal` | `hooks/useModal.ts` | Modais baseados em Promise |
| `useSSE` | `hooks/useSSE.ts` | Server-Sent Events (real-time) |
| `useCan` | `services/useCan.ts` | RBAC no frontend |
| `useAuth` | `services/auth.tsx` | Autenticacao + refresh automatico |

### 10.4 Navegacao

`config/navigation.ts` define 8 grupos: Visao Geral, Atendimento, Gestao, Relatorios, Clientes, Operacao, Integracoes, Administracao.

---

## 11. Banco de Dados (Prisma)

### 11.1 Contagem

- **~60 models** definidos em `schema.prisma` (2442 linhas)
- **Multi-tenant**: `organizationId` em modelos chave

### 11.2 Models Principais

| Model | Descricao |
|-------|-----------|
| `Organization` | Tenant raiz |
| `User` | Usuarios (4 roles, departamentos, assinatura) |
| `Client` | Clientes (telefone, CNPJ, razao social) |
| `Ticket` | Core: status, etapa, prioridade, departamento, assignee, SLA, CSAT, botFluxo |
| `Message` | Mensagens do ticket (fromMe, source, tipo) |
| `Departamento` | Departamentos de atendimento |
| `Fila` | Filas por departamento |
| `Categoria` / `Assunto` / `NivelSuporte` | Classificacao hierarquica |
| `ServiceOrder` | OS (numeroOs @unique, layoutId, assinatura) |
| `OSLayout` | Layouts de PDF (personalizado ou importado) |
| `KanbanBoard` / `KanbanColumn` / `KanbanTask` | Kanban interno |
| `AuditLog` | Auditoria de sistema |
| `AuditAlert` | Alertas de auditoria |
| `AuditoriaProfissional` | Auditoria IA (14 categorias) |
| `DecisionAudit` | Tomada de decisao estruturada |
| `CSATResposta` | Respostas de avaliacao |
| `TicketMetrics` | Metricas consolidadas (15 tempos, SLA, CSAT) |
| `TicketTimeline` | Timeline horizontal com deltas |
| `TicketEvent` | Eventos atomicos (audit trail) |
| `TicketAiLog` | Log de processamento de IA |
| `TicketPerformance` | Performance consolidada por agente |
| `AIAgentAudit` | Auditoria por agente IA |
| `AIAgentClosureAudit` | Auditoria de encerramento |
| `ClientBilling` / `BillingHistory` / `BillingPendency` | Cobranca |
| `Feriado` | Feriados (cache 1h) |
| `RolePermission` | RBAC override por role |
| `ExternalIntegration` / `ExternalIntegrationLog` | Integracoes externas |
| `OrderSequence` | Sequencia atomica de OS |
| `AutomationRule` | Regras de automacao |
| `KBEntry` | Knowledge Base |
| `Notificacao` | Notificacoes internas |
| `TimeEntry` / `TimeEntryBlock` | Controle de horas |
| `KanbanStageTime` / `TaskAlert` | Tempo por coluna e alertas |
| `ChecklistTemplate` / `TicketChecklist` | Checklists |
| `TicketDepartmentTime` | Tempo por departamento |
| `TicketAgentInteraction` | Interacoes de agente (FCR) |
| `ContatoIgnorado` | Contatos excluidos do fluxo automatico |
| `Aprovacao` | Aprovacoes via WhatsApp |

---

## 12. Variaveis de Ambiente

### 12.1 Core

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| `PORT` | `3010` | Porta do backend |
| `NODE_ENV` | `development` | Modo |
| `DATABASE_URL` | (obrigatorio) | URL PostgreSQL |
| `DIRECT_URL` | (opcional) | URL direta Neon (sem pooler) |
| `REDIS_URL` | `redis://localhost:6379` | Redis (opcional) |
| `APP_URL` | `http://localhost:3000` | Frontend URL |
| `API_URL` | `http://localhost:3010` | Backend URL |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Origins permitidas |
| `TIMEZONE` | `America/Fortaleza` | Fuso horario |

### 12.2 Seguranca

| Variavel | Descricao |
|----------|-----------|
| `JWT_SECRET` | Segredo access token |
| `JWT_REFRESH_SECRET` | Segredo refresh token |
| `INTEGRATION_ENCRYPTION_KEY` | Chave AES-256-GCM |
| `INTEGRATION_API_KEYS` | API keys publicas (`:rw` = write) |

### 12.3 WhatsApp

| Variavel | Descricao |
|----------|-----------|
| `WHATSAPP_SESSION_PATH` | Caminho de sessao Baileys |
| `WHATSAPP_CHROME_PATH` | Chrome path (whatsapp-web.js) |
| `EVOLUTION_API_URL` | URL Evolution API |
| `EVOLUTION_API_KEY` | Chave Evolution API |
| `EVOLUTION_WEBHOOK_SECRET` | Secret webhook Evolution |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | Phone number ID Meta Cloud |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Access token Meta Cloud |
| `WHATSAPP_CLOUD_APP_SECRET` | App secret (HMAC webhook) |
| `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN` | Verify token Meta Cloud |

### 12.4 IA

| Variavel | Descricao |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Chave Claude API (fallback local se ausente) |

### 12.5 Alertas

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| `ALERT_WHATSAPP_NUMBERS` | (vazio) | Numeros para alertas |
| `ALERT_DAY` | `1` | Dia do relatorio semanal |
| `ALERT_HOUR` | `8` | Hora do relatorio semanal |

---

## 13. Startup do Backend

```
start()
  |-- connectToDatabaseWithRetry()  [NON-BLOCKING, background]
  |     - Ate 10 tentativas, 3s delay cada
  |
  |-- app.listen(port)  [IMMEDIATE]
  |     - HTTP server inicia antes do DB
  |
  |-- Graceful shutdown (SIGTERM, SIGINT)
  |     - Fecha HTTP server
  |     - Desconecta WhatsApp providers
  |     - Force exit apos 5s
  |
  |-- [WAIT ate 40s para DB] then runBackgroundInit()
        |
        +--- Seed/migration em paralelo:
        |     - ensureHelpdeskConfigs()
        |     - migrateLegacyTickets()
        |     - migrarStatusETickets()
        |
        +--- Iniciar 7 schedulers
        +--- WhatsApp auto-reconnect
```

---

## 14. Pontos de Atencao

### 14.1 Flows Criticos

- **Handler canônico** (`whatsapp-message-handler.ts`): mudancas afetam todos os providers
- **Handler legado** (`whatsapp.service.ts`): independente, nao afeta o shared handler
- **NUNCA remover filtros** de `fromMe`, `status_update`, `@g.us`, `status@broadcast`
- **Session token**: NUNCA rotacionar no refresh (causa logout em cascade)
- **NUNCA usar `deleteMany`** em dados de producao - usar `update` com `active: false`

### 14.2 numeroOs

Geracao atomica via `OrderSequence` + `$transaction`. Formato: `{ano}/{seq}`. Unicidade garantida por `@@unique([year])` + `INSERT ON CONFLICT DO NOTHING`.

### 14.3 PDF/Timbrado

- `buildPdfWithLayout()`: layout personalizado
- `buildPdfWithTimbrado()`: merge com PDF de timbrado
- Margens detectadas via operadores PDF (`re`, `rg`)
- Max 40% da pagina reservado para header/footer

### 14.4 Seguranca

- Webhooks: validar assinatura HMAC (Cloud: `X-Hub-Signature-256`, Evolution: query/header secret)
- Rate limiting em endpoints publicos (login, sign, approval)
- Bloquear IPs privados em `callExternal()` (SSRF protection)
- Senha minima 8 caracteres (Zod validation)
- NUNCA expor `password` ou `sessionToken` em respostas API

### 14.5 Testes

- Backend: 53 arquivos de teste, ~500+ testes (Vitest)
- Frontend: 4 arquivos de teste (Vitest + React Testing Library)
- Mobile: Jest
- Localizacao: `__tests__/api/` (integracao), `__tests__/lib/` (unitarios)
