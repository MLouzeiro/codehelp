# Arquitetura do CRM — Codemed Tecnologia

## Visão Geral
Monorepo com backend em Node.js + Express + Prisma + SQLite e frontend em React + Vite + TypeScript + Tailwind CSS.

## Estrutura de Diretórios

```
crm-kanban/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          # Prisma client
│   │   │   └── env.ts               # Variáveis de ambiente
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.service.ts
│   │   │   ├── users/
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.routes.ts
│   │   │   │   └── users.service.ts
│   │   │   ├── clients/
│   │   │   │   ├── clients.controller.ts
│   │   │   │   ├── clients.routes.ts
│   │   │   │   └── clients.service.ts
│   │   │   ├── tasks/
│   │   │   │   ├── tasks.controller.ts
│   │   │   │   ├── tasks.routes.ts
│   │   │   │   └── tasks.service.ts
│   │   │   └── dashboard/
│   │   │       ├── dashboard.controller.ts
│   │   │       └── dashboard.routes.ts
│   │   ├── shared/
│   │   │   └── middleware/
│   │   │       ├── auth.middleware.ts   # JWT verification
│   │   │       └── error.middleware.ts  # Global error handler
│   │   └── server.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── KanbanBoard/
│   │   │   │   ├── KanbanColumn.tsx
│   │   │   │   ├── KanbanCard.tsx
│   │   │   │   └── KanbanBoard.tsx
│   │   │   └── ui/
│   │   │       ├── Card.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Table.tsx
│   │   │       └── Badge.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Clients/
│   │   │   │   ├── ClientList.tsx
│   │   │   │   ├── ClientForm.tsx
│   │   │   │   └── ClientDetail.tsx
│   │   │   ├── Kanban/
│   │   │   │   └── KanbanPage.tsx
│   │   │   └── Users/
│   │   │       └── UsersPage.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── auth.tsx
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
│
└── package.json            # Scripts raiz (dev, build)
```

## Schema do Banco de Dados (Prisma)

```prisma
enum Role {
  admin
  vendedor
}

enum TaskStatus {
  aberta
  em_andamento
  concluida
  cancelada
}

enum TaskPriority {
  baixa
  media
  alta
  urgente
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(vendedor)
  phone     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  clients  Client[]
  tasks    Task[]
}

model Client {
  id        String   @id @default(uuid())
  name      String
  email     String?
  phone     String?
  company   String?
  sellerId  String
  seller    User     @relation(fields: [sellerId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Task {
  id            String       @id @default(uuid())
  title         String
  description   String?
  status        TaskStatus   @default(aberta)
  priority      TaskPriority @default(media)
  order         Int?
  project       String?
  dueDate       DateTime?
  assigneeId    String?
  assignee      User?        @relation(fields: [assigneeId], references: [id])
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```

## Rotas da API REST

### Auth
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | /api/auth/login | Login | ❌ |
| POST | /api/auth/refresh | Refresh token | ❌ |
| GET | /api/auth/me | Dados do usuário logado | ✅ |

### Users (admin apenas)
| Método | Rota | Descrição | Role |
|--------|------|-----------|------|
| GET | /api/users | Listar usuários | admin |
| POST | /api/users | Criar usuário | admin |
| PUT | /api/users/:id | Editar usuário | admin |
| DELETE | /api/users/:id | Deletar usuário | admin |

### Clients
| Método | Rota | Descrição | Role |
|--------|------|-----------|------|
| GET | /api/clients | Listar (filtro por search, vendedor) | admin/vendedor |
| GET | /api/clients/:id | Detalhe | admin/vendedor |
| POST | /api/clients | Criar | admin/vendedor |
| PUT | /api/clients/:id | Editar | admin/vendedor |
| DELETE | /api/clients/:id | Deletar | admin |

### Tasks / Kanban
| Método | Rota | Descrição | Role |
|--------|------|-----------|------|
| GET | /api/tasks | Listar (filtro por status, responsavel, projeto) | admin/vendedor |
| GET | /api/kanban/board | Board agrupado por status | admin/vendedor |
| POST | /api/tasks | Criar | admin/vendedor |
| PUT | /api/tasks/:id | Editar (inclui status change) | admin/vendedor |
| DELETE | /api/tasks/:id | Deletar | admin |
| PATCH | /api/tasks/reorder | Reordenar (drag-and-drop) | admin/vendedor |

### Dashboard
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | /api/dashboard/kpis | KPIs (clientes, tarefas pendentes, concluídas) | ✅ |
| GET | /api/dashboard/data | Dados detalhados do dashboard | ✅ |

## Fluxo de Autenticação
1. Usuário envia email + senha → POST /api/auth/login
2. Backend valida e retorna { accessToken (15min), refreshToken (7d), user }
3. Frontend armazena tokens no localStorage
4. Interceptor Axios adiciona Bearer token em toda requisição
5. Se 401, tenta refresh automático com refreshToken
6. Se refresh falhar, redireciona para /login

## Fluxo de Autorização
```
Request → Auth Middleware (JWT verify) → Role Check → Controller → Response
```
- Admin: passa por todas as role checks
- Vendedor: filtros automáticos nos controllers (WHERE sellerId = user.id)

## Decisões Técnicas
| Decisão | Opção | Motivo |
|---------|-------|--------|
| ORM | Prisma | Type-safe, migrations automáticas, SQLite/PostgreSQL |
| Hash | bcrypt (cost 12) | Segurança contra brute force |
| Auth | JWT Stateless | Sem sessão em banco, fácil de escalar |
| UI | Tailwind CSS | Produtividade, design system consistente |
| Charts | Recharts | Simples, Reactivo, bem documentado |
| Drag-drop | Nativo HTML5 | Sem dependência extra para kanban |
| State | Context API | State simples, sem necessidade de Zustand/Redux |
