# PLAN.md — CodeHelp CRM/Helpdesk

> Última atualização: 2026-07-17

---

## Status Geral

| Módulo | Status | Prioridade |
|--------|--------|------------|
| M1 — Autenticação | ✅ Concluído | — |
| M2 — Helpdesk/Kanban | ✅ Concluído | — |
| M3 — WhatsApp Multi-Provider | ✅ Concluído | — |
| M4 — CRM | ✅ Concluído | — |
| M5 — Ordens de Serviço | ✅ Concluído | — |
| M6 — Dashboard & Métricas | ✅ Concluído | — |
| M7 — IA (Triage + Validation) | ✅ Concluído | — |
| M8 — Billing | ✅ Concluído | — |
| M9 — Kanban Interno | ✅ Concluído | — |
| M10 — Mobile (React Native) | ✅ Concluído | — |
| M11 — Aprovações | ✅ Concluído | — |
| M12 — Alertas & Notificações | ✅ Concluído | — |
| M13 — Mensagens Automáticas | ✅ Concluído | — |
| M14 — Temas & Aparência | ✅ Concluído | — |
| M15 — Dark Mode | ✅ Concluído | — |

---

## Fases Concluídas

### Fase 1 — Scaffolding & Database ✅
- Projeto inicializado com Express + React + Vite + Prisma
- Schema do banco criado com todos os modelos
- Seed com admin@codemed.com.br / admin123
- SQLite para dev, PostgreSQL para prod

### Fase 2 — Auth & Core ✅
- JWT authentication (access 15min + refresh 7d)
- Session token para controle de dispositivos
- RBAC: admin, gerente, tecnico, vendedor
- Middleware: authenticate, authorize, ticketAccess

### Fase 3 — Helpdesk/Kanban ✅
- Board com 6 etapas fixas
- Triagem por palavras-chave
- SLA com pausa automática
- Multi-departamento e filas
- Tags, anotações, timeline

### Fase 4 — WhatsApp Multi-Provider ✅
- Baileys (WebSocket, primário)
- Evolution API (self-hosted Docker)
- Cloud API (Meta official)
- Handler compartilhado de bot/triagem
- Multi-conexão (2+ números)

### Fase 5 — CRM ✅
- Gestão de clientes (CRUD)
- Contatos e colaboradores
- Pipeline de oportunidades
- Integração com helpdesk

### Fase 6 — Orders & Billing ✅
- CRUD de Ordens de Serviço
- Assinatura digital (canvas touch/mouse)
- Billing por cliente (terminais, hostlinks, interfaces, exames)
- Cálculo mensal automático

### Fase 7 — IA & Analytics ✅
- AiTriage (Claude API + fallback regex)
- AiValidation (workflow de validação humana)
- Auto-attendance (config threshold)
- Dashboard com gráficos interativos

### Fase 8 — Kanban Interno ✅
- Drag-and-drop (@dnd-kit)
- Tags, subtarefas, anexos
- Galeria com templates
- Transferência e duplicação
- Alertas de inatividade

### Fase 9 — Mobile (React Native + Expo) ✅
- Expo Router (file-based routing)
- Zustand stores (auth, helpdesk, crm, orders, notifications)
- Telas: Login, Dashboard, Helpdesk, CRM, Orders, Approvals, Notifications
- Offline mode (AsyncStorage + sync)
- Push notifications (Expo Notifications + FCM)
- Biometria (expo-local-authentication)
- Canvas de assinatura (react-native-svg)

### Fase 10 — UX & Polish ✅
- Dark mode completo (35+ arquivos)
- Temas configuráveis (cores, fontes, layout)
- Alertas sonoros (Web Audio API)
- Mensagens automáticas editáveis
- Workflow de aprovações

---

## O que está em andamento

### Bug Fixes & Stabilization
- [ ] Testar fluxo completo WhatsApp Baileys end-to-end
- [ ] Testar multi-conexão com Evolution API
- [ ] Validar webhook URL para Evolution API
- [ ] Testar WhatsApp Cloud API em produção

