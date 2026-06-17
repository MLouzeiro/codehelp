---
name: codehelp
description: "CodeHelp CRM/Helpdesk — Skill unificada de desenvolvimento. Cobre backend (Node/Express/Prisma), frontend (React/Vite/Tailwind), mobile (React Native/Expo), todas as APIs, banco de dados, autenticacao, regras de negocio e padroes do projeto."
---

# CodeHelp — Skill Unificada de Desenvolvimento

Voce e um Desenvolvedor Senior Full-Stack especializado no sistema CodeHelp CRM/Helpdesk.
Todo o trabalho de desenvolvimento, manutencao, bug fix e evolucao deste projeto deve seguir esta skill como referencia unica.

---

## 1. IDENTIDADE DO PROJETO

**CodeHelp** e um sistema corporativo de CRM e Helpdesk com:
- Painel web (React + Vite)
- API backend (Node.js + Express + Prisma)
- App mobile (React Native + Expo)
- Integracao WhatsApp (whatsapp-web.js)
- IA e automacoes
- Sistema de aprovacoes e OS

**Linguagem do sistema**: Portugues do Brasil (pt-BR) — todos os textos, mensagens, labels e variaveis de output em portugues.

---

## 2. STACK TECNOLOGICA

### Backend
| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Runtime | Node.js + Express | Entry point: `backend/src/server.ts` |
| Linguagem | TypeScript | Sempre TypeScript, nunca JS puro |
| ORM | Prisma | Schema: `backend/prisma/schema.prisma` |
| Banco | SQLite (dev) / PostgreSQL (prod) | |
| Auth | JWT | Access 15min + Refresh 7d + Session token (UUID) |
| Senhas | bcrypt | Cost factor 12 |
| Validacao | Zod | |
| Uploads | multer | Pasta: `backend/storage/pdfs/` |
| WhatsApp | whatsapp-web.js | Sessao: `backend/whatsapp-session/` |

### Frontend Web
| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Framework | React 18 + Vite | |
| Linguagem | TypeScript | |
| Estilizacao | Tailwind CSS | |
| Graficos | Recharts | |
| Icones | Lucide React | |
| Roteamento | React Router DOM | |
| HTTP | Axios | Interceptor com auto-refresh 401 |
| Tema | ThemeContext | Dark/light + 4 modos de fundo |

### Mobile
| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Framework | React Native 0.74 + Expo SDK 51 | |
| Roteamento | Expo Router | File-based routing |
| State | Zustand | |
| HTTP | Axios + auto-refresh | |
| Estilo | NativeWind (Tailwind para RN) | |
| Animacoes | react-native-reanimated | |
| Gestos | react-native-gesture-handler | |
| Canvas | react-native-svg | Assinatura digital |
| Seguranca | expo-secure-store | JWT tokens |
| Biometria | expo-local-authentication | Face ID / Touch ID |
| Push | expo-notifications | FCM/APNs |
| Offline | @react-native-community/netinfo | Cache + fila |
| Storage | AsyncStorage | Cache offline |

---

## 3. ESTRUTURA DO PROJETO

