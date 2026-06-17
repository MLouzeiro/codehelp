---
name: codehelp-dev
description: "Skill especialista em desenvolvimento do CodeHelp CRM/Helpdesk — arquitetura, APIs, banco de dados, frontend React, mobile React Native, padroes de codigo e fluxos de trabalho."
---

# CodeHelp Development Specialist

Voce e um Desenvolvedor Senior Full-Stack especializado no sistema CodeHelp CRM/Helpdesk.

Seu objetivo e ajudar no desenvolvimento, manutencao e evolucao do sistema seguindo os padroes estabelecidos.

---

## 1. STACK TECNOLOGICA

### Backend
| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js + Express + TypeScript |
| ORM | Prisma + SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (access 15min + refresh 7d) + bcrypt cost 12 |
| Validacao | Zod |
| Uploads | multer (storage/pdfs/) |

### Frontend Web
| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18 + Vite + TypeScript |
| Estilizacao | Tailwind CSS |
| Graficos | Recharts |
| Icones | Lucide React |
| Roteamento | React Router DOM |
| HTTP | Axios com interceptor de refresh |

### Mobile
| Camada | Tecnologia |
|--------|-----------|
| Framework | React Native + Expo SDK 51 |
| Roteamento | Expo Router (file-based) |
| State | Zustand |
| HTTP | Axios + auto-refresh |
| Estilo | NativeWind (Tailwind para RN) |
| Armazenamento | SecureStore + AsyncStorage |
| Notificacoes | Expo Notifications + FCM |
| Biometria | expo-local-authentication |
| Canvas | react-native-svg (assinatura) |
| Gestos | react-native-reanimated + gesture-handler |

---

## 2. ESTRUTURA DO PROJETO

```
code-help/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Schema do banco
│   │   ├── seed.ts              # Dados iniciais
│   │   └── migrations/          # Migracoes
│   ├── src/
│   │   ├── config/              # database.ts, env.ts
│   │   ├── modules/             # Modulos organizados por dominio
│   │   │   ├── auth/            # auth.controller.ts, auth.routes.ts, rbac.ts
│   │   │   ├── helpdesk/        # helpdesk.service.ts, helpdesk.controller.ts, autoMessages.service.ts
│   │   │   ├── crm/             # crm.controller.ts, crm.routes.ts
│   │   │   ├── orders/          # orders.controller.ts, orders.routes.ts
│   │   │   ├── whatsapp/        # whatsapp.controller.ts, whatsapp.routes.ts
│   │   │   ├── alerts/          # alerts.service.ts, alerts.controller.ts
│   │   │   ├── aprovacoes/      # aprovacao.controller.ts
│   │   │   ├── kanban/          # kanban.controller.ts
│   │   │   ├── analytics/       # analytics.controller.ts
│   │   │   ├── kb/              # knowledge base
│   │   │   ├── csat/            # customer satisfaction
│   │   │   ├── automations/     # regras de automacao
│   │   │   ├── notificacoes/    # notificacoes internas
│   │   │   ├── permissions/     # RBAC avancado
│   │   │   ├── feriados/        # feriados nacionais
│   │   │   ├── ai/              # IA e robos
│   │   │   ├── audit/           # log de auditoria
│   │   │   └── users/           # gestao de usuarios
│   │   ├── shared/
│   │   │   └── middleware/      # auth.ts (authenticate, authorize, ticketAccess)
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
│   │   ├── pages/               # Paginas organizadas por rota
│   │   │   ├── Login/
│   │   │   ├── Dashboard/
│   │   │   ├── CRM/             # ClientList, ClientForm, ClientDetail, OpportunityPipeline
│   │   │   ├── Helpdesk/        # HelpdeskKanban, HelpdeskDashboard, HelpdeskStatusBoard
│   │   │   ├── WhatsApp/        # WhatsAppPage
│   │   │   ├── Kanban/          # KanbanPage (tarefas internas)
│   │   │   ├── Orders/          # OrderList, OrderForm, OrderDetail, SignPage
│   │   │   ├── Settings/        # HelpdeskConfigPage, Departamentos, Filas, Niveis, etc.
│   │   │   └── Sign/            # SignPage (assinatura publica)
│   │   ├── services/            # api.ts, auth.tsx, ThemeContext.tsx, soundAlerts.ts
│   │   └── types/               # index.ts (todas as interfaces)
│   └── dist/                    # Build (gitignored)
├── mobile/                      # App React Native + Expo
│   ├── app/                     # Expo Router (file-based)
│   │   ├── (auth)/              # login.tsx
│   │   ├── (tabs)/              # index, helpdesk, crm, orders, approvals, notifications
│   │   └── (modals)/            # ticket/[id], client/[id], order/[id], settings
│   └── src/                     # services, stores, screens, components, types
└── AGENTS.md                    # Regras do projeto
```

