# CHECKPOINT COMPLETO DO PROJETO — CodeHelp CRM/Helpdesk

> Data do checkpoint: 02/09/2026
> Estado: PRODUÇÃO

---

## 1. IDENTIFICAÇÃO DO PROJETO

- **Nome**: CodeHelp (anteriormente Codemed Hub)
- **Objetivo**: Sistema de CRM/Helpdesk com integração WhatsApp, kanban, CRM, analytics e app mobile
- **Data de início**: 2026-06-05 (primeiro commit `26a1356`)
- **Estado atual**: Em produção, com múltiplos módulos funcionando
- **Branch principal**: `feature/helpdesk-enhancements`
- **Total de commits**: ~117+

---

## 2. STACK TECNOLÓGICO

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| **Runtime** | Node.js | >= 20.0.0 |
| **Backend** | Express + TypeScript | 4.21 / 5.6 |
| **Frontend** | React + Vite + Tailwind CSS | 18.3 / 5.4 / 3.4 |
| **Mobile** | React Native + Expo SDK 51 | Expo Router |
| **Banco de dados** | PostgreSQL (Neon em prod) | Prisma 5.22 |
| **ORM** | Prisma | 5.22.0 |
| **Auth** | JWT (access 15min + refresh 7d) + bcryptjs | 10 rounds |
| **WhatsApp** | Baileys (primário) / Evolution API / Cloud API | Baileys 6.7 |
| **Estado Frontend** | React Query / useState | - |
| **Estado Mobile** | Zustand | - |
| **Testes** | Vitest | 2.1 |
| **Ícones** | Lucide React | 0.447 |
| **Gráficos** | Recharts | 2.12 |
| **Editor Rich Text** | TipTap | 3.27 |
| **Drag & Drop** | @dnd-kit | 6.3 |
| **IA** | Claude API (Anthropic) | - |
| **PDF** | pdfkit | 0.15 |
| **Excel** | exceljs | 4.4 |
| **Email** | nodemailer | 6.9 |
| **Cache** | Redis (ioredis) | 5.4 |
| **Segurança** | helmet, csurf, cookie-parser | 8.3 / 1.11 / 1.4 |
| **Rate Limiting** | express-rate-limit + in-memory custom | 7.4 |

---

## 3. AMBIENTES

### Ambiente Local
- Backend: `http://localhost:3010` (tsx watch)
- Frontend: `http://localhost:5173` (Vite dev)
- Banco: PostgreSQL (local ou Neon via DIRECT_URL)
- Redis: `redis://localhost:6379`

### Ambiente de Produção
- **Frontend**: Vercel (static build)
- **Backend**: Fly.io (Docker, regiao gru)
- **Banco**: Neon PostgreSQL (500MB free tier)
- **Total estimado**: R$ 0,00 (free tiers)

### Deploy
- `fly.toml` configurado para Fly.io
- `vercel.json` configurado para Vercel
- `Dockerfile` multi-stage (builder + production)
- `docker-compose.yml` para dev local

---

## 4. ESTRUTURA DE PASTAS

```
code-help/
├── backend/                    # API Express + TypeScript
│   ├── prisma/
│   │   ├── schema.prisma       # 90 models, 2283 linhas
│   │   ├── seed.ts             # Dados iniciais
│   │   └── migrations/         # NÃO existe (usa db push)
│   ├── src/
│   │   ├── config/             # database.ts, env.ts, redis.ts
│   │   ├── modules/            # 24 módulos de negócio
│   │   ├── shared/             # middleware, utils, validation, errors
│   │   ├── __tests__/          # 50 arquivos de teste
│   │   ├── types/              # prisma-augment.d.ts
│   │   ├── app.ts              # Express app (45 rotas)
│   │   └── server.ts           # Entry point (141 linhas)
│   └── package.json
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/              # 88 páginas (.tsx)
│   │   ├── components/         # 28 componentes (.tsx)
│   │   ├── services/           # api.ts, auth.tsx, ThemeContext.tsx
│   │   ├── hooks/              # useKanban.ts, useModal.ts
│   │   ├── types/              # index.ts, kanban.ts
│   │   ├── config/             # navigation.ts
│   │   ├── lib/                # metricGlossary.ts
│   │   ├── utils/              # text.ts
│   │   └── App.tsx             # 74 rotas
│   └── package.json
├── mobile/                     # React Native + Expo
│   ├── app/                    # Expo Router (file-based)
│   └── src/                    # services, stores, screens
├── docs/                       # 41 arquivos de documentação
├── scripts/                    # Scripts auxiliares
├── AGENTS.md                   # Regras para AI agents
├── CHANGELOG.md                # Histórico de versões
├── SPEC.md                     # Especificação do sistema
├── PLAN.md                     # Plano de desenvolvimento
└── README.md                   # Readme principal
```

