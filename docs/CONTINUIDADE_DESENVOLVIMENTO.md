# CONTINUIDADE DE DESENVOLVIMENTO — CodeHelp CRM/Helpdesk

> Ponto de retomada — último checkpoint: 02/09/2026

---

## ONDE PARAMOS?

Estamos na versão **v1.6.0**, com o sistema em **produção**.

A última funcionalidade implementada foi o **Sistema Unificado de Qualidade Operacional** (reaberturas, recorrência, retrabalho, FCR).

Recentemente foram feitas correções em:
- Usuários: endpoint de exclusão definitiva (`DELETE /api/auth/users/:id/permanently`)
- Kanban: filtro de usuários ativos no campo Responsável
- Multi-componentes: filtros `?active=true` em 6 páginas

---

## O QUE JÁ FOI FEITO?

### Core
- Autenticação JWT completa (login, refresh, session binding)
- RBAC com 4 perfis (admin, gerente, tecnico, comercial)
- Multi-organização com isolamento de dados
- Dark Mode global

### Helpdesk
- Kanban com 6 etapas
- Triagem automática (regex + IA)
- SLA com cálculo em tempo real
- CSAT (confirmação → avaliação)
- Checklist em tickets
- Indicadores TMR/TME/SLA/PR
- Qualidade Operacional

### WhatsApp
- 3 providers (Baileys, Evolution, Cloud API)
- Handler compartilhado
- Menu numérico / texto numerado
- Multi-conexões
- Contatos ignorados

### CRM
- Clientes, Colaboradores, Contatos
- Oportunidades (pipeline)

### OS
- CRUD completo com timeline
- Assinatura eletrônica (canvas + link)
- Envio via WhatsApp
- PDF

### Kanban Interno
- Múltiplos boards, colunas, WIP limit
- Drag & drop, tags, subtarefas
- IA auto-categorize
- Alertas automáticos

### IA
- Auditoria profissional (14 categorias)
- Detecção de encerramento
- Monitor de agentes
- Tomada de decisão
- Insights gerenciais

### Analytics
- Dashboard Executivo
- Dashboard IA
- Relatório Gerencial
- Relatório Analítico
- Qualidade Operacional

### Auditoria
- 17 endpoints
- 22 indicadores de segurança
- Detecção de anomalias
- Alertas CRUD

### Outros
- Knowledge Base
- Automações
- Enquetes
- Time Tracking
- Equipes
- Billing
- Feriados
- API pública de integração

---

## O QUE ESTÁ FUNCIONANDO?

### ✅ Funcionando perfeitamente
- Login/logout
- CRUD de usuários
- Arquivamento/restauração de usuários
- Listagem de usuários ativos
- Dashboard principal
- Kanban de helpdesk
- Kanban de tarefas internas
- WhatsApp (Baileys)
- Mensagens e chat
- SLA em tempo real
- CSAT
- Auditoria de sistema
- Dark Mode

### ⚠️ Funcionando com ressalvas
- Assinatura de OS (link pode não ser clicável em todos os cases)
- Criação de tarefas internas (pode haver bug intermitente)
- WhatsApp Evolution/Cloud API (depende de configuração externa)
- Facebook/Instagram/Telegram (dependem de credenciais)
- 26 erros TypeScript pré-existentes (não bloqueantes)
- 16 testes pré-existentes falhando

### ❌ Com problema conhecido
- Assinatura desenhada pode não salvar corretamente
- Pasta `components/ui/` não existe (mencionada no AGENTS.md)
- Alguns testes E2E dependem de timing

---

## O QUE ESTÁ COM PROBLEMA?

### Prioridade Alta
1. **Assinatura de OS**: link pode não ser clicável; canvas pode não salvar
2. **26 erros TypeScript**: facebook.service, instagram.service, email.service (imap), csurf, cookie-parser
3. **16 testes falhando**: orders-signature, ticket-closure-regression, ticket-lifecycle-e2e, agent-report, expediente-return, relatorios

### Prioridade Média
4. **Criação de tarefas**: pode haver bug intermitente na criação
5. **Responsável no Kanban**: filtro implementado mas precisa de teste completo

### Prioridade Baixa
6. **Pasta ui/ vazia**: componentes Button, Input, Card não existem
7. **Alguns componentes órfãos**: SmartTimeline, TemporalBarChart, etc. (sub-componentes, não rotas)

---

## O QUE FALTA FAZER?

### Imediato (próxima tarefa)
1. **Corrigir assinatura da OS**: link clicável, canvas persistente
2. **Verificar criação de tarefas internas**: testar fluxo completo
3. **Testar exclusão definitiva de usuários**: validar todas as proteções
4. **Corrigir erros TypeScript pré-existentes**

