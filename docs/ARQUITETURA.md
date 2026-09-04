# Arquitetura do Sistema

## Visão Geral

```
Usuário (Browser/Mobile)
    ↓
Frontend (React + Vite)
    ↓ HTTP/HTTPS
Backend (Express + TypeScript)
    ↓ Prisma ORM
Banco de Dados (PostgreSQL)
    ↓
Serviços Externos (WhatsApp, IA, Email)
```

## Componentes

### Frontend (React + Vite)

- **Porta**: 5173 (dev) / Estático (produção)
- **Stack**: React 18, TypeScript, Tailwind CSS, Recharts, ReactFlow
- **Estado**: React Query + hooks locais
- **Rotas**: React Router v6 (file-based no mobile)
- **Build**: Vite 5.4

### Backend (Express + TypeScript)

- **Porta**: 3010
- **Stack**: Express 4.21, TypeScript 5.6, Prisma 5.22
- **Auth**: JWT (15min access + 7d refresh) + bcryptjs
- **Segurança**: Helmet, CORS, Rate Limiting, CSRF
- **Logs**: Pino
- **Testes**: Vitest

### Banco de Dados

- **Local**: PostgreSQL 15 (Docker `evolution-db`, porta 5434)
- **Web**: PostgreSQL 18 (Neon, serverless)
- **ORM**: Prisma (schema-first, `db push`)
- **Tabelas**: 89
- **Registros**: ~18.400

### WhatsApp (3 providers)

| Provider | Tipo | Status |
|----------|------|--------|
| Baileys | WebSocket (primário) | ✅ Ativo |
| Evolution API | Self-hosted Docker | ✅ Ativo |
| Cloud API | Meta Official | ⚙️ Configurável |
| WhatsApp Web.js | Puppeteer (legado) | ❌ Desativado |

### IA

- **Provedor**: Anthropic Claude (opcional)
- **Fallback**: Regex local determinístico
- **Uso**: Triagem, auto-categorização, auditoria

### Mobile (React Native + Expo)

- **SDK**: Expo 51
- **Rotas**: Expo Router (file-based)
- **Estado**: Zustand
- **Offline**: AsyncStorage + sync

## Módulos

| Módulo | Descrição |
|--------|-----------|
| Auth | Login, JWT, RBAC, sessão |
| Helpdesk | Tickets, kanban, SLA, CSAT |
| CRM | Clientes, oportunidades, pipeline |
| Orders | Ordens de serviço, assinatura digital |
| Kanban | Tarefas internas, boards, checklist |
| WhatsApp | 3 providers, bot, triagem |
| IA | Triage, auto-categorize, auditoria |
| Analytics | Dashboards, métricas, relatórios |
| Billing | Cobranças, pendências |
| Audit | Logs, alertas, segurança |
| KB | Base de conhecimento |
| Automations | Regras WHEN/IF/THEN |
| Teams | Equipes, membros |
| Time Tracking | Tempo por ticket |

## Segurança

- JWT com session token binding
- RBAC com hierarquia (solicitante < agente < supervisor < admin)
- Rate limiting em endpoints sensíveis
- CSRF protection
- Helmet headers
- Validação Zod em todos os inputs
- Soft delete (campo `active`)
- Auditoria imutável (AuditLog)
