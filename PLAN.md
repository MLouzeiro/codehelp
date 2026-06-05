# PLAN.md

## Sprint 1 — Fundação: servidores rodam e login JWT retorna tokens
> Critério: `npm run dev` inicia ambos os servidores; `curl POST /api/auth/login` com credenciais válidas retorna 200 + `{ accessToken, refreshToken, user }`

### Fase 1 — Projeto Base + Configuração de Ambiente
> Dependências: nenhuma
> Paralelismo: Tasks 1.2 e 1.3 rodam em paralelo após 1.1

#### Task 1.1 — Scaffold do monorepo e dependências
- Agent: Tech Lead
- Input: SPEC.md seção Stack, AGENTS.md seção Comandos principais
- Output:
  - `/package.json` (raiz) — scripts `dev`, `dev:backend`, `dev:frontend`, `build`, `db:migrate`, `db:push`, `db:seed`, `db:studio`, dependência `concurrently`
  - `/backend/package.json` — dependências: `express`, `@prisma/client`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`, `express-rate-limit`, `zod`; devDeps: `typescript`, `tsx`, `prisma`, `@types/*`
  - `/frontend/package.json` — dependências: `react`, `react-dom`, `react-router-dom`, `axios`, `recharts`, `lucide-react`; devDeps: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `@types/react`, `@types/react-dom`
  - `/backend/tsconfig.json` — target ES2022, module NodeNext, strict true, outDir dist
  - `/frontend/tsconfig.json` — target ES2020, jsx react-jsx, strict true
  - `/frontend/vite.config.ts` — plugin react, server porta 5173, proxy `/api` → `http://localhost:3001`
  - `/frontend/tailwind.config.js` — content `./src/**/*.{ts,tsx}`, theme extend (cores corporativas)
  - `/frontend/postcss.config.js` — plugins tailwindcss + autoprefixer
  - `/frontend/index.html` — div#root, Google Fonts Inter, title "Codemed CRM"
  - `/.env.example` — variáveis `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `APP_URL`
- Testes críticos:
  - [ ] `npm install` na raiz executa sem erros e instala dependências de backend e frontend via `postinstall`
  - [ ] `npm run dev:backend` inicia servidor na porta 3001 e `GET /api/health` retorna `{"status":"ok"}`

#### Task 1.2 — Prisma Schema + Config Backend
- Agent: Backend Dev
- Input: Task 1.1 concluída (package.json, tsconfig existem)
- Output:
  - `backend/prisma/schema.prisma` — 3 modelos:
    - `User` (id uuid, name, email unique, password, role default "vendedor", phone?, active default true, createdAt, updatedAt; relations clients Client[], tasks Task[])
    - `Client` (id uuid, name, email?, phone?, company?, sellerId, seller User via sellerId, createdAt, updatedAt)
    - `Task` (id uuid, title, description?, status default "aberta", priority default "media", order Int?, project?, dueDate DateTime?, assigneeId?, assignee User? via assigneeId, createdAt, updatedAt)
  - `backend/src/config/env.ts` — exporta `env` com port, databaseUrl, jwtSecret, jwtRefreshSecret, jwtExpiresIn, jwtRefreshExpiresIn, appUrl (todos com fallback via `process.env`)
  - `backend/src/config/database.ts` — exporta `PrismaClient` singleton
  - `backend/src/shared/middleware/auth.middleware.ts` — exporta `AuthRequest` (interface com `user?: { id, email, role }`), `authenticate` (extrai Bearer token, verifica JWT, injeta `req.user`), `authorize(...roles)` (verifica se `req.user.role` está em roles)
  - `backend/src/shared/middleware/error.middleware.ts` — exporta `errorHandler` (captura erros, loga, retorna `{ error }` com status 500)
  - `backend/src/server.ts` — cria Express app, CORS, JSON parser, rate limiter login (5/hora), monta rotas `/api/auth`, `/api/users`, `/api/clients`, `/api/tasks`, `/api/kanban`, `/api/dashboard`, health check, error handler, conecta Prisma, listen na porta `env.port`
- Testes críticos:
  - [ ] `npx prisma db push` executa sem erros e cria as tabelas User, Client, Task no SQLite
  - [ ] Servidor inicia com `npm run dev:backend` e `curl GET /api/health` responde 200