---

## 5. HISTÓRICO DO DESENVOLVIMENTO

### FASE 1 — Fundação (2026-06-05)
- WhatsApp funcional com triagem automática
- v1.0–v1.3: protocolo, menu numérico, fila de espera

### FASE 2 — Helpdesk Core (2026-06-05)
- Entidades: Fila, SLA, Categoria, Ativo, KB, CSAT
- Cálculo de SLA com scheduler
- RBAC 4 perfis
- AuditLog + KB CRUD
- Dashboard de métricas

### FASE 3 — Módulos Adicionais (2026-06-06–07)
- Base de Conhecimento frontend
- Automações WHEN/IF/THEN
- Board por Status, Notificações
- Colaboradores, Etapas editáveis
- Permissões dinâmicas, Feriados, Dark Mode

### FASE 4 — Multi-departamento (2026-06-09)
- Departamentos e níveis de suporte
- Multi-departamento + ticket access
- Filas CRUD + Multi-WhatsApp connections

### FASE 5 — Features Avançadas (2026-06-16–17)
- Aprovações, Alertas, Dashboard
- Canvas de assinatura mobile
- App React Native + Expo

### FASE 6 — Kanban e Ticket (2026-07-30–31)
- LID handling, contactJid, heartbeat
- Kanban: painel flutuante, checklist, IA auto-categorize

### FASE 7 — CSAT e Auditoria (2026-08-11–14)
- CSAT flow completo (state machine)
- Assinatura personalizada do analista
- Time Tracking, Aprovações via WhatsApp
- Relatório gerencial + Dashboard Executivo
- Auditoria de Encerramento + por Analista

### FASE 8 — Auditoria IA Profissional (2026-08-15–18)
- Motor com 14 categorias 0-100
- Guardrail anti-alucinação
- Tomada de decisão 🟢🟡🔴
- Relatórios interno/cliente
- Arquivamento de usuários

### FASE 9 — Dark Mode + Dashboard IA (2026-08-20)
- Dark Mode global (27 arquivos corrigidos)
- Dashboard IA com insights via Claude
- Indicadores de Atendimento (TMR/TME/SLA)
- Categorias e Assuntos do Helpdesk

### FASE 10 — Qualidade Operacional (2026-08-26)
- Sistema unificado de indicadores de qualidade
- v1.6.0: reaberturas, recorrência, retrabalho, FCR

### FASE 11 — Deploy Prep (2026-08-21)
- Dockerfile para Fly.io
- vercel.json, .env.example
- Documentação para leigos

### FASE 12 — Banco Web (2026-09-01)
- Migração para Neon PostgreSQL
- Backup completo
- Separação ambientes

---

## 6. FUNCIONALIDADES IMPLEMENTADAS

### 6.1 Autenticação e Segurança ✅
- Login/logout com JWT (access + refresh tokens)
- Session token binding (multi-dispositivo)
- RBAC: admin, gerente, tecnico, comercial
- Permissões dinâmicas por role
- Rate limiting (login: 5/min, refresh: 20/min)
- Helmet, CORS, CSRF
- Senha mínima 8 caracteres (bcrypt 12 rounds)
- Middleware `authenticate`, `authorize`, `ticketAccess`

### 6.2 Helpdesk / Chamados ✅
- Abertura via WhatsApp, web, API
- Kanban com 6 etapas fixas (fila → triagem → em_atendimento → aguardando_cliente → aguardando_os → concluido)
- Triagem automática (regex + IA)
- SLA com cálculo em tempo real e pausa
- CSAT (confirmação de resolução → avaliação 1-5)
- Checklist em tickets
- Prazo de entrega com indicador visual
- Horas de desenvolvimento
- Tempo por departamento
- Dashboard com card Taxa FCR
- FCR (First Contact Resolution)
- Tempo médio de resposta/resolução (TMR/TME)
- Primeira resposta (PR)