### Documentação
- [x] Atualizar AGENTS.md ✅ (2026-07-17)
- [x] Atualizar SPEC.md ✅ (2026-07-17)
- [x] Atualizar PLAN.md ✅ (2026-07-17)
- [ ] Atualizar README.md
- [ ] Criar guia de deploy

---

## O que falta (Backlog)

### Alta Prioridade
- [ ] Deploy do backend (Vercel não suporta Express — considerar Railway, Render, ou VPS)
- [ ] Configuração de domínio personalizado
- [ ] SSL/HTTPS em produção
- [ ] Backup automático do banco

### Média Prioridade
- [ ] Integração com email (imap/smtp)
- [ ] Notificações por email (transactional)
- [ ] Relatórios exportáveis (PDF/Excel)
- [ ] Testes automatizados (Jest + RTL)

### Baixa Prioridade
- [ ] Multi-idioma (i18n)
- [ ] Integração com calendário
- [ ] Chatbot avançado
- [ ] Analytics avançado

---

## Arquitetura Atual

```
┌─────────────────────────────────────────────────────────┐
│                      MOBILE APP                         │
│              React Native + Expo SDK 51                 │
│         Expo Router + Zustand + NativeWind              │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/WebSocket
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND API                          │
│              Node.js + Express + TypeScript             │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Auth    │ │ Helpdesk │ │   CRM    │ │  Orders  │  │
│  │  JWT     │ │ Kanban   │ │ Clientes │ │   OS     │  │
│  │  RBAC    │ │ Triagem  │ │ Oportun. │ │ Assinat. │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ WhatsApp │ │    IA    │ │ Billing  │ │  Kanban  │  │
│  │ Baileys  │ │ Triage   │ │ Cobrança │ │  Interno │  │
│  │ Evolution│ │ Validation│ │ Mensal   │ │ Drag-Drop│  │
│  │ Cloud    │ │ Auto-Att │ │ Dashboard│ │ Tags     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │ Prisma ORM
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    DATABASE                             │
│         SQLite (dev) / PostgreSQL (prod)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   FRONTEND WEB                          │
│           React 18 + Vite + TypeScript                  │
│              Tailwind CSS + Lucide React                │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Login  │ │ Helpdesk │ │   CRM    │ │ Dashboard│  │
│  │   Auth   │ │ Kanban   │ │ Clientes │ │ Métricas │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │WhatsApp  │ │  Orders  │ │  Kanban  │ │ Settings │  │
│  │Conexões  │ │   OS     │ │  Tarefas │ │ Temas    │  │
│  │Chat      │ │ Assinat. │ │ Galeria  │ │ Alertas  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de Trabalho

### Para novas features
1. Criar branch `feature/nome` da develop
2. Implementar backend (service + controller + routes)
3. Implementar frontend (page + components)
4. Typecheck: `npx tsc --noEmit` (backend e frontend)
5. Testes: `npm test`
6. Commit com prefixo `v1.4-dev: feat(modulo): descricao`
7. Merge na develop quando aprovado

### Para bug fixes
1. Identificar o bug (reproduzir)
2. Encontrar causa raiz (grep, logs, testes)
3. Corrigir o MÍNIMO possível
4. Verificar que não quebrou nada (typecheck + testes)
5. Commit: `v1.4-dev: fix(modulo): descricao do fix`

### Para schema changes
1. Editar `backend/prisma/schema.prisma`
2. `npx prisma db push` (dev) ou `npx prisma migrate dev` (prod)
3. `npx prisma generate`
4. Atualizar tipos no frontend (`types/index.ts`)
5. Atualizar mobile (`mobile/src/types/index.ts`)

---

## Comandos Úteis

```bash
# Backend
npm run dev:backend          # Backend (tsx watch, porta 3001)
npm run db:push              # Prisma db push
npm run db:seed              # Executar seed
npm run db:studio            # Prisma Studio
npx tsc --noEmit             # Typecheck backend

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

## Métricas do Projeto

| Métrica             | Valor     |
|---------------------|-----------|
| Total de módulos    | 15        |
| Módulos concluídos  | 15 (100%) |
| Backend commits     | 50+       |
| Frontend commits    | 40+       |
| Mobile commits      | 5+        |
| Arquivos TypeScript | 200+      |
| Linhas de código    | 50.000+   |