#### Task 1.3 — Setup Frontend (Vite + Tailwind + Router + Axios)
- Agent: Frontend Dev
- Input: Task 1.1 concluída (package.json, vite.config, tailwind.config existem)
- Output:
  - `frontend/src/main.tsx` — `ReactDOM.createRoot`, renderiza `<App />` dentro de `<BrowserRouter>`
  - `frontend/src/index.css` — `@tailwind base/components/utilities`, estilo global mínimo
  - `frontend/src/App.tsx` — `<Routes>` com `<Route>`s placeholder para Login, Dashboard, Clients, Kanban, Users; rota / redireciona para /login
  - `frontend/src/types/index.ts` — interfaces `User` (id, name, email, role), `Client` (id, name, email, phone, company, sellerId, seller, createdAt), `Task` (id, title, description, status, priority, order, project, dueDate, assigneeId, assignee, createdAt), `AuthResponse` (accessToken, refreshToken, user), `LoginCredentials` (email, password), `DashboardData` (totalClients, pendingTasks, completedTasks, tasksByPeriod, tasksByStatus)
  - `frontend/src/services/api.ts` — instância axios `baseURL: "/api"`, interceptor de response 401 → tenta refresh → retry
- Testes críticos:
  - [ ] `npm run dev:frontend` inicia Vite na porta 5173 sem erros de compilação
  - [ ] Acessar http://localhost:5173 redireciona para /login (sem erros de console)

### Fase 2 — Backend: Auth + Users
> Dependências: Fase 1 (server.ts rodando, schema Prisma aplicado)
> Paralelismo: Tasks 2.2 e 2.3 dependem de 2.1; 2.2 e 2.3 são sequenciais (users depende do middleware de auth)

#### Task 2.1 — Módulo Auth (login, refresh, me, rate limit)
- Agent: Backend Dev
- Input: Task 1.2 concluída (Prisma schema, auth middleware, server.ts)
- Output:
  - `backend/src/modules/auth/auth.controller.ts` — 3 funções exportadas:
    - `login(req: Request, res: Response)` — valida email+password no body, busca user por email no Prisma, bcrypt.compare, gera accessToken (15min) + refreshToken (7d) via `jwt.sign`, retorna `{ accessToken, refreshToken, user: { id, name, email, role } }`
    - `refreshToken(req: Request, res: Response)` — valida refreshToken no body, jwt.verify com jwtRefreshSecret, busca user por id, checa active, gera novos tokens, retorna `{ accessToken, refreshToken }`
    - `me(req: AuthRequest, res: Response)` — retorna `req.user`
  - `backend/src/modules/auth/auth.routes.ts` — `POST /login` (sem authenticate), `POST /refresh` (sem authenticate), `GET /me` (com authenticate)
- Testes críticos:
  - [ ] `POST /api/auth/login` com `{ email: "admin@codemed.com.br", password: "admin123" }` retorna 200 com accessToken, refreshToken e user
  - [ ] `POST /api/auth/login` com senha inválida retorna 401 `{ error: "Credenciais inválidas" }`

#### Task 2.2 — Módulo Users (CRUD admin-only)
- Agent: Backend Dev
- Input: Task 2.1 concluída (auth middleware, auth controller)
- Output:
  - `backend/src/modules/users/users.controller.ts` — 5 funções exportadas:
    - `listUsers(req: AuthRequest, res: Response)` — `prisma.user.findMany()` com select sem password, suporta `?active=true/false`, retorna `{ users, total }`
    - `getUser(req: AuthRequest, res: Response)` — `prisma.user.findUnique()` por id, retorna 404 se não encontrado
    - `createUser(req: AuthRequest, res: Response)` — valida name, email, password, role no body; bcrypt.hash(password, 12); `prisma.user.create()`; retorna 201 com user (sem password)
    - `updateUser(req: AuthRequest, res: Response)` — se password presente no body, faz hash; `prisma.user.update()`; retorna user atualizado
    - `deleteUser(req: AuthRequest, res: Response)` — não deleta, apenas seta `active: false` (soft delete); retorna 204
  - `backend/src/modules/users/users.routes.ts` — todas as rotas com `authenticate` + `authorize('admin')`
