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
│   │   │   ├── orders/          # orders.controller.ts
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
│   │   │   └── Settings/        # HelpdeskConfigPage, Departamentos, Filas
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

### Assinatura do Analista — Completo
- [x] Campo `signature` adicionado ao model User (Prisma schema)
- [x] API `updateUsers` aceita e retorna signature
- [x] WhatsApp controller busca signature do usuario e anexa a mensagem
- [x] Frontend: campo de assinatura no formulario de usuarios (UsersPage)
- [x] Formato: `_Nome\Assinatura_` no final da mensagem enviada ao cliente
- [x] Mensagem original salva no DB (sem assinatura)
- [x] Typecheck passando (backend + frontend)

### CSAT Flow — Completo
- [x] Investigação completa do fluxo: conclusão → CSAT → resposta → novo ticket
- [x] **Bug corrigido**: CSAT detectava "1-5" mesmo quando cliente escolhia departamento
- [x] **Máquina de estados**: `IDLE / AWAITING_CSAT / AWAITING_DEPARTMENT` por conversa (TTL 30min)
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

### Próximos passos
- [ ] Ordem de serviço (Orders)
- [ ] Dark mode global (tema escuro para todo o sistema)
- [ ] Auditoria IA: evoluir agente para detectar encerramento prematuro / resolução real / reabertura (base `aiAgentMonitor.service.ts` + `ai-audit.service.ts` existentes)
- [ ] Dashboard IA: cards diário/semanal/por analista e insights gerenciais (reusar `weeklyReport.service.ts`, `metrics.service.ts`, `AuditoriaAtendimento.tsx`)