### Curto prazo
5. **Mobile**: implementar funcionalidades do app React Native
6. **Testes E2E**: corrigir testes que dependem de timing
7. **Performance**: otimizar queries do dashboard

### Médio prazo
8. **Multi-tenant completo**:RLS no banco
9. **Webhooks**: sistema de webhooks configurável
10. **Relatórios**: PDF/Excel para todos os relatórios

---

## O QUE NÃO PODE SER ALTERADO?

### ABSOLUTAMENTE PROIBIDO:
- Handler canônico de WhatsApp (`whatsapp-message-handler.ts`)
- Handler legado (`whatsapp.service.ts`) — independente
- Fluxo de CSAT (confirmação → avaliação → estado)
- Autenticação JWT + session token binding
- RBAC existente
- Multi-organização (isolamento)
- SLA com cálculo em tempo real
- Todos os dados existentes no banco
- Rotas existentes (não remover)
- Tabelas existentes (não dropar)

### NÃO ALTERAR SEM NECESSIDADE:
- Middleware de auth
- Schemas de validação (Zod)
- Configuração de ajuda por departamento
- Regras de automação
- Knowledge Base
- Timeline de tickets
- Métricas consolidadas
- Billing existente

---

## QUAL DEVE SER A PRÓXIMA TAREFA?

**Recomendado**: Corrigir a assinatura de OS

Porque:
- É uma funcionalidade crítica para o negócio
- Tem problemas conhecidos (link, canvas)
- Impacta diretamente o cliente
- Está documentada como pendência

**Alternativa**: Verificar a criação de tarefas internas

Porque:
- Pode estar causando perda de produtividade
- É uma funcionalidade core do sistema
- Pode ter sido introduzido por alguma mudança recente

---

## QUAIS ARQUIVOS SÃO IMPORTANTES?

### Backend — Arquivos Críticos
| Arquivo | Importância | Motivo |
|---------|-------------|--------|
| `backend/src/app.ts` | ALTA | Registra todas as rotas |
| `backend/src/server.ts` | ALTA | Entry point + schedulers |
| `backend/src/modules/helpdesk/flow.service.ts` | ALTA | Fluxo principal de atendimento |
| `backend/src/modules/whatsapp/whatsapp-message-handler.ts` | ALTA | Handler canônico WhatsApp |
| `backend/src/modules/whatsapp/whatsapp.service.ts` | ALTA | Handler legado |
| `backend/src/modules/auth/auth.controller.ts` | ALTA | Login + CRUD usuários |
| `backend/src/modules/auth/auth.routes.ts` | ALTA | Rotas de auth |
| `backend/src/modules/orders/orders-signature.service.ts` | ALTA | Assinatura de OS |
| `backend/src/modules/kanban/kanban.service.ts` | ALTA | Kanban CRUD |
| `backend/src/shared/middleware/auth.ts` | ALTA | JWT + RBAC |
| `backend/prisma/schema.prisma` | ALTA | Schema do banco (90 models) |
| `backend/src/config/env.ts` | ALTA | Variáveis de ambiente |

### Frontend — Arquivos Críticos
| Arquivo | Importância | Motivo |
|---------|-------------|--------|
| `frontend/src/App.tsx` | ALTA | Rotas (74) |
| `frontend/src/components/Layout.tsx` | ALTA | Layout principal |
| `frontend/src/services/auth.tsx` | ALTA | Autenticação |
| `frontend/src/services/api.ts` | ALTA | Cliente HTTP |
| `frontend/src/pages/Helpdesk/HelpdeskKanban.tsx` | ALTA | Kanban principal |
| `frontend/src/pages/Helpdesk/TicketAtendimentoPage.tsx` | ALTA | Atendimento |
| `frontend/src/pages/WhatsApp/WhatsAppPage.tsx` | ALTA | WhatsApp |
| `frontend/src/pages/Orders/OrderDetail.tsx` | ALTA | Detalhe OS |
| `frontend/src/pages/Sign/SignPage.tsx` | ALTA | Assinatura |
| `frontend/src/components/KanbanBoard/KanbanBoard.tsx` | ALTA | Kanban board |

---

## QUAIS APIs SÃO IMPORTANTES?

### APIs Mais Utilizadas
1. `GET /api/auth/users?active=true` — Lista usuários ativos (usado em 6+ componentes)
2. `GET /api/kanban/boards` — Lista boards
3. `GET /api/kanban/boards/:id/tasks` — Tasks do board
4. `POST /api/kanban/tasks` — Criar task
5. `PATCH /api/helpdesk/tickets/:id/move` — Mover ticket
6. `GET /api/helpdesk/tickets/:id` — Detalhar ticket
7. `GET /api/analytics/executivo` — Dashboard executivo
8. `POST /api/auth/login` — Login
9. `POST /api/auth/refresh` — Refresh token
10. `GET /api/crm/clients` — Listar clientes