```
code-help/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # Schema completo do banco
│   │   ├── seed.ts                    # Seed: admin@codemed.com.br / admin123
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts            # PrismaClient singleton
│   │   │   └── env.ts                 # Variaveis de ambiente
│   │   ├── modules/
│   │   │   ├── auth/                  # Login, JWT, RBAC
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── rbac.ts           # Roles: solicitante, agente, supervisor, admin
│   │   │   ├── helpdesk/             # Core do helpdesk
│   │   │   │   ├── helpdesk.service.ts    # Regras de fila, etapas, SLA
│   │   │   │   ├── helpdesk.controller.ts
│   │   │   │   ├── helpdesk.routes.ts
│   │   │   │   ├── autoMessages.service.ts  # Mensagens automaticas por tipo
│   │   │   │   ├── autoMessages.controller.ts
│   │   │   │   ├── stages.service.ts     # Estages customizados
│   │   │   │   ├── departamentos.service.ts
│   │   │   │   ├── departamentos.routes.ts
│   │   │   │   ├── filas.service.ts
│   │   │   │   ├── filas.routes.ts
│   │   │   │   └── sla.service.ts
│   │   │   ├── crm/                   # CRM completo
│   │   │   │   ├── crm.controller.ts
│   │   │   │   └── crm.routes.ts
│   │   │   ├── orders/                # Ordens de Servico
│   │   │   │   ├── orders.controller.ts
│   │   │   │   └── orders.routes.ts
│   │   │   ├── whatsapp/              # Integracao WhatsApp
│   │   │   │   ├── whatsapp.controller.ts
│   │   │   │   ├── whatsapp.routes.ts
│   │   │   │   └── whatsapp-connections.routes.ts
│   │   │   ├── alerts/                # Alertas e notificacoes
│   │   │   │   ├── alerts.service.ts
│   │   │   │   ├── alerts.controller.ts
│   │   │   │   └── alerts.routes.ts
│   │   │   ├── aprovacoes/            # Fluxo de aprovacao formal
│   │   │   │   ├── aprovacao.controller.ts
│   │   │   │   └── aprovacao.routes.ts
│   │   │   ├── kanban/                # Kanban de tarefas internas
│   │   │   ├── analytics/             # Dashboard e metricas
│   │   │   ├── kb/                    # Knowledge Base
│   │   │   ├── csat/                  # Customer Satisfaction
│   │   │   ├── automations/           # Regras de automacao
│   │   │   ├── notificacoes/          # Notificacoes internas
│   │   │   ├── permissions/           # RBAC avancado
│   │   │   ├── feriados/              # Feriados nacionais
│   │   │   ├── ai/                    # IA e robos
│   │   │   ├── audit/                 # Log de auditoria
│   │   │   └── users/                 # Gestao de usuarios
│   │   ├── shared/
│   │   │   └── middleware/
│   │   │       └── auth.ts            # authenticate, authorize, ticketAccess, authorizeMaster
│   │   └── server.ts
│   ├── storage/pdfs/                  # Uploads (gitignored)
│   ├── whatsapp-session/              # Sessao WhatsApp (gitignored)
│   └── dist/                          # Build (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                    # Button, Input, Card, Modal, Badge, etc.
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── Layout.tsx             # Sidebar + content (3 modos: horizontal, collapsed, vertical)
│   │   │   ├── ThemeSettings.tsx
│   │   │   └── SignatureCanvas.tsx
│   │   ├── pages/
│   │   │   ├── Login/
│   │   │   ├── Dashboard/
│   │   │   ├── CRM/                   # ClientList, ClientForm, ClientDetail, OpportunityPipeline
│   │   │   ├── Helpdesk/              # HelpdeskKanban, HelpdeskDashboard, HelpdeskStatusBoard, HelpdeskMetrics
│   │   │   ├── WhatsApp/              # WhatsAppPage
│   │   │   ├── Kanban/                # KanbanPage (tarefas internas)
│   │   │   ├── Orders/                # OrderList, OrderForm, OrderDetail
│   │   │   ├── Sign/                  # SignPage (assinatura publica)
│   │   │   ├── Settings/              # HelpdeskConfigPage, Departamentos, Filas, Niveis, CRMThemes, AutoMessagesPage, AlertSettings
│   │   │   └── Aprovacoes/
│   │   ├── services/
│   │   │   ├── api.ts                 # Axios + interceptor 401 → refresh queue
│   │   │   ├── auth.tsx               # AuthContext + login/logout
│   │   │   ├── ThemeContext.tsx        # Dark/light + bg modes + CSS vars
│   │   │   ├── soundAlerts.ts         # Web Audio API (som sintetizado)
│   │   │   └── useCan.ts              # Hook de permissoes
│   │   └── types/
│   │       └── index.ts               # Todas as interfaces TypeScript
│   └── dist/
├── mobile/                            # App React Native + Expo (detalhes na secao 14)
├── .claude/
│   └── skills/
│       ├── expxagents/SKILL.md        # Skill ExpxAgents
│       └── HELP-DESK/SKILL.MD         # Esta skill
├── .opencode/
│   └── skills/
│       ├── codehelp-dev/SKILL.md      # Skill dev (legada)
│       └── codehelp-mobile/SKILL.md   # Skill mobile (legada)
├── AGENTS.md                          # Regras do projeto
├── SPEC.md                            # Documento de especificacao
├── DOCUMENTATION.md                   # Documentacao completa
└── .gitignore
```

---

## 4. BANCO DE DADOS (Prisma Schema)

### Modelos Principais

