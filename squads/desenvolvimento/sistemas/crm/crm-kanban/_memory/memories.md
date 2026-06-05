# CRM Kanban — Squad Memory

## Squad Overview
Squad responsável por construir um CRM completo com Kanban, Dashboard e gestão de vendedores para a Codemed Tecnologia.

## Tech Stack
- **Backend:** Node.js + Express + TypeScript + Prisma + SQLite
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Recharts
- **Auth:** JWT (access + refresh token) + bcrypt
- **Database:** SQLite (dev) / PostgreSQL (prod)

## Agents
| ID | Name | Role |
|----|------|------|
| analista-requisitos | Ana Oliveira | Business Analyst |
| arquiteto | Carlos Silva | Tech Lead / Architect |
| ux-designer | Julia Costa | UX/UI Designer |
| backend-dev | Marcos Santos | Backend Developer |
| frontend-dev | Fernanda Lima | Frontend Developer |
| revisor | Thiago Alves | Code Reviewer |
| qa | Patrícia Souza | QA Engineer |

## Pipeline
7 steps: Requirements → Architecture → UI/UX → Backend → Frontend → Review → QA

## Key Decisions
- Monorepo structure with /backend and /frontend
- SQLite for simplicity in development
- JWT with short-lived access token (15min) + long-lived refresh token (7d)
- Role-based access: admin > vendedor (2 perfis)
- Drag-and-drop kanban via HTML5 native drag API

## Run History

### v1 (2026-05-30)
**Resultado:** Pipeline concluída com sucesso.
- Requisitos: 10 histórias de usuário, 3 módulos (Clientes, Kanban, Dashboard)
- Arquitetura: Schema Prisma, 15 rotas API, estrutura monorepo
- UI/UX: 8 telas especificadas com design system completo
- Backend: 5 controllers, middleware de auth, Prisma schema, seed
- Frontend: 9 páginas React com Tailwind, auth, kanban drag-and-drop
- Revisão: Aprovado com ressalvas, 8 issues encontradas (2 alta, 3 média, 3 baixa)
- QA: 28 casos de teste, 25 passaram, 2 bugs encontrados

**Bugs encontrados:**
1. Vendedor pode criar tarefa para outro usuário (assigneeId livre)
2. Vendedor pode acessar DELETE /api/clients (verificar se middleware está aplicado)

## Learnings
- Manter consistência entre nomes de campos em português (requirements) e inglês (código)
- Validação de role precisa ser verificada em todos os endpoints
- Frontend com proxy Vite resolve CORS em dev
