# 🧠 Codemed Hub

Sistema centralizado de CRM + OS Digital + WhatsApp Nativo + Dashboard IA para a **Codemed — Desenvolvimento de Software Laboratorial**.

## 🚀 Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Recharts |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Banco | PostgreSQL 16 |
| Cache/Fila | Redis + node-cron |
| WhatsApp | whatsapp-web.js (nativo, sem dependência externa) |
| PDF | PDFKit |
| Assinatura | Canvas HTML5 (signature_pad manual) |
| Auth | JWT + Refresh Token + bcrypt |
| Deploy | Docker Compose |

## 📋 Funcionalidades

### ✅ Módulo 1 — Auth
- Login com JWT (accessToken 15min + refreshToken 7 dias)
- 4 perfis: admin, gerente, tecnico, comercial
- Rate limiting (5 tentativas/hora no login)

### ✅ Módulo 2 — CRM
- CRUD completo de clientes
- Busca global com debounce
- Filtros por status, segmento, cidade, responsável
- Timeline de interações por cliente
- Pipeline de oportunidades (kanban visual)
- Histórico de contatos

### ✅ Módulo 3 — Ordem de Serviço (OS)
- Geração automática de número (OS-YYYY-NNNN)
- Fluxo de assinatura digital:
  1. Técnico cria OS → status `rascunho`
  2. Envia link via WhatsApp → status `aguardando_assinatura`
  3. Cliente assina em página pública → status `assinada`
  4. PDF gerado automaticamente
- PDF com: dados do cliente, serviço, técnico, assinatura em canvas
- Proteção: OS assinada não pode ser editada

### ✅ Módulo 4 — WhatsApp Nativo
- Conecta via QR Code (whatsapp-web.js)
- Recebe mensagens automaticamente → cria tickets
- Envia mensagens do sistema
- Cria OS diretamente dos tickets
- Histórico completo de mensagens

### ✅ Módulo 5 — Dashboard IA
- 8 cards de KPIs: chamados, TMR, TMRes, OS, clientes
- 5 gráficos: linha, pizza, barra, área, pipeline
- Insights automáticos via Claude API (Anthropic)
- Filtro por período

### ✅ Módulo 6 — Kanban de Tarefas
- Substitui PlannerX internamente
- Drag & drop entre colunas
- Prioridades: baixa, média, alta, urgente
- Projetos e sprints

### ✅ Módulo 7 — Alertas Semanais
- Cron: toda segunda-feira às 08:00 (America/Fortaleza)
- Relatório completo via WhatsApp
- Destinatários configuráveis
- Disparo manual pelo painel

## 🐳 Instalação e Deploy

### Pré-requisitos
- Docker e Docker Compose
- Node.js 20+ (para desenvolvimento)

### Desenvolvimento Local

```bash
# 1. Clone o repositório
git clone https://github.com/codemed/codemed-hub.git
cd codemed-hub

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# 3. Frontend (novo terminal)
cd frontend
npm install
npm run dev

# Acesse: http://localhost:3000
```

### Produção (Docker Compose)

```bash
# 1. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 2. Suba os serviços
docker-compose up -d

# 3. Execute as migrations
docker-compose exec backend npx prisma migrate deploy

# 4. Popule o banco (opcional)
docker-compose exec backend npx prisma db seed

# Acesse: http://localhost:3000
```

### Credenciais Padrão (Seed)

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@codemed.com.br | admin123 | Admin |
| gerente@codemed.com.br | tecnico123 | Gerente |
| joao@codemed.com.br | tecnico123 | Técnico |
| maria@codemed.com.br | tecnico123 | Técnica |
| comercial@codemed.com.br | tecnico123 | Comercial |

## 🔧 Conexão WhatsApp

1. Acesse o sistema e vá em **WhatsApp**
2. Clique em **Conectar**
3. Escaneie o QR Code com o WhatsApp do celular
4. Pronto! Os tickets serão criados automaticamente

## 📊 Insights IA

Para ativar os insights automáticos:
1. Obtenha uma chave da [Anthropic](https://console.anthropic.com/)
2. Adicione no `.env`: `ANTHROPIC_API_KEY=sk-ant-sua-chave`
3. O dashboard usará Claude para gerar 3 insights sobre os dados

## 📁 Estrutura do Projeto

```
codemed-hub/
├── backend/           # API Express + Prisma
│   ├── src/
│   │   ├── modules/   # auth, crm, orders, analytics, integrations, alerts, kanban
│   │   ├── shared/    # middleware, utils
│   │   └── config/    # env, database, redis
│   └── prisma/        # schema + migrations + seed
├── frontend/          # React + Tailwind + Recharts
│   └── src/
│       ├── pages/     # Dashboard, CRM, Orders, Sign, WhatsApp, Kanban, Settings
│       └── services/  # api, auth
└── docker-compose.yml
```

## 🔒 Segurança

- JWT com tokens curtos (15min) + refresh token (7 dias)
- Senhas com bcrypt (salt rounds: 12)
- Rate limiting nas rotas de login
- Auditoria: todas as ações críticas registradas
- OS assinada não pode ser editada
- Link de assinatura expira em 7 dias

---

**Desenvolvido para:** Codemed — Desenvolvimento de Software Laboratorial