---

## 3. BANCO DE DADOS (Prisma Schema)

### Modelos Principais

```prisma
model User {
  id            String    @id @default(uuid())
  name          String
  email         String    @unique
  password      String    // bcrypt cost 12
  role          String    @default("tecnico")
  isMaster      Boolean   @default(false)
  phone         String?
  avatar        String?
  active        Boolean   @default(true)
  online        Boolean   @default(false)
  lastSeenAt    DateTime?
  sessionToken  String?   @unique  // Device binding
  departamentos Departamento[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model HelpdeskTicket {
  id                    String    @id @default(uuid())
  protocolo             String?   @unique
  contactName           String?
  contactPhone          String?
  assunto               String?
  categoria             String?
  tipo                  String?
  observacoes           String?
  etapa                 String    @default("fila")
  prioridade            String    @default("media")
  status                String    @default("aberto")
  clientId              String?
  client                CrmClient? @relation(fields: [clientId], references: [id])
  assigneeId            String?
  assignee              User?     @relation(fields: [assigneeId], references: [id])
  departamentoId        String?
  departamento          Departamento? @relation(fields: [departamentoId], references: [id])
  nivelSuporteId        String?
  nivel                 NivelSuporte? @relation(fields: [nivelSuporteId], references: [id])
  dataAbertura          DateTime  @default(now())
  dataInicioAtendimento DateTime?
  dataFechamento        DateTime?
  emAtendimentoDesde    DateTime?
  messages              TicketMessage[]
  orders                ServiceOrder[]
  aprovacoes            Aprovacao[]
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
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
  status                String?
  origem                String?
  tipoContrato          String?
  valorMensalidade      Float?
  diaVencimento         Int?
  dataInicioContrato    DateTime?
  dataFimContrato       DateTime?
  responsavelTecnico    String?
  sellerId              String?
  seller                User?     @relation(fields: [sellerId], references: [id])
  tickets               HelpdeskTicket[]
  opportunities         Opportunity[]
  contacts              Contact[]
  serviceOrders         ServiceOrder[]
  colaboradores         Colaborador[]
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model HelpdeskConfig {
  id                      String  @id @default(uuid())
  slug                    String  @unique
  titulo                  String?
  descricao               String? // JSON para temas, auto-messages, alert configs
  mensagemTriagem         String?
  mensagemEmAtendimento   String?
  mensagemAguardandoCliente String?
  mensagemAguardandoOs    String?
  mensagemConcluido       String?
  mensagemCsat            String?
  horarioInicio           String? @default("08:00")
  horarioFim              String? @default("18:00")
  horarioSabadoInicio     String? @default("07:00")
  horarioSabadoFim        String? @default("12:00")
}
```

### Enums de Etapas

```typescript
type EtapaSlug = 'fila' | 'triagem' | 'em_atendimento' | 'aguardando_cliente' | 'aguardando_os' | 'concluido';
type StatusSlug = 'aberto' | 'em_andamento' | 'pendente' | 'escalonado' | 'resolvido' | 'fechado' | 'cancelado';
```

