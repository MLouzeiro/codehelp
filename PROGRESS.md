# CodeHelp CRM/Helpdesk — Progress Log

> Última atualização: 2026-07-21

## Visão Geral do Projeto

Sistema completo de CRM/Helpdesk com integração WhatsApp multi-provider, kanban, CRM, analytics e app mobile.

| Camada | Tecnologia | Status |
|--------|------------|--------|
| Backend | Node.js + Express + TypeScript | ✅ Pronto |
| Frontend Web | React 18 + Vite + TypeScript + Tailwind CSS | ✅ Pronto |
| Mobile | React Native + Expo SDK 51 + Expo Router | ✅ Pronto |
| Banco de dados | Prisma + SQLite (dev) / PostgreSQL (prod) | ✅ Pronto |
| Auth | JWT (access 15min + refresh 7d) + bcryptjs | ✅ Pronto |
| WhatsApp | Baileys (primário) / Evolution API / Cloud API | ✅ Pronto |
| IA | Claude API (triagem) + validação humana | ✅ Pronto |

---

## ✅ Features Concluídas

### 1. Sistema de Autenticação
- JWT com access token (15min) + refresh token (7d)
- Session token para controle de dispositivos
- RBAC: admin, gerente, tecnico, vendedor
- Middleware: authenticate, authorize, ticketAccess

### 2. Helpdesk/Kanban
- Board com 6 etapas fixas (fila → triagem → em_atendimento → aguardando_cliente → aguardando_os → concluido)
- Triagem por palavras-chave e IA
- SLA com pausa automática quando cliente sem resposta
- Multi-departamento e filas
- Tags, anotações internas, timeline de eventos
- Dashboard helpdesk com métricas em tempo real

### 3. WhatsApp Multi-Provider
- **Baileys**: WebSocket (sem Chrome/Puppeteer), provider primário
- **Evolution API**: Self-hosted Docker, API REST
- **Cloud API**: Meta oficial, free tier 1000 conversas/mês
- Handler compartilhado de bot/triagem
- Multi-conexão (2+ números)
- QR Code authentication instantâneo

### 4. CRM
- Gestão de clientes (CRUD completo)
- Contatos por cliente
- Colaboradores por cliente
- Pipeline de oportunidades
- Segmento, cidade, estado, tipo de contrato
- Integração com helpdesk (tickets vinculados)

### 5. Ordens de Serviço
- CRUD de OS vinculadas a tickets e clientes
- Assinatura digital com canvas (touch/mouse)
- Envio de link por WhatsApp/email
- PDF gerado após assinatura
- Status tracking

### 6. Dashboard & Métricas
- Métricas: total tickets, tempo médio resposta, taxa resolução, clientes ativos
- Gráficos: Donut (status, prioridade, canal), Bar (prioridade), Area (tendência)
- Performance por atendente
- Acesso restrito a admin/gerente

### 7. IA
- **AiTriage**: Análise inteligente com Claude API (fallback regex local)
- **AiValidation**: Propostas de resposta com workflow de validação humana
- **Auto-attendance**: Config threshold para envio automático
- Deteção de empresa/laboratório automaticamente

### 8. Billing
- Cobranças por cliente: terminais, hostlinks, interfaces, exames
- Cálculo mensal com auto-count para tipo "exames"
- Dashboard: pendentes, cobrados, erros, valor total
- Histórico de cobranças

### 9. Kanban Interno (Tarefas)
- Drag-and-drop com @dnd-kit
- Tags, subtarefas, anexos, atividades
- Galeria de quadros com templates
- Transferência e duplicação de tarefas
- Alertas de inatividade (24h/72h)
- Visão galeria e board

### 10. Aprovações
- Workflow formal de aprovação
- Notificações para admin/gerente
- Status: pendente → aprovada/rejeitada
- Justificativa para rejeição

### 11. Alertas & Notificações
- Alertas sonoros (Web Audio API)
- Notificações por tipo (cliente_entrou, nova_mensagem, sla_alerta, etc.)
- Configuração individual por atendente
- Auto-save das configurações

### 12. Mensagens Automáticas
- Edição de todas as mensagens enviadas pelo sistema
- Variáveis: {{nome_contato}}, {{numero_protocolo}}, {{tecnico}}, etc.
- Preview em tempo real
- Reset para mensagem padrão

### 13. Temas & Aparência
- Modos de fundo: white, ice, gray, blue
- Escala de fonte: Pequena, Média, Grande
- Esquema de cores: Padrão, Coral, Violeta, Floresta, Oceano, Dragão
- Layout da sidebar: Lateral, Compacta, Empilhada

