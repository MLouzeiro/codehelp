# Arquitetura do Sistema — CodeHelp CRM/Helpdesk

## Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    USUÁRIO                              │
│              (Navegador / Celular)                      │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 VERCEL (Grátis)                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Frontend React (Estático)              │   │
│  │  • React 18 + Vite + TypeScript + Tailwind       │   │
│  │  • Build: vite build → dist/                     │   │
│  │  • Rotas: React Router v6                        │   │
│  │  • Estado: React Query + Zustand                 │   │
│  │  • Ícones: Lucide React                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           API Serverless (Node.js)               │   │
│  │  • api/index.ts → Express handler                │   │
│  │  • Prisma client connection                      │   │
│  │  • Roteamento para Backend externo               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ /api/*
                      ▼
┌─────────────────────────────────────────────────────────┐
│               FLY.IO (Grátis)                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Backend Express (Docker)                │   │
│  │  • Node.js + Express + TypeScript                │   │
│  │  • 24 módulos                                    │   │
│  │  • JWT Auth (access + refresh)                   │   │
│  │  • RBAC (admin/gerente/supervisor/analista)      │   │
│  │  • Webhook WhatsApp (Cloud API)                  │   │
│  │  • 7 schedulers (cron jobs)                      │   │
│  │  • File uploads (multer)                         │   │
│  │  • PDF generation (pdfkit)                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           WhatsApp (Baileys)                      │   │
│  │  • WebSocket persistente                         │   │
│  │  • Conexão com WhatsApp                          │   │
│  │  • Bot de atendimento                            │   │
│  │  • Triagem automática                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Storage (Volume persistente)            │   │
│  │  • /storage/uploads/ — Arquivos enviados         │   │
│  │  • /storage/pdfs/ — PDFs gerados                 │   │
│  │  • /whatsapp-session/ — Sessões Baileys          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ Prisma
                      ▼
┌─────────────────────────────────────────────────────────┐
│               NEON PostgreSQL (Grátis)                   │
│                                                         │
│  • 500MB de armazenamento                              │
│  • Backups automáticos diários                         │
│  • Connection pooling (PgBouncer)                       │
│  • Branching para dev/testes                           │
└─────────────────────────────────────────────────────────┘
```

## Módulos do Sistema

### Core
- **Auth** — JWT (access 15min + refresh 7d) + bcryptjs
- **Users** — Gestão de usuários
- **Permissions** — RBAC avançado
- **Teams** — Equipes

### Helpdesk
- **Helpdesk** — Kanban de tickets (6 etapas)
- **SLA** — Monitoramento e auto-escalation
- **CSAT** — Pesquisa de satisfação
- **Categories** — Categorias e assuntos
- **Indicators** — TMR/TME/PR/SLA

### CRM
- **CRM** — Gestão de clientes
- **Billing** — Cobranças

### Comunicação
- **WhatsApp** — Baileys + Evolution + Cloud API
- **Notifications** — Notificações internas

### Inteligência
- **AI** — Triagem, validação, auditoria profissional
- **Analytics** — Dashboard, relatórios, indicadores

### Operações
- **Kanban** — Tarefas internas
- **Orders** — Ordens de serviço
- **TimeTracking** — Controle de tempo

### Auditoria
- **Audit** — Log imutável de ações
- **AuditSecurity** — Segurança e anomalias
- **AuditAlerts** — Sistema de alertas

## Fluxo de Autenticação

```
Login
  ↓
Backend valida email/senha
  ↓
Gera access token (15min) + refresh token (7d)
  ↓
Frontend salva em cookies
  ↓
Cada requisição envia access token no header
  ↓
Se 401 → Backend gera novos tokens usando refresh token
  ↓
Se refresh falhar → Redirect para login
```

## Fluxo do WhatsApp

```
Cliente envia mensagem
  ↓
Baileys recebe (WebSocket)
  ↓
Handler processa (verifica duplicatas, filtros)
  ↓
Verifica se é bot/fluxo ativo
  ↓
Se nouveau → Cria ticket + triagem
  ↓
Se continuação → Processa resposta
  ↓
Resposta enviada ao cliente
```

## Fluxo de Auditoria

```
Ação do usuário
  ↓
Controller chama logAudit()
  ↓
Grava no AuditLog (imutável)
  ↓
Se ação crítica → Gera AuditAlert
  ↓
Dashboard mostra indicadores
```

## Segurança

- **Auth**: JWT com refresh automático
- **RBAC**: 4 níveis (admin, gerente, supervisor, analista)
- **Rate limiting**: Express rate limit
- **Helmet**: Headers de segurança
- **CORS**: Configurável por origem
- **Audit**: Log imutável de todas as ações
- **Encryption**: AES-256-GCM para dados sensíveis

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | PostgreSQL connection string |
| `JWT_SECRET` | Sim | Chave JWT access token |
| `JWT_REFRESH_SECRET` | Sim | Chave JWT refresh token |
| `APP_URL` | Sim | URL do frontend |
| `API_URL` | Sim | URL do backend |
| `CORS_ORIGINS` | Sim | Origens permitidas |
| `ANTHROPIC_API_KEY` | Não | Para IA |
| `WHATSAPP_CLOUD_*` | Não | Para WhatsApp Cloud API |
| `EVOLUTION_API_*` | Não | Para Evolution API |

## Custos Mensais

| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby | R$ 0 |
| Fly.io | Free | R$ 0 |
| Neon | Free | R$ 0 |
| GitHub | Free | R$ 0 |
| **Total** | | **R$ 0** |
