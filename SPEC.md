# SPEC.md — CRM Kanban

## Problema

Os vendedores da software house não usam CRMs complexos porque exigem muito preenchimento. O sistema precisa ser simples, rápido e intuitivo para que os vendedores adotem no dia a dia. Hoje não há controle centralizado de clientes nem de tarefas da equipe.

## Usuários

| Perfil | Quantidade | Descrição |
|--------|-----------|-----------|
| Vendedor | 5 | Cria e gerencia seus próprios clientes e tarefas. Vê apenas seus dados no dashboard. |
| Gestor/Admin | 2 | Admin com visão geral de todos os vendedores, clientes e tarefas. Gerencia os usuários do sistema. |

**Total inicial:** 7 usuários. O sistema deve suportar crescimento futuro.

## Funcionalidades

### Essenciais

1. **Autenticação** — Login com email e senha. JWT com refresh token. Logout.
2. **Gestão de Usuários** (admin apenas) — CRUD de usuários. Definir papel (admin/vendedor). Ativar/desativar.
3. **Cadastro de Clientes** — Formulário simples (nome, email, telefone, empresa). Vendedor vê apenas seus clientes. Admin vê todos. Busca por nome/email/empresa.
4. **Kanban de Tarefas** — 4 colunas: A fazer → Em andamento → Concluído → Cancelado. Drag-and-drop entre colunas. Prioridade (baixa, média, alta, urgente). Responsável, projeto, data de vencimento.
5. **Dashboard** — 3 cards: total de clientes, tarefas pendentes, tarefas concluídas. Gráfico de tarefas por período e por status. Vendedor vê apenas seus números. Admin vê dados globais.

### Fora do escopo

- Pipeline de vendas (oportunidades)
- Relatórios exportáveis
- Integração com WhatsApp
- Notificações push ou email
- Aplicativo mobile nativo
- Multitenancy (clientes externos)

## Módulos

### Módulo 1 — Auth
Responsabilidades: login, refresh token, validação JWT, logout.

### Módulo 2 — Users (admin)
Responsabilidades: CRUD de usuários, controle de permissões (admin/vendedor), ativar/desativar.

### Módulo 3 — Clients
Responsabilidades: CRUD de clientes, busca, vínculo com vendedor, isolamento por papel.

### Módulo 4 — Tasks / Kanban
Responsabilidades: CRUD de tarefas, reordenação drag-and-drop, board agrupado por status, filtros (responsável, projeto).

### Módulo 5 — Dashboard
Responsabilidades: KPIs (total clientes, tarefas pendentes, tarefas concluídas), gráficos por período e status.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Banco | SQLite (dev/produção inicial) |
| Autenticação | JWT (access + refresh) + bcrypt |
| Frontend | React + Vite + TypeScript |
| Estilização | Tailwind CSS |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Roteamento | React Router DOM |
| HTTP Client | Axios (com interceptor de refresh) |

## Constraints técnicas

- **Performance:** API deve responder em < 200ms para listagens comuns.
- **Segurança:** Senhas hasheadas com bcrypt cost 12. JWT expira em 15min, refresh em 7d. Rate limit de 5 tentativas/hora no login.
- **Responsividade:** Funcionar em mobile (≥ 375px), tablet e desktop.
- **Offline:** Não é requisito.
- **Deploy:** Não definido — manter docker-compose opcional para futuro.

## Critérios de aceitação

1. **Login:** usuário e senha válidos → redireciona ao dashboard. Inválidos → mensagem de erro clara.
2. **Usuários:** admin cria vendedor → vendedor consegue logar com suas credenciais. Vendedor não acessa rota de usuários.
3. **Clientes:** vendedor cadastra cliente → cliente aparece na lista dele. Admin vê todos. Busca funciona por nome/email/empresa.
4. **Kanban:** tarefa criada aparece na coluna "A fazer". Arrastar para "Em andamento" persiste o status. Ordem é preservada.
5. **Dashboard:** cards refletem os números corretos conforme o perfil logado. Gráficos renderizam sem dados mockados.

---

**Decisões em aberto:**
- Nenhuma pendente.