```prisma
model User {
  id            String    @id @default(uuid())
  name          String
  email         String    @unique
  password      String                              // bcrypt cost 12
  role          String    @default("tecnico")        // admin, gerente, tecnico, vendedor, comercial
  isMaster      Boolean   @default(false)
  phone         String?
  avatar        String?
  active        Boolean   @default(true)
  online        Boolean   @default(false)
  lastSeenAt    DateTime?
  sessionToken  String?   @unique                    // Device binding (UUID unico por sessao)
  departamentos Departamento[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model CrmClient {
  id                    String    @id @default(uuid())
  razaoSocial           String
  nomeFantasia          String?
  cnpjCpf               String?
  email                 String?
  telefone              String?
  celular               String?
  segmento              String?
  cidade                String?
  estado                String?
  status                String?                      // ativo, inativo,Lead
  origem                String?
  tipoContrato          String?
  valorMensalidade      Float?
  diaVencimento         Int?
  dataInicioContrato    DateTime?
  dataFimContrato       DateTime?
  responsavelTecnico    String?
  sellerId              String?
  seller                User?      @relation(fields: [sellerId], references: [id])
  tickets               HelpdeskTicket[]
  opportunities         Opportunity[]
  contacts              Contact[]
  serviceOrders         ServiceOrder[]
  colaboradores         Colaborador[]
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
}

model HelpdeskTicket {
  id                    String    @id @default(uuid())
  protocolo             String?   @unique           // Ex: #2026-000123
  contactName           String?
  contactPhone          String?
  assunto               String?
  categoria             String?                     // suporte_tecnico, duvida_faturamento, etc.
  tipo                  String?                     // bug, duvida, solicitacao, reclamacao
  observacoes           String?
  etapa                 String    @default("fila")  // fila, triagem, em_atendimento, aguardando_cliente, aguardando_os, concluido
  prioridade            String    @default("media") // baixa, media, alta, urgente
  status                String    @default("aberto") // aberto, em_andamento, pendente, escalonado, resolvido, fechado, cancelado
  clientId              String?
  client                CrmClient? @relation(fields: [clientId], references: [id])
  assigneeId            String?
  assignee              User?      @relation(fields: [assigneeId], references: [id])
  departamentoId        String?
  departamento          Departamento? @relation(fields: [departamentoId], references: [id])
  nivelSuporteId        String?
  nivel                 NivelSuporte? @relation(fields: [nivelSuporteId], references: [id])
  dataAbertura          DateTime   @default(now())
  dataInicioAtendimento DateTime?
  dataFechamento        DateTime?
  emAtendimentoDesde    DateTime?
  messages              TicketMessage[]
  orders                ServiceOrder[]
  aprovacoes            Aprovacao[]
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
}

model HelpdeskConfig {
  id                        String  @id @default(uuid())
  slug                      String  @unique         // Ex: fila_triagem, csat, auto_fila
  titulo                    String?
  descricao                 String?                 // JSON: temas, alert configs, etc.
  mensagemTriagem           String?
  mensagemEmAtendimento     String?
  mensagemAguardandoCliente String?
  mensagemAguardandoOs      String?
  mensagemConcluido         String?
  mensagemCsat              String?
  horarioInicio             String? @default("08:00")
  horarioFim                String? @default("18:00")
  horarioSabadoInicio       String? @default("07:00")
  horarioSabadoFim          String? @default("12:00")
}

model ServiceOrder {
  id              String    @id @default(uuid())
  numero          String?   @unique
  titulo          String
  descricao       String?
  status          String    @default("aberta")     // aberta, em_andamento, concluida, cancelada, aguardando_peca
  prioridade      String?
  clientId        String?
  client          CrmClient? @relation(fields: [clientId], references: [id])
  assigneeId      String?
  assignee        User?      @relation(fields: [assigneeId], references: [id])
  ticketId        String?
  ticket          HelpdeskTicket? @relation(fields: [ticketId], references: [id])
  dataAbertura    DateTime  @default(now())
  dataConclusao   DateTime?
  valorTotal      Float?
  observacoes     String?
  assinaturaUrl   String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Aprovacao {
  id                String    @id @default(uuid())
  ticketId          String
  ticket            HelpdeskTicket @relation(fields: [ticketId], references: [id])
  tipo              String                               // mudanca_escopo, aumento_valor, prorrogacao_prazo
  motivo            String
  observacao        String?
  status            String    @default("pendente")       // pendente, aprovada, rejeitada
  valorAprovado     Float?
  dataSolicitacao   DateTime  @default(now())
  dataDecisao       DateTime?
  solicitadoPorId   String
  solicitadoPor     User      @relation("SolicitadoPor", fields: [solicitadoPorId], references: [id])
  aprovadoPorId     String?
  aprovadoPor       User?     @relation("AprovadoPor", fields: [aprovadoPorId], references: [id])
  createdAt         DateTime  @default(now())
}

model Opportunity {
  id                String    @id @default(uuid())
  titulo            String
  valor             Float?
  etapa             String    @default("novo")       // novo, em_andamento, negociacao, fechado, perdido
  probability       Int?
  expectedCloseDate DateTime?
  notes             String?
  clientId          String?
  client            CrmClient? @relation(fields: [clientId], references: [id])
  assigneeId        String?
  assignee          User?      @relation(fields: [assigneeId], references: [id])
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
}

model Departamento {
  id          String    @id @default(uuid())
  slug        String    @unique
  nome        String
  descricao   String?
  cor         String    @default("#3b82f6")
  icone       String    @default("headphones")
  ordem       Int       @default(0)
  ativo       Boolean   @default(true)
  tickets     HelpdeskTicket[]
  usuarios    User[]
  filas       Fila[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Fila {
  id              String    @id @default(uuid())
  slug            String    @unique
  nome            String
  descricao       String?
  nivel           String    @default("normal")
  slaMinutos      Int       @default(60)
  cor             String    @default("#64748b")
  icone           String    @default("inbox")
  ordem           Int       @default(0)
  ativo           Boolean   @default(true)
  departamentoId  String?
  departamento    Departamento? @relation(fields: [departamentoId], references: [id])
  nivelSuporteId  String?
  nivelSuporte    NivelSuporte? @relation(fields: [nivelSuporteId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model NivelSuporte {
  id          String    @id @default(uuid())
  slug        String    @unique
  nome        String
  descricao   String?
  slaMinutos  Int?
  cor         String    @default("#f59e0b")
  icone       String    @default("headphones")
  ordem       Int       @default(0)
  ativo       Boolean   @default(true)
  tickets     HelpdeskTicket[]
  filas       Fila[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model TicketMessage {
  id          String    @id @default(uuid())
  ticketId    String
  ticket      HelpdeskTicket @relation(fields: [ticketId], references: [id])
  content     String
  fromMe      Boolean   @default(false)
  senderName  String?
  senderId    String?
  createdAt   DateTime  @default(now())
}

model Contact {
  id        String  @id @default(uuid())
  nome      String
  telefone  String?
  email     String?
  cargo     String?
  principal Boolean @default(false)
  clientId  String?
  client    CrmClient? @relation(fields: [clientId], references: [id])
}

model Colaborador {
  id        String  @id @default(uuid())
  nome      String
  cargo     String?
  email     String?
  telefone  String?
  principal Boolean @default(false)
  clientId  String?
  client    CrmClient? @relation(fields: [clientId], references: [id])
}

model Notificacao {
  id              String    @id @default(uuid())
  tipo            String                          // novo_ticket, cliente_respondeu, sla_alerta, etc.
  mensagem        String
  destinatarioId  String
  ticketId        String?
  dados           String?                         // JSON
  lida            Boolean   @default(false)
  createdAt       DateTime  @default(now())
}

model Automation {
  id              String    @id @default(uuid())
  nome            String
  descricao       String?
  trigger         String                          // novo_ticket, msg_recebida, status_alterado, sla_alerta, csat_recebido
  condicoes       String                          // JSON array
  acoes           String                          // JSON array
  logicOperator   String    @default("all")       // all, any
  ativo           Boolean   @default(true)
  ordem           Int       @default(0)
  autorId         String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model KBArticle {
  id            String    @id @default(uuid())
  slug          String    @unique
  titulo        String
  conteudo      String
  resumo        String?
  tags          String    @default("")
  publicado     Boolean   @default(false)
  visualizacoes Int       @default(0)
  util          Int       @default(0)
  inutil        Int       @default(0)
  autorId       String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Enums de Etapas

```typescript
type EtapaSlug = 'fila' | 'triagem' | 'em_atendimento' | 'aguardando_cliente' | 'aguardando_os' | 'concluido';
type StatusSlug = 'aberto' | 'em_andamento' | 'pendente' | 'escalonado' | 'resolvido' | 'fechado' | 'cancelado';
type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';
type Categoria = 'suporte_tecnico' | 'duvida_faturamento' | 'solicitacao_mudanca' | 'treinamento' | 'reclamacao' | 'orcamento' | 'agendamento' | 'outro';
```

---

## 5. SISTEMA DE AUTENTICACAO

### Fluxo JWT

```
POST /api/auth/login {email, password}
  → bcrypt.compare
  → gerar sessionToken (UUID novo)
  → salvar sessionToken no DB (invalida tokens anteriores)
  → retornar:
    - accessToken (JWT, 15min, payload: {id, email, role, sessionToken})
    - refreshToken (JWT, 7d, payload: {id})
    - sessionToken (UUID)
    - user {id, name, email, role, isMaster, phone}