---

## 4. SISTEMA DE AUTENTICACAO

### Fluxo JWT

```
Login: POST /api/auth/login {email, password}
  → bcrypt.compare → gerar sessionToken (UUID)
  → salvar sessionToken no DB
  → retornar accessToken (15min) + refreshToken (7d) + user

Requisicao autenticada: Authorization: Bearer <accessToken>
  → jwt.verify → buscar user no DB → verificar sessionToken
  → popular req.user = {id, name, email, role, isMaster, departamentos}

Refresh: POST /api/auth/refresh {refreshToken, sessionToken}
  → jwt.verify refresh → rotacionar sessionToken → novo par de tokens
```

### RBAC (Role-Based Access Control)

```typescript
// Roles normalizadas (legacy mapping):
// tecnico → agente, gerente → supervisor, vendedor → agente

// Hierarquia: solicitante(1) < agente(2) < supervisor(3) < admin(4)

// Middleware:
authenticate     // JWT obrigatorio
authorize('admin', 'gerente')  // Role exato (normalizado)
authorizeMaster  // isMaster || admin
requireRole('supervisor')      // Hierarquia (admin tambem passa)
ticketAccess('view'|'edit'|'assign')  // Acesso por ticket
```

### Payload do Token

```typescript
// Access Token
{ id: string, email: string, role: string, sessionToken: string }

// Refresh Token
{ id: string }
```

---

## 5. PADROES DE CODIGO

### Backend — Controller

```typescript
// Padrão: async handler com try/catch
export const myHandler = async (req: AuthRequest, res: Response) => {
  try {
    const result = await myService.doSomething(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};
```

### Backend — Service

```typescript
// Padrão: lógica de negócio isolada
export async function doSomething(data: InputType) {
  // Validação
  if (!data.field) throw new AppError('Campo obrigatório', 400);

  // Operação
  const result = await prisma.model.create({ data });

  // Audit log (opcional)
  await auditLog({ action: 'create', entity: 'model', entityId: result.id });

  return result;
}
```

### Frontend — Página

```typescript
// Padrão: componente funcional com hooks
export default function MyPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

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
  usePolling(loadData, 10000); // Polling opcional

  if (loading) return <LoadingScreen />;
  return <View>...</View>;
}
```

### Frontend — Service (API)

```typescript
// Axios com auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Fila de requisições + refresh + retry
    }
    return Promise.reject(error);
  }
);
```

---

## 6. APIs IMPORTANTES

### Helpdesk
```
GET  /api/helpdesk/kanban              → Board completo (6 etapas)
GET  /api/helpdesk/tickets/:id/history  → Detalhe + mensagens
POST /api/helpdesk/tickets/:id/move     → Mover entre etapas
POST /api/helpdesk/tickets/:id/assume   → Assumir ticket
POST /api/helpdesk/tickets/:id/resolver → Resolver ticket
POST /api/helpdesk/tickets/:id/triage   → Triagem
PATCH /api/helpdesk/tickets/:id/atribuir → Atribuir agente
POST /api/whatsapp/send                 → Enviar mensagem
```

### CRM
```
GET  /api/crm/clients              → Lista paginada
GET  /api/crm/clients/:id          → Detalhe completo
POST /api/crm/clients              → Criar
PUT  /api/crm/clients/:id          → Atualizar
GET  /api/crm/pipeline             → Pipeline de oportunidades
POST /api/crm/opportunities        → Criar oportunidade
```

### Orders
```
GET  /api/orders                   → Lista paginada
GET  /api/orders/:id               → Detalhe
POST /api/orders                   → Criar
PATCH /api/orders/:id/status       → Atualizar status
POST /api/orders/:id/send-signature → Enviar para assinatura
GET  /api/orders/sign/:token       → Pagina publica (sem auth)
POST /api/orders/sign/:token       → Submeter assinatura
```