- Testes críticos:
  - [ ] `POST /api/users` com token admin cria usuário e retorna 201
  - [ ] `POST /api/users` com token de vendedor retorna 403 `{ error: "Sem permissão para esta ação" }`

### Fase 3 — Frontend: Autenticação + Layout Base
> Dependências: Fase 2 (backend auth funcional)
> Paralelismo: Task 3.3 depende de 3.1; 3.2 é independente de 3.1 e 3.3

#### Task 3.1 — Auth Context + Axios Interceptor
- Agent: Frontend Dev
- Input: Task 1.3 concluída (api.ts, types, App.tsx existem)
- Output:
  - `frontend/src/services/auth.tsx` — exporta:
    - `AuthProvider` (componente) — estado `user`, `loading`, `error`; função `login(email, password)` que chama POST /api/auth/login e salva tokens no localStorage; função `logout()` que limpa tokens e seta user null; função `refreshToken()` que chama POST /api/auth/refresh e atualiza tokens
    - `useAuth()` — hook que retorna `{ user, loading, error, login, logout }`
    - Interceptor de response no `api.ts`: se status 401 e não for rota de auth, tenta refresh automático e retry da request original
- Testes críticos:
  - [ ] `login("admin@codemed.com.br", "admin123")` seta `user` no estado do AuthProvider com role "admin"
  - [ ] `login` com credenciais inválidas retorna `error` sem setar `user`

#### Task 3.2 — Página de Login
- Agent: Frontend Dev
- Input: Task 1.3 concluída (App.tsx com rota /login existente)
- Output:
  - `frontend/src/pages/Login.tsx` — formulário com campos email e password, botão "Entrar", estado de loading e erro, chama `login()` do useAuth, redireciona para `/app/dashboard` no sucesso, exibe toast/alert em caso de erro; design responsivo (centralizado, card max-w-md)
- Testes críticos:
  - [ ] Submeter formulário com credenciais inválidas exibe mensagem de erro "Credenciais inválidas"
  - [ ] Submeter formulário com credenciais válidas redireciona para `/app/dashboard`

#### Task 3.3 — Layout + PrivateRoute + App Routing
- Agent: Frontend Dev
- Input: Tasks 3.1 e 3.2 concluídas (auth context, Login page)
- Output:
  - `frontend/src/components/Layout/Layout.tsx` — sidebar colapsável com links: Dashboard, Clientes, Kanban, Usuários (admin apenas); header com nome do usuário e botão de logout; `<Outlet />` para renderizar páginas filhas
  - `frontend/src/components/Layout/index.ts` — re-export
  - Atualização de `frontend/src/App.tsx` — PrivateRoute (verifica `useAuth().user`, redireciona para /login se não autenticado), Layout como pai das rotas protegidas
- Testes críticos:
  - [ ] Usuário não autenticado acessando `/app/dashboard` é redirecionado para `/login`
  - [ ] Sidebar exibe link "Usuários" apenas para admin; vendedor não vê

---

## Sprint 2 — Clientes e Kanban operacionais
> Critério: vendedor cadastra cliente via UI e move tarefa entre colunas do kanban com persistência

### Fase 4 — Backend: Clients + Tasks/Kanban
> Dependências: Fase 2 (auth middleware, Prisma schema ativo)
> Paralelismo: Tasks 4.1 e 4.2 são independentes (tocam arquivos diferentes: clients/ vs tasks/)

#### Task 4.1 — Módulo Clients (CRUD com isolamento vendedor)
- Agent: Backend Dev
- Input: Task 2.1 concluída (auth middleware, schema com Client model)
- Output:
  - `backend/src/modules/clients/clients.controller.ts` — 5 funções exportadas:
    - `listClients(req: AuthRequest, res: Response)` — aceita `?search=`, `?page=`, `?limit=`; se role vendedor, filtra `where.sellerId = req.user.id`; OR busca por name/email/company com contains insensitive; paginação com skip/take; retorna `{ clients, total, page, totalPages }`
    - `getClient(req: AuthRequest, res: Response)` — busca por id; se vendedor e sellerId !== req.user.id, retorna 403
    - `createClient(req: AuthRequest, res: Response)` — valida name obrigatório; se vendedor, força `sellerId = req.user.id`; retorna 201
    - `updateClient(req: AuthRequest, res: Response)` — busca existente; se vendedor e sellerId !== req.user.id, 403; atualiza e retorna
    - `deleteClient(req: AuthRequest, res: Response)` — busca existente; somente admin via middleware `authorize('admin')`; retorna 204
  - `backend/src/modules/clients/clients.routes.ts` — GET /, GET /:id, POST /, PUT /:id, DELETE /:id; todas com authenticate; DELETE com authorize('admin')