---

## QUAIS TABELAS SÃO IMPORTANTES?

### Tabelas Core
1. **User** — Usuários do sistema
2. **Organization** — Tenant/organização
3. **Ticket** — Chamados (20+ índices)
4. **KanbanTask** — Tarefas internas
5. **KanbanBoard** — Boards do kanban
6. **Client** — Clientes
7. **ServiceOrder** — Ordens de serviço
8. **Message** — Mensagens WhatsApp/ticket
9. **AuditLog** — Auditoria do sistema
10. **HelpdeskConfig** — Config por departamento

### Tabelas de Métricas
11. **TicketMetrics** — Métricas consolidadas
12. **TicketTimeline** — Timeline horizontal
13. **TicketPerformance** — Performance por agente
14. **AuditoriaProfissional** — Auditoria IA (14 notas)
15. **AIAgentAudit** — Auditoria em tempo real

### Tabelas de Config
16. **Fila** — Filas de atendimento
17. **Departamento** — Departamentos
18. **Categoria/Assunto** — Classificação
19. **SLAConfig** — Configuração de SLA
20. **WhatsAppConnection** — Conexões WhatsApp

---

## COMO RETOMAR O DESENVOLVIMENTO

### Passo 1: Entender o estado atual
```bash
cd code-help
git log --oneline -10          # Últimos commits
git status                     # Arquivos alterados
git diff                       # Mudanças pendentes
```

### Passo 2: Rodar o projeto
```bash
npm install                    # Dependências
npm run db:push               # Sincronizar schema
npm run db:seed               # Dados iniciais (se necessário)
npm run dev:backend           # Backend (porta 3010)
npm run dev:frontend          # Frontend (porta 5173)
```

### Passo 3: Verificar testes
```bash
cd backend
npx vitest run                # Todos os testes
npx vitest run src/__tests__/users.test.ts  # Testes de usuário

cd frontend
npx vitest run                # Testes frontend
```

### Passo 4: Verificar build
```bash
cd backend
npx tsc --noEmit              # TypeScript check

cd frontend
npx tsc --noEmit              # TypeScript check
npx vite build                # Build produção
```

### Passo 5: Criar branch para nova funcionalidade
```bash
git checkout -b feature/nova-funcionalidade
# Implementar
# Testar
# Commit
# PR para feature/helpdesk-enhancements
```

---

## DICAS IMPORTANTES

### NUNCA fazer:
- `DELETE FROM` em tabelas de produção
- `DROP TABLE` em qualquer tabela
- Editar migrations geradas
- Remover rotas existentes
- Alterar handler canônico de WhatsApp
- Alterar fluxo de CSAT
- Remover proteções de auth

### SEMPRE fazer:
- Usar `active: false` para "excluir" dados
- Usar `upsert` quando dado pode ou não existir
- Rodar `npx tsc --noEmit` após alterações
- Rodar testes antes de commitar
- Verificar `git diff` antes de commitar
- Manter compatibilidade com API existente

### Padrões de código:
- Controllers: `async handler + try/catch`
- Services: `AppError` para erros
- Frontend: `useCallback` para funções
- Nomenclatura: kebab-case arquivos, camelCase funções, PascalCase componentes
- Endpoints: `/api/{recurso}` para lista/criação

---

## REFERÊNCIAS RÁPIDAS

### Comandos úteis
```bash
# Backend
npm run dev:backend           # Iniciar backend
npm run db:push              # Sincronizar schema
npm run db:seed              # Seed dados
npm run db:studio            # Prisma Studio
npx tsc --noEmit             # Typecheck

# Frontend
npm run dev:frontend          # Iniciar frontend
npx tsc --noEmit             # Typecheck
npx vitest run               # Testes

# Git
git log --oneline -20        # Últimos commits
git status                   # Status
git stash                    # Guardar alterações
git stash pop                # Recuperar alterações
```

### Arquivos de referência
- `AGENTS.md` — Regras para AI agents
- `CHANGELOG.md` — Histórico de versões
- `SPEC.md` — Especificação do sistema
- `PLAN.md` — Plano de desenvolvimento
- `docs/CHECKPOINT_PROJETO.md` — Este checkpoint
- `docs/SEGURANCA.md` — Documentação de segurança
- `docs/ARQUITETURA.md` — Arquitetura do sistema
- `docs/VARIAVEIS-AMBIENTE.md` — Variáveis documentadas