### 14. Dark Mode
- Toggle no header
- Persistência no localStorage
- Detecção de preferência do OS
- 35+ arquivos atualizados

### 15. Mobile (React Native + Expo)
- **Estrutura**: Expo Router (file-based routing)
- **State**: Zustand stores (auth, helpdesk, crm, orders, notifications)
- **Telas**: Login, Dashboard, Helpdesk, CRM, Orders, Approvals, Notifications, Settings
- **Offline**: AsyncStorage + sync
- **Push**: Expo Notifications + FCM
- **Biometria**: expo-local-authentication
- **Assinatura**: react-native-svg (canvas de assinatura)
- **Componentes UI**: Avatar, Button, Card, Feedback, Input, SignatureCanvas

### 16. Skills para Agentes IA
- **codehelp-dev**: Skill especialista em desenvolvimento backend/frontend
- **codehelp-mobile**: Skill especialista em desenvolvimento mobile
- **HELP-DESK**: Skill unificada completa do projeto

---

## 🔄 Últimos Commits (2026-07-15 a 2026-07-17)

```
7c6e84c v1.4-dev: docs(help-desk): skill unificada completa do projeto
c229c5b v1.4-dev: feat(skills): skills especialistas em desenvolvimento CodeHelp
134afd0 v1.4-dev: feat(mobile): pipeline kanban + assinatura + whatsapp + offline
fae9003 v1.4-dev: feat(mobile): aprovacoes + settings + tab navegacao
f4e5470 v1.4-dev: feat(mobile): app React Native + Expo - estrutura completa v1
ee6fb88 v1.4-dev: feat(helpdesk): som em qualquer aba - alerta sonoro no Kanban
80aa6b5 v1.4-dev: fix(som): áudio funciona com Web Audio API + init no primeiro clique
e7ce941 v1.4-dev: fix(kanban): filtrar registros de alertas das colunas do helpdesk
5669bae v1.4-dev: fix: fundo aplicado no Layout, alertas com localStorage, som WhatsApp
78dcd8c v1.4-dev: fix: alertas sonoros auto-save, sons sintetizados, auto-messages create
74e0371 v1.4-dev: fix(ui): cores visíveis nos previews de fundo do ThemeSettings
40b9eaa v1.4-dev: fix: rota helpdesk config, som alertas e horário sábado
f964131 v1.4-dev: fix: mensagens automáticas, CSAT e preview cores temas
ef339dd v1.4-dev: docs: documentação completa de todas as features
33dae4b v1.4-dev: feat(assinatura): canvas de assinatura mobile com touch otimizado
f34a3b9 v1.4-dev: feat(mensagens): editor de mensagens automáticas
```

---

## 📁 Estrutura do Projeto

```
code-help/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # Schema do banco
│   │   ├── seed.ts              # Dados iniciais
│   │   └── migrations/
│   ├── src/
│   │   ├── config/              # database.ts, env.ts
│   │   ├── modules/             # Modulos por dominio
│   │   │   ├── auth/            # auth.controller.ts, rbac.ts
│   │   │   ├── helpdesk/        # helpdesk.service.ts, autoMessages.service.ts
│   │   │   ├── crm/             # crm.controller.ts
│   │   │   ├── orders/          # orders.controller.ts
│   │   │   ├── whatsapp/        # providers, handler compartilhado
│   │   │   ├── ai/              # aiTriage.service.ts, aiValidation.service.ts
│   │   │   ├── billing/         # billing.service.ts
│   │   │   ├── alerts/          # alerts.service.ts
│   │   │   ├── aprovacoes/      # aprovacao.controller.ts
│   │   │   ├── kanban/          # kanban.controller.ts
│   │   │   ├── analytics/       # analytics.controller.ts
│   │   │   └── ...
│   │   ├── shared/middleware/   # auth.ts
│   │   └── server.ts
│   └── storage/pdfs/
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components
│   │   │   ├── ui/              # Button, Input, Card, Modal
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── ThemeSettings.tsx
│   │   ├── pages/               # Paginas por rota
│   │   │   ├── Login/
│   │   │   ├── Dashboard/
│   │   │   ├── CRM/
│   │   │   ├── Helpdesk/
│   │   │   ├── WhatsApp/
│   │   │   ├── Kanban/
│   │   │   ├── Orders/
│   │   │   └── Settings/
│   │   ├── services/            # api.ts, auth.tsx, ThemeContext.tsx
│   │   └── types/
│   └── dist/
├── mobile/                      # App React Native + Expo
│   ├── app/                     # Expo Router (file-based)
│   │   ├── (auth)/              # login.tsx
│   │   ├── (tabs)/              # index, helpdesk, crm, orders, approvals, notifications
│   │   └── (modals)/            # ticket/[id], client/[id], order/[id], settings
│   ├── src/
│   │   ├── components/ui/       # Avatar, Button, Card, Input, SignatureCanvas
│   │   ├── hooks/               # usePolling.ts
│   │   ├── screens/             # ApprovalsScreen, PipelineScreen, etc.
│   │   ├── services/            # api.ts, notifications.ts, offline.ts, secureStore.ts
│   │   ├── stores/              # authStore, crmStore, helpdeskStore, etc.
│   │   └── types/
│   └── package.json
├── .claude/                     # Skills e scripts RAG
├── .opencode/                   # Config opencode, skills
├── AGENTS.md                    # Regras do projeto
├── SPEC.md                      # Especificação do sistema
├── PLAN.md                      # Plano de desenvolvimento
├── PROGRESS.md                  # Este arquivo
└── DOCUMENTATION.md             # Documentação das features
```