- Testes críticos:
  - [ ] Vendedor cria cliente com `POST /api/clients` → cliente fica com `sellerId` igual ao id do vendedor (ignorando `sellerId` enviado no body)
  - [ ] Vendedor tenta listar clientes de outro vendedor via `GET /api/clients` → retorna apenas seus próprios clientes (filtro automático)

#### Task 4.2 — Módulo Tasks/Kanban (CRUD + reorder + board)
- Agent: Backend Dev
- Input: Task 2.1 concluída (auth middleware, schema com Task model)
- Output:
  - `backend/src/modules/tasks/tasks.controller.ts` — 6 funções exportadas:
    - `listTasks(req: AuthRequest, res: Response)` — aceita `?status=`, `?assigneeId=`, `?project=`, `?page=`, `?limit=`; se vendedor, filtra `where.assigneeId = req.user.id`; retorna `{ tasks, total }`
    - `createTask(req: AuthRequest, res: Response)` — valida title obrigatório; se vendedor, força `assigneeId = req.user.id`; calcula próxima ordem (max + 1); retorna 201
    - `updateTask(req: AuthRequest, res: Response)` — atualiza por id; retorna task atualizada
    - `deleteTask(req: AuthRequest, res: Response)` — somente admin via authorize('admin'); retorna 204
    - `reorderTasks(req: AuthRequest, res: Response)` — recebe `{ items: [{ id, order, status }] }`; executa `prisma.$transaction` com updates em lote
    - `getKanbanBoard(req: AuthRequest, res: Response)` — aceita `?project=`, `?assigneeId=`; busca tasks ordenadas por order; agrupa em `{ aberta, em_andamento, concluida, cancelada }` com items em cada grupo; retorna board object
  - `backend/src/modules/tasks/tasks.routes.ts` — GET /, POST /, PUT /:id, DELETE /:id, PATCH /reorder, GET /board; DELETE com authorize('admin')
- Testes críticos:
  - [ ] Vendedor cria task com `POST /api/tasks` → `assigneeId` é forçado para o id do vendedor (ignorando `assigneeId` do body)
  - [ ] `PATCH /api/tasks/reorder` com `{ items: [{ id, order: 1, status: "em_andamento" }] }` persiste novo order e status no banco

### Fase 5 — Frontend: Páginas de Clientes + Kanban
> Dependências: Fase 4 (endpoints clients e tasks operacionais)
> Paralelismo: Tasks 5.1 e 5.2 são independentes (tocam arquivos em diretórios diferentes: pages/Clients/ vs pages/Kanban/)

#### Task 5.1 — Páginas de Clientes (listagem, formulário, detalhe)
- Agent: Frontend Dev
- Input: Tasks 3.3 e 4.1 concluídas (Layout com sidebar, API clients funcional)
- Output:
  - `frontend/src/pages/Clients/ClientList.tsx` — tabela com colunas Nome, Email, Telefone, Empresa, Vendedor (admin vê), ações (editar/deletar); campo de busca textual com debounce; paginação; botão "Novo Cliente"; modal de confirmação para deletar
  - `frontend/src/pages/Clients/ClientForm.tsx` — formulário com campos name (obrigatório), email, phone, company; modo criação e edição detectado por parâmetro `id` na URL; validação client-side; redireciona para /app/crm após salvar
  - `frontend/src/pages/Clients/ClientDetail.tsx` — exibe dados completos do cliente; ações editar e deletar; breadcrumb
  - Rotas em App.tsx: `/app/crm` → ClientList, `/app/crm/new` → ClientForm, `/app/crm/:id` → ClientDetail, `/app/crm/:id/edit` → ClientForm