POST /api/auth/refresh {refreshToken, sessionToken}
  → jwt.verify(refreshToken, jwtRefreshSecret)
  → verificar sessionToken no DB
  → rotacionar sessionToken (novo UUID)
  → retornar novo par de tokens

GET /api/auth/me (Authorization: Bearer <accessToken>)
  → jwt.verify(accessToken, jwtSecret)
  → buscar user no DB
  → verificar sessionToken bate com DB
  → retornar user com departamentos
```

### RBAC (Role-Based Access Control)

```typescript
// Roles normalizadas (legacy mapping no rbac.ts):
// tecnico → agente
// gerente → supervisor
// vendedor → agente

// Hierarquia: solicitante(1) < agente(2) < supervisor(3) < admin(4)

// Middleware disponiveis:
authenticate              // Obrigatorio: JWT valido + user ativo + sessionToken match
authorize('admin', 'gerente')  // Role exato (normalizado)
authorizeMaster           // isMaster === true OU role === admin
requireRole('supervisor') // Hierarquia (admin tambem passa)
ticketAccess('view')      // Acesso ao ticket (owner, assignee, admin, supervisor)
ticketAccess('edit')      // Edicao do ticket
ticketAccess('assign')    // Atribuicao do ticket
```

### Seed Padrao

```
Admin:    admin@codemed.com.br / admin123 (role: admin, isMaster: true)
Vendedor: vendedor@codemed.com.br / admin123 (role: vendedor)
```

---

## 6. MIDDLEWARE E ROUTAS

### Padrao de Rota Express

```typescript
// routes.ts
router.use(authenticate); // Auth global no router

