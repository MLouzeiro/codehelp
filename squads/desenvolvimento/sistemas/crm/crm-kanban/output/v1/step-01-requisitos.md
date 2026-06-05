# Requisitos do CRM — Codemed Tecnologia

## Visão Geral
CRM simples para software house com cadastro de clientes, kanban de tarefas e dashboard. Usuários são automaticamente vendedores ou administradores.

## Módulos

### 1. Autenticação
- Login com email e senha
- JWT com access token (15min) + refresh token (7d)
- Logout

### 2. Gestão de Usuários (Admin apenas)
- CRUD de usuários
- Campos: nome, email, senha, role (admin/vendedor), telefone, ativo
- Admin pode criar, editar, ativar/desativar usuários

### 3. Perfis de Acesso (2 perfis)
| Perfil | Acesso |
|--------|--------|
| **Admin** | Tudo: criar/editir/deletar clientes, tarefas, usuários, ver todos os dados |
| **Vendedor** | CRUD próprios clientes, criar/editir próprias tarefas, ver próprio dashboard |

### 4. Cadastro de Clientes (Básico)
- Campos: Nome, Email, Telefone, Empresa
- Lista com busca por nome/email/empresa
- Vendedor vê apenas seus clientes
- Admin vê todos

### 5. Kanban de Tarefas (4 colunas)
- **A fazer** → **Em andamento** → **Concluído** → **Cancelado**
- Drag-and-drop entre colunas
- Cartão com: título, descrição, prioridade (baixa/média/alta/urgente), responsável, projeto, data de vencimento
- Admin pode atribuir tarefas a qualquer vendedor

### 6. Dashboard (Resumido)
- Cards: total de clientes, tarefas pendentes, tarefas concluídas
- Vendedor vê apenas seus números
- Admin vê números globais

## Regras de Negócio
1. Email de usuário deve ser único
2. Ao criar usuário, ele já nasce como vendedor (role: "vendedor") ou admin
3. Vendedor só vê e gerencia seus próprios clientes
4. Admin pode transferir clientes entre vendedores
5. Tarefa pode ser atribuída a qualquer vendedor pelo admin
6. Senhas armazenadas com bcrypt (cost 12)

## Histórias de Usuário

### US01 — Login
> Como usuário, quero fazer login com email e senha para acessar o sistema.

**Critérios:** Formulário com email + senha, validação, token JWT armazenado, redirecionamento ao dashboard.

### US02 — Gerenciar Usuários (Admin)
> Como admin, quero criar, editar e desativar usuários para gerenciar a equipe.

**Critérios:** CRUD completo, email único, definir role (admin/vendedor), ativar/desativar.

### US03 — Cadastrar Cliente
> Como vendedor, quero cadastrar clientes com nome, email, telefone e empresa.

**Critérios:** Formulário com campos básicos, cliente vinculado ao vendedor logado.

### US04 — Listar Clientes
> Como vendedor, quero listar e buscar meus clientes.

**Critérios:** Tabela com busca, vendedor vê só os dele, admin vê todos.

### US05 — Criar Tarefa
> Como usuário, quero criar tarefas no kanban para organizar meu trabalho.

**Critérios:** Título obrigatório, descrição opcional, prioridade, responsável, projeto, data.

### US06 — Mover Tarefa no Kanban
> Como usuário, quero arrastar tarefas entre colunas para atualizar o status.

**Critérios:** Drag-and-drop funcional, 4 colunas, ordem preservada.

### US07 — Ver Dashboard
> Como usuário, quero ver um dashboard com meus indicadores.

**Critérios:** Cards de total clientes, tarefas pendentes, tarefas concluídas.

### US08 — Editar Cliente
> Como vendedor, quero editar dados dos meus clientes.

**Critérios:** Salvar alterações, vendedor só edita próprios clientes.

### US09 — Excluir Cliente (Admin)
> Como admin, quero excluir clientes do sistema.

**Critérios:** Apenas admin pode excluir, confirmação antes de excluir.

### US10 — Filtrar Tarefas
> Como usuário, quero filtrar tarefas por responsável e projeto no kanban.

**Critérios:** Filtros no kanban, recarregar board conforme filtro.

## Modelo de Dados Conceitual

```
User (id, name, email, password, role, phone, active, createdAt)
  ↑
  |— Client (id, name, email, phone, company, sellerId, createdAt)
  |
  |— Task (id, title, description, status, priority, project, dueDate, assigneeId, order, createdAt)
```

- **User 1:N Client** (vendedor tem vários clientes)
- **User 1:N Task** (assignee)
- **Client** não tem relação direta com Task (tarefas são genéricas do usuário)

## Tecnologias
- **Backend:** Node.js + Express + TypeScript + Prisma + SQLite
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Recharts
- **Auth:** JWT + bcrypt