- Testes críticos:
  - [ ] Vendedor cadastra cliente via formulário → cliente aparece na listagem com nome e empresa
  - [ ] Admin vê coluna "Vendedor" na tabela; vendedor não vê essa coluna

#### Task 5.2 — Página Kanban com Drag-and-Drop Nativo
- Agent: Frontend Dev
- Input: Tasks 3.3 e 4.2 concluídas (Layout com sidebar, API tasks/board funcional)
- Output:
  - `frontend/src/components/KanbanBoard/KanbanBoard.tsx` — 4 colunas (A fazer, Em andamento, Concluído, Cancelado) em layout horizontal scrollável; cada coluna lista cards da task; drag-and-drop via HTML5 native Drag API (ondragstart, ondrop, ondragover); ao soltar card em nova coluna, chama `PATCH /api/tasks/reorder` com novo status e ordem
  - `frontend/src/components/KanbanBoard/KanbanCard.tsx` — card com título, prioridade (cores), responsável, data de vencimento; draggable
  - `frontend/src/pages/Kanban/KanbanPage.tsx` — busca board via `GET /api/tasks/board`; renderiza KanbanBoard; filtros por projeto e responsável no topo
  - Rotas em App.tsx: `/app/kanban` → KanbanPage
- Testes críticos:
  - [ ] Card arrastado da coluna "A fazer" para "Em andamento" persiste o novo status após reload da página
  - [ ] Tarefa recém-criada aparece automaticamente na coluna "A fazer" sem refresh manual

---

## Sprint 3 — Dashboard e fechamento
> Critério: dashboard reflete dados reais do banco, diferenciados por perfil; seed `npm run db:seed` popula dados de teste

### Fase 6 — Dashboard (backend + frontend)
> Dependências: Fases 4 e 5 (módulos clients e tasks operacionais)
> Paralelismo: Tasks 6.1 e 6.2 são sequenciais (frontend depende do endpoint)

#### Task 6.1 — Módulo Dashboard (KPIs + gráficos)
- Agent: Backend Dev
- Input: Fase 4 concluída (controllers de clients e tasks existem)
- Output:
  - `backend/src/modules/dashboard/dashboard.controller.ts` — 1 função exportada:
    - `getDashboard(req: AuthRequest, res: Response)` — calcula:
      - `totalClients`: `prisma.client.count()` (se admin) ou com filtro `where.sellerId = req.user.id` (se vendedor)
      - `pendingTasks`: `prisma.task.count()` onde status IN ["aberta", "em_andamento"] (com filtro assigneeId se vendedor)
      - `completedTasks`: `prisma.task.count()` onde status = "concluida" (com filtro assigneeId se vendedor)
      - `tasksByStatus`: agregação count agrupado por status
      - `tasksByPeriod`: count de tasks concluídas agrupadas por mês (últimos 6 meses)
    - Retorna `{ totalClients, pendingTasks, completedTasks, tasksByStatus: [{ status, count }], tasksByPeriod: [{ month, count }] }`
  - `backend/src/modules/dashboard/dashboard.routes.ts` — `GET /` com authenticate
- Testes críticos:
  - [ ] `GET /api/dashboard` com token admin retorna totalClients contando todos os registros
  - [ ] `GET /api/dashboard` com token vendedor retorna pendingTasks contando apenas tasks onde assigneeId = vendedor

#### Task 6.2 — Página Dashboard (cards + gráficos Recharts)
- Agent: Frontend Dev
- Input: Task 6.1 concluída (endpoint GET /api/dashboard funcional)
- Output:
  - `frontend/src/pages/Dashboard/Dashboard.tsx` — 3 cards no topo (Total Clientes, Tarefas Pendentes, Tarefas Concluídas) com valores numéricos e ícones Lucide; abaixo: gráfico de barras (tasks por mês) via Recharts `<BarChart>` + `<Bar>`; gráfico de pizza (tasks por status) via Recharts `<PieChart>` + `<Pie>`; busca dados via `GET /api/dashboard` no mount
  - Rota em App.tsx: `/app/dashboard` → Dashboard (já deve existir como rota index)