router.get('/endpoint', handler);                           // Todos autenticados
router.post('/endpoint', authorize('admin', 'gerente'), handler); // Roles especificos
router.post('/endpoint', authorizeMaster, handler);         // Master only
router.post('/tickets/:id/move', ticketAccess('edit'), handler);  // Acesso por ticket
```

### Padrao de Controller

```typescript
export const myHandler = async (req: AuthRequest, res: Response) => {
  try {
    const result = await myService.doSomething(req.body, req.user);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};
```

### AuthRequest

```typescript
interface AuthRequest extends Request {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isMaster: boolean;
    departamentos: Array<{ id: string; slug: string; nome: string }>;
  };
}
```

---

## 7. APIs COMPLETAS (144 endpoints)

### Auth (`/api/auth`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| POST | `/auth/login` | Publico | Login (rate limit 5/h) |
| POST | `/auth/refresh` | Publico | Refresh tokens |
| GET | `/auth/me` | authenticate | Dados do usuario logado |
| GET | `/auth/users` | admin/gerente | Listar usuarios |
| POST | `/auth/users` | admin/gerente | Criar usuario |
| PUT | `/auth/users/:id` | admin/gerente | Editar usuario |

### Helpdesk (`/api/helpdesk`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/helpdesk/kanban` | auth | Board kanban completo (6 etapas) |
| GET | `/helpdesk/status-board` | auth | Board por status |
| GET | `/helpdesk/tickets` | auth | Lista de tickets |
| GET | `/helpdesk/dashboard` | admin/gerente | Dashboard em tempo real |
| GET | `/helpdesk/etapas` | auth | Etapas do pipeline |
| PATCH | `/helpdesk/etapas/:id` | admin/gerente | Editar etapa |
| POST | `/helpdesk/tickets/:id/move` | ticketAccess('edit') | Mover entre etapas |
| PATCH | `/helpdesk/tickets/:id/atribuir` | ticketAccess('assign') | Atribuir agente |
| POST | `/helpdesk/tickets/:id/triage` | ticketAccess('edit') | Triagem |
| POST | `/helpdesk/tickets/:id/assume` | ticketAccess('edit') | Assumir ticket |
| POST | `/helpdesk/tickets/:id/resolver` | ticketAccess('edit') | Resolver ticket |
| POST | `/helpdesk/tickets/:id/escalar` | ticketAccess('edit') | Escalar ticket |
| PATCH | `/helpdesk/tickets/:id/client` | ticketAccess('edit') | Vincular/desvincular cliente |
| GET | `/helpdesk/tickets/:id/history` | ticketAccess('view') | Historico + mensagens |
| GET | `/helpdesk/tickets/:id/position` | ticketAccess('view') | Posicao na fila |
| GET | `/helpdesk/tickets/:id/sla` | ticketAccess('view') | Status SLA |
| POST | `/helpdesk/tickets/:id/atribuir-sla` | ticketAccess('assign') | Atribuir SLA |
| POST | `/helpdesk/queue/recalc` | admin/gerente/supervisor | Recalcular fila |
| POST | `/helpdesk/presence` | auth | Presenca do agente |
| GET | `/helpdesk/stages` | auth | Listar stages |
| POST | `/helpdesk/stages` | authorizeMaster | Criar stage |
| PUT | `/helpdesk/stages/:id` | authorizeMaster | Editar stage |
| PATCH | `/helpdesk/stages/reorder` | authorizeMaster | Reordenar stages |
| DELETE | `/helpdesk/stages/:id` | authorizeMaster | Deletar stage |
| POST | `/helpdesk/stages/:id/restore` | authorizeMaster | Restaurar stage |
| POST | `/helpdesk/sla/processar-alertas` | admin/gerente/supervisor | Processar alertas SLA |
| GET | `/helpdesk/filas` | auth | Listar filas |
| GET | `/helpdesk/sla-configs` | auth | Configs SLA |
| GET | `/helpdesk/categorias` | auth | Categorias |
| GET | `/helpdesk/metrics` | admin/gerente/supervisor | Metricas completas |
| GET | `/helpdesk/auto-messages` | admin/gerente | Mensagens automaticas |
| PUT | `/helpdesk/auto-messages/:slug` | admin/gerente | Editar mensagem |
| POST | `/helpdesk/auto-messages/:slug/reset` | admin/gerente | Resetar mensagem |

### Helpdesk — Departamentos
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/helpdesk/departamentos` | auth | Listar |
| POST | `/helpdesk/departamentos` | authorizeMaster | Criar |
| PUT | `/helpdesk/departamentos/:id` | authorizeMaster | Editar |
| PATCH | `/helpdesk/departamentos/:id/toggle` | authorizeMaster | Ativar/desativar |

### Helpdesk — Niveis
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/helpdesk/niveis` | auth | Listar |
| POST | `/helpdesk/niveis` | authorizeMaster | Criar |
| PUT | `/helpdesk/niveis/:id` | authorizeMaster | Editar |
| PATCH | `/helpdesk/niveis/:id/toggle` | authorizeMaster | Ativar/desativar |

### Helpdesk — Filas
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/helpdesk/filas` | auth | Listar |
| POST | `/helpdesk/filas` | authorizeMaster | Criar |
| PUT | `/helpdesk/filas/:id` | authorizeMaster | Editar |
| PATCH | `/helpdesk/filas/:id/toggle` | authorizeMaster | Ativar/desativar |

### CRM (`/api/crm`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/crm/clients` | auth | Lista paginada (search, status, page, limit) |
| GET | `/crm/clients/:id` | auth | Detalhe completo (tickets, opportunities, contacts, orders, colaboradores) |
| POST | `/crm/clients` | admin/gerente/comercial | Criar |
| PUT | `/crm/clients/:id` | admin/gerente/comercial | Editar |
| DELETE | `/crm/clients/:id` | admin | Deletar |
| GET | `/crm/clients/:clientId/contacts` | auth | Contatos |
| POST | `/crm/contacts` | auth | Criar contato |
| GET | `/crm/clients/:clientId/colaboradores` | auth | Colaboradores |
| POST | `/crm/clients/:clientId/colaboradores` | admin/gerente/comercial | Criar colaborador |
| PUT | `/crm/colaboradores/:id` | admin/gerente/comercial | Editar colaborador |
| DELETE | `/crm/colaboradores/:id` | admin/gerente | Deletar colaborador |
| POST | `/crm/colaboradores/:id/principal` | auth | Definir como principal |
| GET | `/crm/opportunities` | auth | Oportunidades |
| POST | `/crm/opportunities` | admin/gerente/comercial | Criar oportunidade |
| PUT | `/crm/opportunities/:id` | admin/gerente/comercial | Editar oportunidade |
| GET | `/crm/pipeline` | auth | Pipeline agrupado por etapa |
| GET | `/crm/temas` | auth | Temas CRM |
| POST | `/crm/temas` | admin/gerente | Criar tema |
| PUT | `/crm/temas/:id` | admin/gerente | Editar tema |
| DELETE | `/crm/temas/:id` | admin | Deletar tema |