---

## 🚀 Como Rodar

### Backend
```bash
npm install
npm run dev:backend          # Backend (tsx watch, porta 3001)
npm run db:push              # Prisma db push
npm run db:seed              # Executar seed
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # Frontend (vite, porta 5173)
```

### Mobile
```bash
cd mobile
npm install --legacy-peer-deps
npx expo start               # Iniciar Expo
npx expo run:android         # Build Android
npx expo run:ios             # Build iOS
```

---

## 🔐 Credenciais de Teste

### Usuário Admin
- Email: `admin@codemed.com.br`
- Senha: `admin123`
- Role: admin (isMaster: true)

### Banco de Dados
- SQLite: `backend/prisma/dev.db` (dev)
- PostgreSQL: `codemed_hub` at `127.0.0.1:5434` (prod)

---

## 🐛 Known Issues

1. **Cloud API** — Requer verificação Meta Business para produção
2. **Docker Desktop** — Daemon pode demorar para iniciar
3. **Deploy backend** — Vercel não suporta Express nativamente (considerar Railway, Render, ou VPS)

---

## 🔍 Diagnóstico — Log PostgreSQL (2026-07-21)

### Erro analisado
Log de PostgreSQL (v15.18, container `codemed-postgres`) com erros repetidos de schema.

### Erros identificados

| Erro | Tabela | Coluna | Ocorrências |
|------|--------|--------|-------------|
| `column Ticket.tags does not exist` | Ticket | tags | ~10.000+ (desde 14/07) |
| `column Ticket.channelId does not exist` | Ticket | channelId | ~1.000+ (desde 17/07) |
| `column Message.phone does not exist` | Message | phone | ~500+ (desde 15/07) |

### Causa raiz
Schema Prisma foi atualizado com novos campos e tabelas, mas **migrations não foram executadas** no banco de produção antigo. O Prisma gerava queries com colunas que não existiam.

### Status atual (2026-07-21)
- Container `codemed-postgres` **não está mais rodando**
- Sistema atual usa `evolution-db` (PostgreSQL 16, porta 5434)
- Banco atual **possui todas as 67 tabelas e colunas** do schema
- Backend (porta 3010) conectado e funcionando
- **Não há erros de schema no sistema atual**

### Ação para produção
Se o erro persistir em servidor remoto, rodar:
```bash
npx prisma db push
```

---

## 📝 TODO

### Alta Prioridade
- [ ] Deploy do backend (Railway, Render, ou VPS)
- [ ] Configuração de domínio personalizado
- [ ] SSL/HTTPS em produção
- [ ] Backup automático do banco

### Média Prioridade
- [ ] Testes automatizados (Jest + RTL)
- [ ] Integração com email (imap/smtp)
- [ ] Relatórios exportáveis (PDF/Excel)
- [ ] Documentação de API (Swagger/OpenAPI)

### Baixa Prioridade
- [ ] Multi-idioma (i18n)
- [ ] Integração com calendário
- [ ] Chatbot avançado
- [ ] Analytics avançado

---

## 👥 Notas da Equipe

- Usuário prefere português (Brasileiro) para comentários e UI
- **NUNCA apagar, limpar ou zerar dados do banco** — sempre preservar dados existentes
- Manter ambas as implementações WhatsApp (legacy + novas APIs)
- Preparar para deploy (frontend Vercel + backend self-hosted)

---

*Este arquivo deve ser atualizado conforme o trabalho progride.*