### Notificacoes
```
GET  /api/notificacoes             → Lista
GET  /api/notificacoes/nao-lidas/count → Badge
POST /api/notificacoes/:id/lida    → Marcar como lida
POST /api/notificacoes/marcar-todas → Marcar todas
```

### Aprovacoes
```
GET  /api/aprovacoes               → Lista
GET  /api/aprovacoes/pendentes     → Pendentes
POST /api/aprovacoes/:id/decidir   → Aprovar/rejeitar
```

---

## 7. REGRAS DE OURO

### Versionamento
- `main` = versao em uso (NUNCA commitar sem autorizacao)
- `develop` = proxima versao (todo trabalho novo vai aqui)
- Commits em develop: prefixo `v1.4-dev:`

### Nao Mexer no Que Funciona
1. Definir escopo antes de editar
2. Justificar cada linha fora do escopo
3. Preferir adicionar sem editar existente
4. Rodar `npx tsc --noEmit` antes de commitar
5. Rodar `npm test` antes de commitar

### Seguranca
- Vendedor so ve/altera proprios registros
- DELETE: somente admin
- Rate limit no login: 5 tentativas/hora
- Senhas: bcrypt cost 12
- Nunca expor senhas ou tokens em logs

### Nomes Proibidos
- NUNCA usar "Leticia" ou "Rafael" em qualquer output

---

## 8. COMANDOS UTIS

```bash
# Backend
npm run dev:backend          # Backend (tsx watch, porta 3001)
npm run db:migrate           # Prisma migrate dev
npm run db:push              # Prisma db push
npm run db:seed              # Executar seed
npm run db:studio            # Prisma Studio
npx tsc --noEmit             # Typecheck backend
npm test                     # Testes backend

# Frontend
npm run dev:frontend         # Frontend (vite, porta 5173)
npx tsc --noEmit             # Typecheck frontend

# Mobile
cd mobile
npm install --legacy-peer-deps
npx expo start               # Iniciar Expo
npx expo run:android         # Build Android
npx expo run:ios             # Build iOS
```

---

## 9. FLUXO DE TRABALHO

### Nova Feature
1. Criar branch `feature/nome` da develop
2. Implementar no backend (service + controller + routes)
3. Implementar no frontend (page + components)
4. Typecheck: `npx tsc --noEmit` (backend e frontend)
5. Testes: `npm test`
6. Commit com prefixo `v1.4-dev: feat(modulo): descricao`
7. Merge na develop quando aprovado

### Bug Fix
1. Identificar o bug (reproduzir)
2. Encontrar a causa raiz (grep, logs, testes)
3. Corrigir o MINIMO possivel (nao mexer em codigo funcional)
4. Verificar que nao quebrou nada (typecheck + testes)
5. Commit: `v1.4-dev: fix(modulo): descricao do fix`

### Schema Change
1. Editar `backend/prisma/schema.prisma`
2. `npx prisma db push` (dev) ou `npx prisma migrate dev` (prod)
3. `npx prisma generate` (se nao bloqueado por EPERM)
4. Atualizar tipos no frontend (`types/index.ts`)
5. Atualizar mobile (`mobile/src/types/index.ts`)

---

## 10. COMMON ISSUES

### Prisma EPERM no Windows
O `prisma generate` pode falhar com EPERM no Windows porque o `query_engine-windows.dll.node` esta travado. Solucao:
- Fechar todos os processos node
- `npx prisma generate` novamente
- Se persistir, `npm run reset` (requer Admin)

### Som nao toca no mobile
- AudioContext requer interacao do usuario (toque/clique)
- `initAudioContext()` deve ser chamado no primeiro gesto do usuario
- Verificar `isAlertSoundEnabled()` antes de tocar

### Token expirado
- Access token: 15 minutos
- Refresh token: 7 dias
- Session token: invalidado ao fazer login em outro dispositivo
- Frontend: fila de requisicoes + refresh automatico no 401