- Testes críticos:
  - [ ] Card "Total Clientes" exibe o número correto de clientes conforme o perfil logado (admin vê total global, vendedor vê apenas seus clientes)
  - [ ] Gráfico de pizza renderiza 4 fatias (aberta, em_andamento, concluida, cancelada) sem dados mockados

### Fase 7 — Seed + Testes de Aceitação
> Dependências: Fases 2 a 6 completas
> Paralelismo: Tasks 7.1 e 7.2 são sequenciais (testes dependem do seed)

#### Task 7.1 — Seed de dados
- Agent: QA
- Input: Fase 6 concluída (todos os módulos implantados)
- Output:
  - `backend/prisma/seed.ts` — população:
    - Admin: email `admin@codemed.com.br`, password `admin123` hasheado com bcrypt cost 12, role `admin`
    - Vendedor: email `vendedor@codemed.com.br`, password `admin123`, role `vendedor`
    - 2 clientes do vendedor (Lab Saúde Total, Análise Clínica ABC)
    - 4 tarefas: 1 concluída, 1 em_andamento, 2 abertas (uma sem assignee)
  - Deve ser idempotente (verifica se admin já existe antes de criar)
- Testes críticos:
  - [ ] `npm run db:seed` executa sem erros e seed é idempotente (rodar 2x não duplica registros)
  - [ ] Admin consegue logar com `admin@codemed.com.br` / `admin123` e vê 2 clientes + 4 tarefas no dashboard

#### Task 7.2 — Testes de aceitação automatizados
- Agent: QA
- Input: Task 7.1 concluída (seed populado)
- Output:
  - Script de teste de fumaça via bash/curl ou script Node:
    1. `POST /api/auth/login` admin → extrai token → `GET /api/users` → 200 com lista
    2. `POST /api/auth/login` admin → `POST /api/clients` com sellerId de outro user → sellerId é ignorado e assume o admin
    3. `POST /api/auth/login` vendedor → `POST /api/tasks` com assigneeId de outro user → assigneeId é ignorado e assume o vendedor
    4. `POST /api/auth/login` vendedor → `DELETE /api/clients/:id` → 403
    5. `POST /api/auth/login` vendedor → `GET /api/clients` → apenas 2 clientes (filtro sellerId)
    6. `POST /api/auth/login` admin → `GET /api/dashboard` → totalClients = 2, pendingTasks ≥ 2, completedTasks ≥ 1
- Testes críticos:
  - [ ] Script de teste executa todos os 6 cenários sem falhas
  - [ ] Cada cenário falha com mensagem clara se o comportamento esperado não for atendido

---

## Paralelismo entre fases

| Fase | Paralelismo interno | Agents necessários |
|------|---------------------|-------------------|
| Fase 1 | 1.2 e 1.3 rodam em paralelo após 1.1 | Tech Lead, Backend Dev, Frontend Dev |
| Fase 2 | Tasks sequenciais (2.1 → 2.2) | Backend Dev |
| Fase 3 | 3.1 → 3.2 e 3.3 (3.2 e 3.3 paralelos após 3.1) | Frontend Dev |
| Fase 4 | 4.1 e 4.2 rodam em paralelo | 2× Backend Dev |
| Fase 5 | 5.1 e 5.2 rodam em paralelo | 2× Frontend Dev |
| Fase 6 | Sequencial (6.1 → 6.2) | Backend Dev, Frontend Dev |
| Fase 7 | Sequencial (7.1 → 7.2) | QA |

## Total de agents necessários: 6

| Agent | Fases |
|-------|-------|
| Tech Lead | Fase 1 |
| Backend Dev (1) | Fases 1, 2, 4, 6 |
| Backend Dev (2) | Fase 4 (paralelo) |
| Frontend Dev (1) | Fases 1, 3, 5, 6 |
| Frontend Dev (2) | Fase 5 (paralelo) |
| QA | Fase 7 |

**Pico de paralelismo:** Fase 1 (3 agents simultâneos) e Fase 4/5 (2 agents cada).
**Duração estimada:** 7 fases × 1 iteração = 7 ciclos, podendo ser reduzido para 5 ciclos com paralelismo máximo.