### 6.3 WhatsApp Multi-Provider ✅
- **Baileys**: Provider primário (WebSocket, sem Chrome/Puppeteer)
- **Evolution API**: Self-hosted Docker, API REST
- **Cloud API**: Meta oficial, free tier 1000 conversas/mês
- Handler compartilhado (whatsapp-message-handler.ts)
- Handler legado (whatsapp.service.ts)
- Multi-conexões (multi-número)
- Contatos ignorados/bloqueados
- Menu numérico interativo
- Textos numerados (compatível com todos providers)
- fluxo de atendimento: empresa → departamento → fila → agente

### 6.4 CRM ✅
- Clientes (CRUD completo)
- Colaboradores por cliente
- Contatos (interações: ligação, email, whatsapp)
- Oportunidades (pipeline Kanban)
- Segmento (laboratório, etc.)
- Contratos e valores
- Temas personalizados

### 6.5 Ordens de Serviço ✅
- CRUD completo com timeline de status
- Geração de PDF
- Assinatura eletrônica (canvas + link público)
- Token único com expiração
- Envio via WhatsApp
- Status: rascunho → enviada → assinada/encerrada
- Campos de implantação (tipo, preço, horas dev/suporte)
- Itens da OS (serviço/material/outros)
- Anexos

### 6.6 Tarefas Internas / Kanban ✅
- Múltiplos boards
- Colunas customizáveis com WIP limit
- Drag & drop (@dnd-kit)
- Tags, prioridade, categoria, classificação
- Responsável (filtro por ativos)
- Prazo de entrega
- Subtarefas
- Checklist
- Timeline de atividades
- Anexos
- IA auto-categorize (prioridade, classificação, categoria)
- Alertas automáticos (prazo, estagnação)
- Arquivamento de tarefas

### 6.7 Dashboard e Analytics ✅
- Dashboard principal com métricas
- Dashboard Executivo (endpoint parametrizável)
- Dashboard IA (insights via Claude)
- Relatório Gerencial (semanal)
- Relatório Analítico
- Indicadores de Atendimento (TMR/TME/SLA/PR)
- Qualidade Operacional (reaberturas, recorrência, retrabalho, FCR)
- Gráficos: Donut, Bar, Area (Recharts)
- Export CSV

### 6.8 Auditoria IA ✅
- **Auditoria Profissional**: 14 categorias 0-100, guardrail anti-alucinação
- **Auditoria de Encerramento**: detecção prematuro/resolução real/reabertura
- **Auditoria por Analista**: ranking, replay de conversa
- **Auditoria Geral**: panorama, ranking, clientes risco, assuntos
- **Tomada de Decisão**: 🟢🟡🔴, recomendações, plano 7/30/60 dias
- **Monitor de Agentes**: KPIs em tempo real
- **Relatórios**: interno vs cliente, CSV, Excel

### 6.9 Sistema de Auditoria ✅
- 17 endpoints de auditoria
- 22 indicadores de segurança
- Detecção de anomalias
- Alertas de auditoria (CRUD)
- Timeline por usuário
- Export CSV
- 5 abas: Visão Geral, Eventos, Segurança, Alertas, Relatórios

### 6.10 Integrações ✅
- WhatsApp (Baileys/Evolution/Cloud)
- Email (nodemailer)
- Facebook Messenger
- Instagram Direct
- Telegram
- Canais unificados
- Integrações externas (CRM, APIs)
- API pública de integração (x-api-key)
- Webhooks com validação HMAC

### 6.11 Outros Módulos ✅
- Knowledge Base (artigos + versões)
- Automações (WHEN/IF/THEN)
- Robôs/Chatbots
- Enquetes
- Feriados
- Notificações internas
- Aprovações (interno + WhatsApp)
- Time Tracking (com blocos inicio/pausa/fim)
- Equipes (Team/TeamMember)
- Billing (cobranças por cliente)
- Busca global

---

## 7. MAPA DO BANCO DE DADOS

### Total: 90 models (tabelas)

