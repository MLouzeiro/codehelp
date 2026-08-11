# SPEC.md — CodeHelp CRM/Helpdesk

## Problema

Software houses de saúde precisam de um sistema unificado para gerenciar atendimento ao cliente (helpdesk), CRM, ordens de serviço e integração com WhatsApp. Ferramentas fragmentadas causam perda de contexto, baixa produtividade e dificuldade de acompanhamento.

## Usuários

| Perfil | Acesso |
|--------|--------|
| **Admin** | Acesso total — configurações, usuários, relatórios, todos os tickets |
| **Gerente/Supervisor** | Visão completa do helpdesk, CRM, aprovações, métricas |
| **Técnico/Agente** | Atendimento de tickets, visualização de clientes atribuídos |
| **Vendedor** | CRM, oportunidades, pipeline de vendas |

## Funcionalidades

### Core

- **Autenticação** — Login com email/senha (JWT), controle de perfil (admin, gerente, tecnico, vendedor), session token para dispositivos
- **Helpdesk/Kanban** — Board com 6 etapas fixas: fila → triagem → em_atendimento → aguardando_cliente → aguardando_os → concluido
- **WhatsApp Multi-Provider** — Baileys (primário), Evolution API (self-hosted), Cloud API (Meta), handler compartilhado de bot/triagem
- **CRM** — Gestão de clientes, contatos, colaboradores, oportunidades
- **Ordens de Serviço** — CRUD de OS com assinatura digital (canvas mobile)
- **Dashboard** — Métricas em tempo real, gráficos interativos (Donut, Bar, Area)
- **IA** — Triagem inteligente (Claude API), validação de respostas, auto-atendimento

### Módulos Adicionais

- **Kanban Interno** — Tarefas internas com drag-and-drop, tags, subtarefas, galeria
- **Aprovações** — Workflow formal de aprovação para ações que requerem autorização
- **Alertas** — Alertas sonoros e notificações para atendentes
- **Mensagens Automáticas** — Edição de todas as mensagens enviadas pelo sistema
- **Billing** — Gestão de cobranças por cliente (terminais, hostlinks, interfaces, exames)
- **Knowledge Base** — Base de conhecimento para atendentes
- **CSAT** — Customer Satisfaction (pesquisa de satisfação)
- **Automações** — Regras de automação de processos
- **Auditoria** — Log completo de todas as ações do sistema
- **Feriados** — Calendário de feriados nacionais para cálculo de SLA

### Fora do escopo (v2+)

- Integração com email (imap/smtp)
- Integração com calendário
- Relatórios exportáveis (Excel/PDF)
- Multi-idioma (i18n)

## Módulos Detalhados

### M1 — Autenticação & Usuários

- Login com email/senha (JWT access 15min + refresh 7d)
- Session token para controle de dispositivos
- RBAC: admin, gerente, tecnico, vendedor + hierarchy levels
- Middleware: `authenticate`, `authorize`, `authorizeMaster`, `requireRole`, `ticketAccess`
- CRUD de usuários (admin/gerente podem criar)

### M2 — Helpdesk & Kanban

- 6 etapas fixas: fila, triagem, em_atendimento, aguardando_cliente, aguardando_os, concluido
- Triagem por palavras-chave e IA
- SLA com pausa automática quando cliente sem resposta
- Multi-departamento e filas
- Tags, anotações internas, timeline de eventos
- Dashboard helpdesk com métricas em tempo real

### M3 — WhatsApp Multi-Provider

- **Baileys**: WebSocket (sem Chrome/Puppeteer), provider primário
- **Evolution API**: Self-hosted Docker, API REST
- **Cloud API**: Meta oficial, free tier 1000 conversas/mês
- **Handler compartilhado**: bot/triagem reaproveitado entre providers
- Multi-conexão (2+ números)
- QR Code authentication

### M4 — CRM

- Gestão de clientes (CRUD completo)
- Contatos por cliente
- Colaboradores por cliente
- Pipeline de oportunidades
- Segmento, cidade, estado, tipo de contrato
- Integração com helpdesk (tickets vinculados ao cliente)

### M5 — Ordens de Serviço

- CRUD de OS vinculadas a tickets e clientes
- Assinatura digital com canvas (touch/mouse)
- Envio de link por WhatsApp/email
- PDF gerado após assinatura
- Status tracking

### M6 — Dashboard & Métricas