### Orders / OS (`/api/orders`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/orders` | auth | Lista paginada |
| GET | `/orders/:id` | auth | Detalhe |
| POST | `/orders` | admin/gerente/tecnico | Criar |
| PUT | `/orders/:id` | admin/gerente/tecnico | Editar |
| DELETE | `/orders/:id` | admin | Deletar |
| PATCH | `/orders/:id/status` | admin/gerente | Atualizar status |
| POST | `/orders/:id/send-signature` | admin/gerente/tecnico | Enviar para assinatura |
| GET | `/orders/sign/:token` | **Publico** | Pagina de assinatura |
| POST | `/orders/sign/:token` | **Publico** | Submeter assinatura |
| GET | `/orders/:id/pdf` | auth | Gerar PDF |

### WhatsApp (`/api/whatsapp`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/whatsapp/status` | auth | Status conexao |
| GET | `/whatsapp/qrcode` | auth | QR code |
| POST | `/whatsapp/connect` | admin/gerente | Conectar |
| POST | `/whatsapp/disconnect` | admin/gerente | Desconectar |
| POST | `/whatsapp/reconnect` | admin/gerente | Reconectar |
| GET | `/whatsapp/tickets` | auth | Lista tickets WA |
| GET | `/whatsapp/tickets/:id` | auth | Detalhe + mensagens |
| POST | `/whatsapp/tickets` | auth | Criar ticket |
| POST | `/whatsapp/send` | admin/gerente/tecnico | Enviar mensagem |
| POST | `/whatsapp/tickets/:id/close` | admin/gerente/tecnico | Fechar |
| PATCH | `/whatsapp/tickets/:id` | admin/gerente/tecnico | Editar |
| POST | `/whatsapp/tickets/:id/abrir` | admin/gerente/tecnico | Abrir chamado formal |
| POST | `/whatsapp/tickets/:id/transferir` | admin/gerente/tecnico | Transferir |
| POST | `/whatsapp/tickets/:id/descartar` | admin/gerente/tecnico | Descartar |
| GET | `/whatsapp/connections` | auth | Conexoes multi-WA |
| POST | `/whatsapp/connections` | authorizeMaster | Criar conexao |
| PUT | `/whatsapp/connections/:id` | authorizeMaster | Editar conexao |
| PATCH | `/whatsapp/connections/:id/toggle` | authorizeMaster | Ativar/desativar |

### Aprovacoes (`/api/aprovacoes`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| POST | `/aprovacoes` | all | Criar solicitacao |
| GET | `/aprovacoes` | admin/gerente | Lista |
| GET | `/aprovacoes/pendentes` | admin/gerente | Pendentes (badge) |
| GET | `/aprovacoes/:id` | all | Detalhe |
| POST | `/aprovacoes/:id/decidir` | admin/gerente | Aprovar/rejeitar |

### Notificacoes (`/api/notificacoes`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/notificacoes` | auth | Lista |
| GET | `/notificacoes/nao-lidas/count` | auth | Contagem nao lidas |
| POST | `/notificacoes/:id/lida` | auth | Marcar como lida |
| POST | `/notificacoes/marcar-todas` | auth | Marcar todas |

### Analytics (`/api/analytics`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/analytics/dashboard` | auth | Dashboard completo |
| GET | `/analytics/insights` | auth | Insights IA |
| GET | `/analytics/kpis` | auth | KPIs |

### Kanban (`/api/kanban`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/kanban/board` | auth | Board |
| GET | `/kanban/tasks` | auth | Tarefas |
| POST | `/kanban/tasks` | admin/gerente | Criar |
| PUT | `/kanban/tasks/:id` | admin/gerente/tecnico | Editar |
| DELETE | `/kanban/tasks/:id` | admin | Deletar |
| PATCH | `/kanban/tasks/reorder` | auth | Reordenar |

### KB (`/api/kb`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/kb` | auth | Listar artigos |
| GET | `/kb/:id` | auth | Artigo |
| POST | `/kb` | auth | Criar |
| PATCH | `/kb/:id` | auth | Editar |
| DELETE | `/kb/:id` | auth | Deletar |
| POST | `/kb/:id/publicar` | auth | Publicar |
| POST | `/kb/:id/feedback` | auth | Feedback util/inutil |

### CSAT (`/api/csat`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| POST | `/csat/responder/:token` | **Publico** | Responder avaliacao |
| POST | `/csat/ticket/:ticketId/agendar` | auth | Agendar CSAT |
| POST | `/csat/ticket/:ticketId/enviar` | auth | Enviar CSAT |
| POST | `/csat/processar` | admin/gerente/supervisor | Processar |
| GET | `/csat/estatisticas` | admin/gerente/supervisor | Estatisticas |

### Automations (`/api/automations`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/automations` | auth | Listar |
| GET | `/automations/:id` | auth | Detalhe |
| POST | `/automations` | auth | Criar |
| PATCH | `/automations/:id` | auth | Editar |
| DELETE | `/automations/:id` | auth | Deletar |
| POST | `/automations/testar` | auth | Testar regra |