| Domínio | Models | Principais |
|---------|--------|------------|
| **Organização/Tenant** | 1 | Organization |
| **Usuários** | 3 | User, UserDepartamento, TeamMember |
| **Clientes** | 5 | Client, Colaborador, Contact, Opportunity, Ativo |
| **Helpdesk/Tickets** | 23 | Ticket, TicketMetrics, TicketTimeline, TicketEvent, TicketStageEvent, TicketHistory, TicketSlaLog, TicketActivity, TicketWaitTime, TicketAiLog, TicketPerformance, TicketChecklist, TicketDepartmentTime, TicketAgentInteraction, CSATResposta, Message, ContatoIgnorado, etc. |
| **Ordens de Serviço** | 6 | ServiceOrder, ServiceOrderStatusEvent, Signature, SignatureAttempt, Attachment, ServiceOrderItem |
| **Kanban** | 10 | KanbanBoard, KanbanColumn, KanbanTask, KanbanSubtask, KanbanTag, KanbanTaskTag, KanbanActivity, KanbanAttachment, KanbanTemplate, KanbanStageTime |
| **IA** | 9 | AIClassification, AIEvaluation, AICorrection, AIMetricas, AICostLog, AIAgentAudit, AIAgentClosureAudit, AuditoriaProfissional, AIRespostaValidacao |
| **WhatsApp/Canais** | 5 | WhatsAppSession, WhatsAppConnection, Channel, ChannelMessage, ChannelRiskLog |
| **Config/Organização** | 10 | HelpdeskConfig, Fila, Departamento, NivelSuporte, SLAConfig, Categoria, Assunto, Feriado, HelpdeskRule, Enquete |
| **Integrações** | 4 | ExternalIntegration, ExternalIntegrationLog, Robot, RobotRule |
| **Notificações/Alertas** | 5 | AlertRecipient, AlertHistory, AuditAlert, Notificacao, TaskAlert |
| **Auditoria** | 2 | AuditLog, AuditAlert (expandido) |
| **Billing** | 3 | ClientBilling, BillingHistory, BillingPendency |
| **Tempo** | 2 | TimeEntry, TimeEntryBlock |
| **Teams/RBAC** | 3 | Team, TeamMember, RolePermission |
| **Outros** | 8 | Task, ChecklistTemplate, AutomationRule, KBArticle, KBArticleVersion, Message, Aprovacao, SyncLog |

### Índices: ~200+ entradas de índice

### Relações principais:
- Organization → (1:N) → User, Client, Ticket, KanbanBoard, etc.
- User → (1:N) → Ticket (assignee), KanbanTask (responsavel), AuditLog, etc.
- Ticket → (1:N) → Message, TicketMetrics, TicketTimeline, AIClassification, etc.
- KanbanBoard → (1:N) → KanbanColumn → (1:N) → KanbanTask
- Client → (1:N) → Ticket, ServiceOrder, Opportunity

### Migrations
- **Não existe pasta migrations** — usa `prisma db push` para sincronizar schema

---

## 8. INVENTÁRIO DE APIs

### Autenticação
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/auth/login` | POST | Login | Público (rate-limit 5/min) |
| `/api/auth/refresh` | POST | Refresh token | Público (rate-limit 20/min) |
| `/api/auth/logout` | POST | Logout | Autenticado |
| `/api/auth/me` | GET | Dados do usuário logado | Autenticado |
| `/api/auth/users` | GET | Listar usuários | admin, gerente |
| `/api/auth/users` | POST | Criar usuário | admin, gerente |
| `/api/auth/users/:id` | PUT | Atualizar usuário | admin, gerente |
| `/api/auth/users/:id` | DELETE | Arquivar usuário | admin, gerente |
| `/api/auth/users/:id/permanently` | DELETE | Excluir permanentemente | admin, gerente |
| `/api/auth/users/bulk-archive` | POST | Arquivar em massa | admin, gerente |

### Usuários
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/users` | GET | Listar usuários (admin) | admin |
| `/api/users/:id` | GET | Detalhar usuário | admin |
| `/api/users` | POST | Criar usuário | admin |
| `/api/users/:id` | PUT | Atualizar usuário | admin |
| `/api/users/:id` | DELETE | Desativar usuário | admin |