- Métricas: total tickets, tempo médio resposta, taxa resolução, clientes ativos
- Gráficos: Donut (status, prioridade, canal), Bar (prioridade), Area (tendência)
- Performance por atendente
- Acesso restrito a admin/gerente

### M7 — IA

- **AiTriage**: Análise inteligente com Claude API (fallback regex local)
- **AiValidation**: Propostas de resposta com workflow de validação humana
- **Auto-attendance**: Config threshold para envio automático
- Deteção de empresa/laboratório automaticamente

### M8 — Billing

- Cobranças por cliente: terminais, hostlinks, interfaces, exames
- Cálculo mensal com auto-count para tipo "exames"
- Dashboard: pendentes, cobrados, erros, valor total
- Histórico de cobranças

### M9 — Kanban Interno (Tarefas)

- Drag-and-drop com @dnd-kit
- Tags, subtarefas, anexos, atividades
- Galeria de quadros com templates
- Transferência e duplicação de tarefas
- Alertas de inatividade (24h/72h)
- Visão galeria e board

### M10 — Mobile (React Native + Expo)

- File-based routing (Expo Router)
- State management (Zustand)
- Offline mode (AsyncStorage + sync)
- Push notifications (Expo Notifications + FCM)
- Biometria (expo-local-authentication)
- Canvas de assinatura (react-native-svg)
- Telas: Login, Dashboard, Helpdesk, CRM, Orders, Approvals, Notifications, Settings

## Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Backend** | Node.js + Express + TypeScript | Simples, flexível, ecosystem robusto |
| **Frontend Web** | React 18 + Vite + TypeScript | Build rápido, HMR, ecosystem React |
| **Mobile** | React Native + Expo SDK 51 | Cross-platform, Expo simplifica build |
| **Banco de dados** | Prisma + SQLite (dev) / PostgreSQL (prod) | ORM tipado, migrations, flexibilidade |
| **Auth** | JWT + bcryptjs | Padrão industry, stateless |
| **WhatsApp** | Baileys + Evolution API + Cloud API | Multi-provider, fallback, redundância |
| **Estilo** | Tailwind CSS (web) / NativeWind (mobile) | Utility-first, produtivo |
| **Estado** | React Query (web) / Zustand (mobile) | Cache, sync, simplicidade |

## Constraints técnicos

- **Backend self-hosted**: Express server (não serverless), porta 3001
- **Frontend**: Vite dev server, porta 5173
- **Mobile**: Expo SDK 51, file-based routing
- **Banco**: SQLite para dev (rápido), PostgreSQL para prod
- **WhatsApp**: Baileys como primário (sem Chrome), Evolution/Cloud como fallback
- **JWT**: Access token 15min, refresh token 7d, session token para dispositivos

## Critérios de aceitação

### Autenticação
- [x] Login com credenciais válidas retorna JWT
- [x] Token expirado retorna 401
- [x] Refresh token renova access token
- [x] Session token previne login em múltiplos dispositivos

### Helpdesk
- [x] Board Kanban exibe tickets por etapa
- [x] Triagem por palavras-chave funciona
- [x] SLA é pausado quando cliente sem resposta
- [x] Multi-departamento funciona

### WhatsApp
- [x] Baileys conecta via WebSocket (sem Chrome)
- [x] QR Code gera instantaneamente
- [x] Mensagens são processadas por handler compartilhado
- [x] Multi-conexão suportada

### CRM
- [x] CRUD de clientes funciona
- [x] Contatos e colaboradores vinculados
- [x] Integração com helpdesk (tickets)

### Mobile
- [x] Login com biometria
- [x] Pipeline kanban com drag-and-drop
- [x] Assinatura de OS com touch
- [x] Offline mode com sync

## Decisões tomadas

- **Banco**: SQLite em dev, PostgreSQL em prod (via Prisma)
- **Seed**: `admin@codemed.com.br` / `admin123` com role admin e isMaster
- **WhatsApp**: Baileys como primário (WebSocket, sem Puppeteer)
- **Mobile**: React Native + Expo (não Flutter)
- **Estado mobile**: Zustand (não Redux)
- **Estilo mobile**: NativeWind (Tailwind para RN)

## Decisões em aberto

- [ ] Nome do sistema e logo/branding
- [ ] Deploy do backend (Vercel não suporta Express nativamente)
- [ ] Integração com email (imap/smtp) — prioridade baixa