### Permissions (`/api/permissions`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/permissions/catalog` | auth | Catalogo de permissoes |
| GET | `/permissions/matriz` | auth | Matriz completa |
| GET | `/permissions/me` | auth | Minhas permissoes |
| GET | `/permissions/check` | auth | Verificar permissao |
| GET | `/permissions/:role` | auth | Permissoes da role |
| PUT | `/permissions/:role` | authorizeMaster | Atualizar |
| PATCH | `/permissions/:role/:resource/:action` | authorizeMaster | Toggle |
| DELETE | `/permissions/:role/:resource/:action` | authorizeMaster | Remover |
| POST | `/permissions/:role/reset` | authorizeMaster | Resetar |

### Alertas (`/api/alerts`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/alerts/agent/config` | auth | Config do agente |
| POST | `/alerts/agent/config` | auth | Salvar config |
| GET | `/alerts/agent/nao-lidos` | auth | Nao lidos |
| GET | `/alerts/agent/resumo` | auth | Resumo |
| GET | `/alerts/recipients` | admin/gerente | Destinatarios |
| POST | `/alerts/recipients` | admin/gerente | Adicionar |
| PUT | `/alerts/recipients/:id` | admin/gerente | Editar |
| DELETE | `/alerts/recipients/:id` | admin/gerente | Remover |
| GET | `/alerts/history` | admin/gerente | Historico |
| POST | `/alerts/trigger` | admin/gerente | Disparar alerta |

### AI (`/api/ai`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/ai/sugestoes-vendas` | admin/gerente/comercial | Sugestoes |
| POST | `/ai/classificar-tickets` | admin/gerente | Classificar |
| GET | `/ai/os-alerts` | admin/gerente | Alertas OS |
| GET | `/ai/sugestoes-tarefas` | admin/gerente | Sugestoes tarefas |
| GET | `/ai/status` | auth | Status IA |
| POST | `/ai/robos` | admin/gerente | Criar robo |
| PATCH | `/ai/robos/:id` | admin/gerente | Editar robo |
| DELETE | `/ai/robos/:id` | admin/gerente | Deletar robo |
| POST | `/ai/robos/:robotId/rules` | admin/gerente | Criar regra |
| PATCH | `/ai/rules/:id` | admin/gerente | Editar regra |
| DELETE | `/ai/rules/:id` | admin/gerente | Deletar regra |
| POST | `/ai/rules/reorder` | admin/gerente | Reordenar |

### Audit (`/api/audit`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/audit` | admin/gerente/supervisor | Log |
| GET | `/audit/stats` | admin/gerente/supervisor | Estatisticas |
| GET | `/audit/ticket/:ticketId` | admin/gerente/supervisor | Por ticket |

### Search (`/api`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/search` | auth | Busca global |
| GET | `/search/suggestions` | auth | Sugestoes |

### Feriados (`/api/feriados`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/feriados` | auth | Listar |
| GET | `/feriados/:id` | auth | Detalhe |
| POST | `/feriados` | authorizeMaster | Criar |
| PUT | `/feriados/:id` | authorizeMaster | Editar |
| DELETE | `/feriados/:id` | authorizeMaster | Deletar |
| POST | `/feriados/seed` | authorizeMaster | Popular feriados |

### Users (`/api/users`)
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/users` | admin | Listar |
| GET | `/users/:id` | admin | Detalhe |
| POST | `/users` | admin | Criar |
| PUT | `/users/:id` | admin | Editar |
| DELETE | `/users/:id` | admin | Deletar |

### Health
| Metodo | Rota | Auth | Descricao |
|--------|------|------|-----------|
| GET | `/api/health` | Publico | Health check |

---

## 8. FRONTEND — PADROES

### Padrão de Pagina

```typescript
export default function MyPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get('/endpoint');
      setData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  usePolling(loadData, 10000); // Opcional

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Conteudo */}
    </ScrollView>
  );
}
```

### Layout (3 modos)

```typescript
// Layout.tsx — detecta largura da tela
// >= 1024px: sidebar horizontal (fixa)
// >= 768px: sidebar collapsed (icones)
// < 768px: sidebar vertical (drawer)
```

### Tema (ThemeContext)

```typescript
const { colors, isDark, themeMode, bgMode, setThemeMode, setBgMode } = useTheme();
// colors: bg, bgCard, bgInput, text, textSecondary, border, primary, primaryText
// bgMode: 'white' | 'ice' | 'gray' | 'lightblue'
// CSS vars: --bg-app, --bg-card, --bg-input, etc.
```

### API Interceptor (auto-refresh)

```typescript
// api.ts
// 1. Request: attaches Bearer token
// 2. Response 401: queues requests, refreshes token, retries
// 3. Refresh fails: clears tokens, redirects to /login
// 4. Proactive refresh: 60s before expiry
```

### Som (soundAlerts.ts)

```typescript
// Web Audio API — tons sintetizados (sem MP3)
// Tipos: cliente_entrou, nova_mensagem, notificacao, erro
// initAudioContext() chamado no primeiro clique/toque
// isAlertSoundEnabled(tipo) verifica config do usuario
```

---

## 9. MOBILE — PADROES

### Expo Router (file-based)

```
app/_layout.tsx          → Root: ThemeProvider + AuthGate + NetworkBar
app/(auth)/login.tsx     → Login + biometria
app/(tabs)/_layout.tsx   → 6 tabs: Home, Helpdesk, CRM, OS, Aprovacoes, Alertas
app/(tabs)/index.tsx     → Dashboard
app/(tabs)/helpdesk.tsx  → Kanban
app/(tabs)/crm.tsx       → Clientes
app/(tabs)/orders.tsx    → OS
app/(tabs)/approvals.tsx → Aprovacoes
app/(tabs)/notifications.tsx → Notificacoes
app/(modals)/ticket/[id].tsx  → Detalhe ticket + chat
app/(modals)/client/[id].tsx  → Detalhe cliente
app/(modals)/order/[id].tsx   → Detalhe OS
app/(modals)/settings.tsx     → Configuracoes
```

### Zustand Store

```typescript
import { create } from 'zustand';
import { offlineService } from '../services/offline';

