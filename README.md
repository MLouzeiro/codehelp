# Codemed Hub

Sistema centralizado de Helpdesk, CRM, OS Digital, WhatsApp Nativo e Dashboard IA para a **Codemed — Desenvolvimento de Software Laboratorial**.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Recharts |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Banco | PostgreSQL 16 |
| Cache | Redis + node-cron |
| WhatsApp | whatsapp-web.js (nativo) |
| PDF | PDFKit |
| Auth | JWT (access 15min + refresh 7d) + bcrypt |
| Deploy | Docker Compose / Vercel |

## Funcionalidades

### Auth & Seguranca
- Login com JWT (accessToken 15min + refreshToken 7 dias)
- 5 perfis: admin, gerente, tecnico, comercial, vendedor
- Rate limiting (5 tentativas/hora no login)
- Multi-departamento (suporte-tecnico, comercial, desenvolvimento, demandas-internas)

### CRM
- CRUD completo de clientes
- Busca global com debounce
- Filtros por status, segmento, cidade, responsavel
- Timeline de interacoes por cliente
- Pipeline de oportunidades (kanban visual)
- Anti-duplicidade (CNPJ/CPF)

### Helpdesk / OS
- Kanban com abas por departamento + vista unificada
- Visual estilo Trello (borda por prioridade, hover lift, badge de departamento)
- Escalonamento automatico (N1 -> N2 -> Supervisor)
- Filas configuraveis com proxima fila
- Suporte multi-departamento (usuario pertence a N departamentos)
- Geracao automatica de numero (OS-YYYY-NNNN)
- Fluxo de assinatura digital via WhatsApp
- PDF gerado automaticamente apos assinatura
- Busca global (clientes, tickets, usuarios, base de conhecimento)
- Links bidirecionais CRM <-> Helpdesk

### WhatsApp Nativo
- Multi-connexoes (varios numeros)
- Conecta via QR Code (whatsapp-web.js)
- Recebe mensagens automaticamente -> cria tickets
- Menu por departamento (resposta numerica)
- Roteamento automatico por conexao

### Dashboard IA
- 8 cards de KPIs: chamados, TMR, TMRes, OS, clientes
- 5 graficos: linha, pizza, barra, area, pipeline
- Insights automaticos via Claude API (Anthropic)
- Filtro por periodo

### Kanban de Tarefas
- Drag & drop entre colunas
- Prioridades: baixa, media, alta, urgente
- Projetos e sprints

### Alertas Semanais
- Cron: toda segunda-feira as 08:00 (America/Fortaleza)
- Relatorio completo via WhatsApp
- Destinatarios configuraveis

### Busca Global
- Busca fuzzy across clientes, tickets, usuarios e base de conhecimento
- Sistema de scoring por relevancia
- Sugestoes instantaneas

---

## Instalacao

### Windows (recomendado)

Veja o guia completo em [INSTALL.md](./INSTALL.md).

**Resumo rapido:**

```cmd
git clone <url> code-help
cd code-help
setup.bat
dev.bat
```

Acesse: http://localhost:3000

### Docker

```cmd
# Apenas infraestrutura (PostgreSQL + Redis)
docker-compose -f docker-compose.dev.yml up -d

# Stack completa (PG + Redis + Backend + Frontend)
docker-compose up -d --build
```

### Comandos Disponiveis

| Script | Descricao |
|--------|-----------|
| `setup.bat` | Setup inicial completo |
| `dev.bat` | Modo desenvolvimento |
| `build.bat` | Build para producao |
| `start.bat` | Iniciar em producao |
| `db.bat` | Gerenciar banco de dados |

---

## Credenciais Padrao

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@codemed.com.br | admin123 | Admin (master) |
| ana@codemed.com.br | tecnico123 | Gerente |
| joao@codemed.com.br | tecnico123 | Tecnico |
| maria@codemed.com.br | tecnico123 | Tecnica |
| pedro@codemed.com.br | tecnico123 | Comercial |

> Altere as senhas apos o primeiro login em producao!

---

## Portas

| Porta | Servico | URL |
|-------|---------|-----|
| 3000 | Frontend (Vite) | http://localhost:3000 |
| 3010 | Backend (Express) | http://localhost:3010 |
| 5432 | PostgreSQL | localhost:5432 |
| 5555 | Prisma Studio | http://localhost:5555 |
| 6379 | Redis | localhost:6379 |

---

## Estrutura do Projeto

```
code-help/
├── backend/
│   ├── prisma/              # Schema + migrations + seed
│   ├── src/
│   │   ├── config/          # database.ts, env.ts, redis.ts
│   │   ├── modules/         # auth, crm, helpdesk, kanban, search, etc.
│   │   ├── shared/          # middleware (auth, error, ticketAccess)
│   │   └── server.ts        # Entry point
│   └── dist/                # Build (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, SearchBar, KanbanBoard
│   │   ├── pages/           # Login, Dashboard, CRM, Helpdesk, Settings, WhatsApp
│   │   ├── services/        # api.ts, auth.tsx, useTheme.ts
│   │   └── types/           # TypeScript interfaces
│   └── dist/                # Build (gitignored)
├── docker-compose.yml       # Stack completa (producao)
├── docker-compose.dev.yml   # Infra apenas (desenvolvimento)
├── setup.bat                # Setup Windows
├── dev.bat                  # Desenvolvimento
├── build.bat                # Build producao
├── db.bat                   # Gerenciar banco
└── INSTALL.md               # Guia de instalacao completo
```

---

## Seguranca

- JWT com tokens curtos (15min) + refresh token (7 dias)
- Senhas com bcrypt (salt rounds: 12)
- Rate limiting nas rotas de login
- Auditoria: todas as acoes criticas registradas
- RBAC: admin, gerente, tecnico, comercial, vendedor
- Multi-departamento com visibilidade por fila
- OS assinada nao pode ser editada
- Link de assinatura expira em 7 dias
- Soft delete (clientes, tarefas, KB) com opcao de restaurar
- Anti-duplicidade (CNPJ/CPF) no CRM

---

**Desenvolvido para:** Codemed — Desenvolvimento de Software Laboratorial