### Helpdesk
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/helpdesk/tickets` | GET | Listar tickets | Autenticado |
| `/api/helpdesk/tickets/:id` | GET | Detalhar ticket | Autenticado |
| `/api/helpdesk/tickets/:id/move` | PATCH | Mover etapa | Autenticado |
| `/api/helpdesk/tickets/:id/resolve` | POST | Resolver ticket | Autenticado |
| `/api/helpdesk/tickets/:id/close` | POST | Encerrar ticket | Autenticado |
| `/api/helpdesk/config` | GET/PUT | Config helpdesk | admin, gerente |
| `/api/helpdesk/departamentos` | CRUD | Departamentos | admin, gerente |
| `/api/helpdesk/filas` | CRUD | Filas | admin, gerente |
| `/api/helpdesk/categorias` | CRUD | Categorias | admin, gerente |
| `/api/helpdesk/assuntos` | CRUD | Assuntos | admin, gerente |
| `/api/helpdesk/indicadores*` | GET | Indicadores TMR/TME/SLA | admin, gerente |
| `/api/helpdesk/qualidade/*` | GET | Qualidade operacional | admin, gerente |
| `/api/helpdesk/checklist*` | CRUD | Checklists | Autenticado |
| `/api/helpdesk/stages` | GET | Etapas do kanban | Autenticado |

### Kanban
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/kanban/boards` | CRUD | Boards | Autenticado |
| `/api/kanban/boards/:id/tasks` | GET | Tasks do board | Autenticado |
| `/api/kanban/tasks` | POST | Criar task | Autenticado |
| `/api/kanban/tasks/:id` | PUT | Atualizar task | Autenticado |
| `/api/kanban/tasks/:id` | DELETE | Arquivar task | Autenticado |
| `/api/kanban/tasks/:id/move` | PATCH | Mover task | Autenticado |
| `/api/kanban/templates` | CRUD | Templates | Autenticado |
| `/api/kanban/upload` | POST | Upload anexo | Autenticado |
| `/api/kanban/task-alerts/*` | GET | Alertas de task | Autenticado |
| `/api/kanban/task-report/*` | GET | Relatórios | admin, gerente |
| `/api/kanban/task-timeline/*` | GET | Timeline | Autenticado |

### CRM
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/crm/clients` | GET/POST | Listar/criar clientes | Autenticado |
| `/api/crm/clients/:id` | GET/PUT/DELETE | CRUD cliente | Autenticado |
| `/api/crm/clients/:id/colaboradores` | CRUD | Colaboradores | Autenticado |
| `/api/crm/clients/:id/contacts` | GET/POST | Contatos | Autenticado |
| `/api/crm/opportunities` | CRUD | Oportunidades | Autenticado |

### Ordens de Serviço
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/orders` | GET/POST | Listar/criar OS | Autenticado |
| `/api/orders/:id` | GET/PUT/DELETE | CRUD OS | Autenticado |
| `/api/orders/:id/send` | POST | Enviar OS | Autenticado |
| `/api/orders/sign/:token` | POST | Assinar OS (público) | Token |
| `/api/orders/sign/:token/recusar` | POST | Recusar assinatura | Token |
| `/api/orders/reports` | GET | Relatórios | admin, gerente |
| `/api/orders/signature-config` | GET/PUT | Config assinatura | admin |

### WhatsApp
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/whatsapp/*` | Various | WhatsApp legado | Autenticado |
| `/api/whatsapp/connections` | CRUD | Conexões | admin, gerente |
| `/api/whatsapp/connections/:id/status` | GET | Status conexão | Autenticado |
| `/api/whatsapp/connections/:id/reconnect` | POST | Reconectar | Autenticado |
| `/api/channels/*` | CRUD | Canais unificados | Autenticado |

### IA
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/ai/*` | Various | IA (classificação, validação) | Autenticado |
| `/api/ai/agent-monitor/*` | GET | Monitor de agentes | admin, gerente |
| `/api/ai/agent-monitor/encerramentos/*` | GET | Encerramentos | admin, gerente |
| `/api/auditoria/*` | Various | Auditoria profissional | admin, gerente |

### Analytics
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/analytics/executivo` | GET | Dashboard executivo | admin, gerente |
| `/api/analytics/dashboard-ia` | GET | Dashboard IA | admin, gerente |
| `/api/analytics/visao-geral` | GET | Visão geral | admin, gerente |
| `/api/analytics/relatorio-semanal` | GET | Relatório semanal | admin, gerente |

### Auditoria de Sistema
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/audit/*` | Various | 17 endpoints de auditoria | admin, gerente, supervisor |
| `/api/audit-ticket/*` | Various | Auditoria de tickets | admin, gerente |

### Outros
| Endpoint | Método | Objetivo | Permissão |
|----------|--------|----------|-----------|
| `/api/aprovacoes/*` | Various | Aprovações | Autenticado |
| `/api/aprovacoes/public/:token` | GET | Página pública de aprovação | Token |
| `/api/kb/*` | CRUD | Knowledge Base | Autenticado |
| `/api/csat/*` | Various | CSAT | Autenticado |
| `/api/automations/*` | CRUD | Automações | admin, gerente |
| `/api/notificacoes/*` | CRUD | Notificações | Autenticado |
| `/api/permissions/*` | CRUD | Permissões | admin |
| `/api/enquetes/*` | CRUD | Enquetes | Autenticado |
| `/api/feriados/*` | CRUD | Feriados | admin, gerente |
| `/api/timetracking/*` | CRUD | Time tracking | Autenticado |
| `/api/teams/*` | CRUD | Equipes | admin, gerente |
| `/api/billing/*` | CRUD | Billing | admin, gerente |
| `/api/search` | GET | Busca global | Autenticado |
| `/api/integrations/external/*` | CRUD | Integrações externas | admin, gerente |
| `/api/integration/*` | Various | API pública (x-api-key) | API Key |

---

## 9. AUTENTICAÇÃO E PERMISSÕES

### JWT
- **Access token**: 15 minutos
- **Refresh token**: 7 dias
- **Session token**: UUID único por login (binding)
- **Header**: `Authorization: Bearer <token>`
- **Storage**: localStorage (`crm_token`)

### Roles
| Role | Nível | Permissões |
|------|-------|------------|
| `admin` | 4 | Tudo + gerenciar usuários + permissões |
| `gerente` | 3 | Gerenciar equipe, relatórios, alertas, OS |
| `comercial` | 2 | Clientes, oportunidades, WhatsApp |
| `tecnico` | 1 | OS, Kanban, WhatsApp, dashboard |

### Middleware
- `authenticate`: verifica JWT + session token
- `authorize(*roles)`: verifica se o role está na lista
- `ticketAccess`: controle de acesso por ticket
- `rateLimiter`: rate limiting in-memory
- `staticAuth`: protege arquivos estáticos sensíveis

### Proteções
- Usuário não pode arquivar/excluir a si próprio
- Usuário master não pode ser arquivado/excluído
- Validação de role no createUser/updateUser
- Senha mínima 8 caracteres
- Session token no refresh obrigatório

---

## 10. MULTI-ORGANIZAÇÃO

### Arquitetura
- Model `Organization` é a entidade raiz (tenant)
- Campo `organizationId` presente na maioria dos models
- Isolamento de dados via `organizationId` nas queries

### Regras
- Cada organização tem seus próprios: usuários, clientes, tickets, configs, departamentos, filas, etc.
- Unique constraints compostas: `[organizationId, slug]` em HelpdeskConfig, Fila, Departamento, etc.
- Usuários pertencem a uma organização via `organizationId`
- Tickets, OS, Kanban boards são filtrados por organização

### Limites
- `maxUsuarios`: limite de usuários por org (default 5)
- `maxClients`: limite de clientes por org (default 100)
- `plano`: free, pro, enterprise

---

## 11. INTEGRAÇÕES EXTERNAS

### WhatsApp (3 providers)
- **Baileys**: WebSocket, provider primário, sem Chrome
- **Evolution API**: Self-hosted Docker, REST API
- **Cloud API**: Meta oficial, HMAC validation

### IA
- **Claude API** (Anthropic): classificação, auditoria, diagnósticos, insights
- Fallback local determinístico quando chave não disponível

### Email
- **nodemailer**: envio de emails (SMTP configurável)

### Redes Sociais
- **Facebook Messenger**: integração via webhook
- **Instagram Direct**: integração via webhook

### Telegram
- Bot para atendimento

### Integrações Externas (CRMs)
- API genérica com autenticação (API key, token, basic auth)
- Secrets criptografados AES-256-GCM
- Webhooks com validação HMAC-SHA256
- Logs de entrada/saída

### API Pública
- Endpoints sob `/api/integration/*`
- Autenticação via header `x-api-key`
- Escopos: read, read-write
- Rate limit: 120/min

---

## 12. VARIÁVEIS DE AMBIENTE

### Variáveis obrigatórias
- `DATABASE_URL` — URL do PostgreSQL
- `DIRECT_URL` — URL direta (Neon)
- `JWT_SECRET` — Segredo JWT (obrigatório em produção)
- `JWT_REFRESH_SECRET` — Segredo refresh (obrigatório em produção)

### WhatsApp
- `WHATSAPP_SESSION_PATH`
- `WHATSAPP_CHROME_PATH`
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
- `WHATSAPP_CLOUD_ACCESS_TOKEN`
- `WHATSAPP_CLOUD_API_VERSION`
- `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_CLOUD_APP_SECRET`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `EVOLUTION_WEBHOOK_SECRET`

### IA
- `ANTHROPIC_API_KEY`

### Email
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### Redis
- `REDIS_URL`

### Integrações
- `INTEGRATION_ENCRYPTION_KEY`
- `INTEGRATION_API_KEYS`

### Geral
- `PORT` (default: 3010)
- `APP_URL`
- `API_URL`
- `BACKEND_URL`
- `NODE_ENV`
- `TIMEZONE`
- `ALERT_WHATSAPP_NUMBERS`
- `ALERT_DAY`
- `ALERT_HOUR`

**NUNCA registrar valores — apenas nomes.**

---

## 13. PENDÊNCIAS CONHECIDAS

### Assinatura de OS
- Link de assinatura precisa ser clicável
- Assinatura desenhada pode não estar salvando corretamente em todos os cases
- Testar desktop e celular

### Tarefas Internas / Kanban
- Verificar/corrigir criação de nova tarefa (pode haver bug intermitente)
- Campo Responsável deve mostrar somente usuários ativos (parcialmente implementado)

### Usuários
- Exclusão definitiva de usuários arquivados (endpoint implementado, verificar testes completos)
- Preservar histórico ao excluir

### Geral
- 26 erros TypeScript pré-existentes (facebook, instagram, email/imap, csurf, cookie-parser)
- 16 testes falhando (pré-existentes: orders-signature, ticket-closure-regression, ticket-lifecycle-e2e, agent-report, expediente-return, relatorios)
- Pasta `components/ui/` não existe no disco (mencionada no AGENTS.md)

---

## 14. FUNCIONALIDADES QUE DEVEM SER PRESERVADAS

### ABSOLUTAMENTE NÃO ALTERAR:
- Fluxo de atendimento WhatsApp (triagem → departamento → fila → agente)
- CSAT (confirmação de resolução → avaliação → estado)
- Autenticação JWT + session token binding
- RBAC (admin/gerente/tecnico/comercial)
- Multi-organização (isolamento de dados)
- SLA com cálculo em tempo real
- Handler canônico de WhatsApp (whatsapp-message-handler.ts)
- Handler legado (whatsapp.service.ts) — independente do canônico
- Auditoria profissional (14 categorias)
- Tomada de decisão (🟢🟡🔴)
- API pública de integração
- Exclusão lógica de usuários (active: false)
- Arquivamento de tarefas kanban
- Checklist templates
- Time tracking com blocos
- Enquetes e listas interativas
- Dark Mode
- Todos os dados existentes no banco
- Todas as migrations/lógica de banco
- Todas as rotas existentes

### PRESERVAR:
- Chamados/tickets com histórico completo
- Mensagens WhatsApp com contexto
- Auditoria e logs de todas as ações
- Aprovações com token
- Assinaturas eletrônicas existentes
- Dados de billing
- Configurações de helpdesk por departamento
- Regras de automação
- Knowledge Base com versões
- Timeline de tickets
- Métricas consolidadas

---

## 15. CHECKPOINT — ESTADO ATUAL

```
Data do checkpoint: 02/09/2026

Estado: PRODUÇÃO

Última etapa:
Correções e evolução de usuários (exclusão definitiva),
Tarefas Internas (filtro de responsáveis por ativos),
e preparação para deploy.

Commits recentes:
- v1.6.0: Qualidade Operacional (2026-08-26)
- v1.5.0: Deploy Prep + Audit System (2026-08-21)
- v1.4-dev: Fases 4-15 (2026-08-11–19)

Banco: 90 models, ~200+ índices
Backend: ~167 arquivos TypeScript, 50 testes
Frontend: 88 páginas, 28 componentes, 74 rotas
Mobile: Estrutura Expo Router (em desenvolvimento)

Próximas prioridades:
1. Corrigir assinatura da OS (link clicável, canvas)
2. Verificar criação de Tarefas Internas
3. Testes completos de exclusão definitiva de usuários
4. Corrigir 26 erros TypeScript pré-existentes
5. Corrigir 16 testes pré-existentes
```