// Ler com cache
const data = await offlineService.cachedGet<T>('/endpoint', 30000);

// Mutacao offline
if (!offlineService.isNetworkOnline()) {
  await offlineService.addToQueue('POST', '/endpoint', payload);
  return;
}
```

### Offline Mode

```typescript
// Cache: AsyncStorage com TTL
// Fila: operacoes offline salvas e processadas ao reconectar
// Indicador: barra vermelha "Sem conexao" no layout
```

### Push Notifications

```typescript
// 8 tipos: novo_ticket, cliente_respondeu, sla_alerta, sla_vencido,
//          transferencia, aprovacao_pendente, mensagem_recebida, avaliacao_recebida
```

---

## 10. REGRAS DE OURO

### Versionamento (absoluto)
| Branch/Tag | Significado | Pode mexer? |
|------------|-------------|-------------|
| `main` | Versao em uso (estavel) | NAO sem autorizacao |
| `develop` | Proxima versao em desenvolvimento | SIM |
| `v1.x` | Tag de marco estavel | NAO (referencia historica) |

### Commits
- Prefixo: `v1.4-dev:` + tipo + modulo
- Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`
- Exemplo: `v1.4-dev: fix(helpdesk): corrigir race condition no protocolo`

### Nao Mexer no Que Funciona
1. **Definir escopo** antes de abrir o editor
2. **Justificar** cada linha fora do escopo
3. **Preferir adicionar** sem editar existente
4. **Typecheck**: `npx tsc --noEmit` (backend e frontend)
5. **Testes**: `npm test` antes de commitar

### Anti-padroes Proibidos
- "Ja que estou aqui, vou melhorar X" — PROIBIDO
- "Esse codigo esta feio, vou reformatar" — PROIBIDO
- Mudar `var` para `const` sem motivo — PROIBIDO
- Adicionar protecoes extras em codigo validado — PROIBIDO
- Trocar versao de lib sem motivo de bug — PROIBIDO

### Seguranca
- Vendedor so ve/altera proprios registros
- DELETE: somente admin
- Rate limit login: 5 tentativas/hora
- Senhas: bcrypt cost 12
- Nunca expor senhas ou tokens em logs

### Nomes Proibidos
- NUNCA usar "Leticia" ou "Rafael" em qualquer output do sistema

---

## 11. COMANDOS

```bash
# Backend
npm run dev:backend            # Backend (tsx watch, porta 3001)
npm run build                  # Build ambos
npm run db:migrate             # Prisma migrate dev
npm run db:push                # Prisma db push
npm run db:seed                # Executar seed
npm run db:studio              # Prisma Studio
npm run reset                  # Encerra node, libera portas, inicia dev (Admin)
npm run reset:keep-session     # Reset sem apagar sessao WA
npx tsc --noEmit               # Typecheck backend

# Frontend
npm run dev:frontend           # Frontend (vite, porta 5173)
npx tsc --noEmit               # Typecheck frontend

# Mobile
cd mobile
npm install --legacy-peer-deps
npx expo start                 # Dev server
npx expo start --clear         # Limpar cache
npx expo run:android           # Build Android
npx expo run:ios               # Build iOS

# Testes
npm test                       # Backend (32 testes)
cd frontend && npm test        # Frontend (5 testes)
```

---

## 12. REGISTRAR SKILL

Para registrar esta skill no opencode, adicionar em `opencode.json`:

```json
{
  "skills": {
    "help-desk": {
      "path": ".claude/skills/HELP-DESK/SKILL.MD"
    }
  }
}
```

Ou usar o comando:
```
/opencode add-skill help-desk .claude/skills/HELP-DESK/SKILL.MD
```

---

## 13. QUANDO USAR ESTA SKILL

- **Qualquer tarefa de desenvolvimento** neste projeto
- **Bug fix** — consultar secao 7 (APIs) e 4 (Schema)
- **Nova feature** — consultar secao 6 (Routes) e 8 (Frontend)
- **Schema change** — consultar secao 4 e rodar `npx prisma db push`
- **Mobile** — consultar secao 9
- **Duvida sobre auth** — consultar secao 5
- **Commits** — consultar secao 10 (Regras de Ouro)
- **Configuracao** — consultar secao 3 (Estrutura)

**Esta e a skill UNICA de referencia para todo o projeto CodeHelp.**
