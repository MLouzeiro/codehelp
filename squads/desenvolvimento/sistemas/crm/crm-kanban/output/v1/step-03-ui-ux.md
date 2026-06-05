# Especificação de UI/UX — CRM Codemed

## Design System

### Paleta de Cores
```css
:root {
  /* Primary */
  --color-primary: #0D7377;        /* Teal - base */
  --color-primary-light: #14A3A8;
  --color-primary-dark: #095255;
  --color-primary-50: #E6F6F6;

  /* Neutral */
  --color-surface: #FFFFFF;
  --color-background: #F8FAFC;
  --color-border: #E2E8F0;
  --color-text: #0F172A;
  --color-text-secondary: #64748B;

  /* Semantic */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Priority Colors */
  --color-priority-baixa: #6B7280;
  --color-priority-media: #3B82F6;
  --color-priority-alta: #F59E0B;
  --color-priority-urgente: #EF4444;
}
```

### Tipografia
- **Display/Headings:** Inter (sans-serif), weights 600-700
- **Body:** Inter (sans-serif), weight 400-500
- **Sizes:** 14px (small), 16px (body), 18px (h3), 20px (h2), 24px (h1)

### Componentes

**Botões**
- Primary: bg primary, white text, rounded-lg, px-4 py-2
- Secondary: bg white, border, text primary
- Ghost: no bg, text neutral, hover:bg neutral-50

**Inputs**
- Borda 1px solid border, rounded-lg, px-3 py-2, focus: ring primary
- Label acima do input, text-sm font-medium

**Cards**
- White bg, rounded-xl, shadow-sm, border 1px border-color
- Padding: p-4 ou p-6

**Badges**
- Rounded-full, px-2 py-0.5, text-xs font-medium
- Cores por status/prioridade

**Tabelas**
- Header bg gray-50, text-sm font-semibold
- Rows alternadas ou com divider
- Ações no final da linha (ícones)

## Telas

### 1. Tela de Login
```
┌─────────────────────────────────────┐
│          [Logo Codemed]             │
│          Acessar plataforma         │
│         Faça login para continuar   │
│                                     │
│  ┌───────┐                         │
│  │ Email │_________________________│
│  └───────┘                         │
│  ┌───────┐                         │
│  │ Senha │_________________________│
│  └───────┘                         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         Entrar              │   │
│  └─────────────────────────────┘   │
│                                     │
│         Voltar para o site          │
└─────────────────────────────────────┘
```
- **Estados:** Loading (botão desabilitado "Entrando..."), Erro (banner vermelho acima do form)

### 2. Layout Principal (Sidebar + Header)
```
┌────────────┬─────────────────────────────────┐
│  [C]       │  [User Avatar] Nome    [▼]      │
│  Codemed   ├─────────────────────────────────┤
│             │                                 │
│  📊 Dash   │        [CONTEÚDO]               │
│  👥 CRM    │                                 │
│  📋 Tarefas│                                 │
│             │                                 │
│  ⚙️ Configs│                                 │
│             │                                 │
└────────────┴─────────────────────────────────┘
```
- **Sidebar:** 64px (collapsed) / 256px (expanded), bg white, border-right
- **Header:** 64px, bg white, border-bottom, user avatar + name + dropdown sair
- **Responsivo:** Mobile: sidebar oculta com hamburger

### 3. Dashboard
```
┌─────────────────────────────────────────────┐
│ Dashboard                                    │
│ Visão geral do seu desempenho               │
│                                              │
│ ┌────────┐ ┌────────┐ ┌──────────────┐      │
│ │ 👥     │ │ 📋     │ │ ✅           │      │
│ │Clientes│ │Pendentes│ │Concluídas    │      │
│ │  42    │ │   8     │ │   15         │      │
│ └────────┘ └────────┘ └──────────────┘      │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │ 📈 Tarefas por Período                 │   │
│ │ [Gráfico de linha]                     │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │ 📊 Tarefas por Status                  │   │
│ │ [Gráfico de barras]                    │   │
│ └────────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```
- **Cards:** 3 cards lado a lado (Clientes, Pendentes, Concluídas)
- **Gráficos:** 2 gráficos (linha para período, barra para status)
- **Vendedor:** vê apenas seus números
- **Admin:** dropdown para filtrar por vendedor

### 4. Lista de Clientes
```
┌─────────────────────────────────────────────┐
│ Clientes                    [+ Novo Cliente] │
│                                              │
│ [🔍 Buscar cliente...       ]               │
│                                              │
│ ┌─────────────────────────────────────────┐  │
│ │ Nome     │ Email        │ Tel    │ Ações│  │
│ ├─────────┼──────────────┼───────┼──────┤  │
│ │ João    │ joao@em...   │ 1199..│ ✏️ 🗑️ │  │
│ │ Maria   │ maria@e...   │ 1198..│ ✏️ 🗑️ │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│                        [1] [2] [3] ...       │
└─────────────────────────────────────────────┘
```
- **Busca:** input com debounce, busca por nome/email/empresa
- **Tabela:** colunas Nome, Email, Telefone, Empresa, Ações
- **Ações:** Editar (admin/vendedor), Excluir (admin apenas)
- **Empty state:** "Nenhum cliente cadastrado" + botão "Cadastrar primeiro cliente"
- **Loading:** Skeleton rows

### 5. Formulário de Cliente
```
┌─────────────────────────────────────────────┐
│ [← Voltar]  Novo Cliente                    │
│                                              │
│ ┌─────────────────────────────────────────┐  │
│ │ Nome*     [__________________________]  │  │
│ │ Email     [__________________________]  │  │
│ │ Telefone  [__________________________]  │  │
│ │ Empresa   [__________________________]  │  │
│ │                                          │  │
│ │ [Cancelar]          [Salvar]             │  │
│ └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```
- **Validação:** Nome obrigatório, email com formato válido
- **Loading:** Botão Salvar desabilitado "Salvando..."

### 6. Kanban
```
┌─────────────────────────────────────────────────────────┐
│ Kanban                                    [+ Nova Tarefa]│
│ [Filtro: Responsável ▼] [Projeto ▼]                     │
│                                                          │
│ ┌───────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│ │A Fazer │ │Andamento │ │Concluído │ │ Cancelado    │   │
│ │   3    │ │    2     │ │    5     │ │     1        │   │
│ ├───────┤ ├──────────┤ ├──────────┤ ├──────────────┤   │
│ │Card 1 │ │Card 4    │ │Card 6    │ │Card 9        │   │
│ │Card 2 │ │Card 5    │ │Card 7    │ │              │   │
│ │Card 3 │ │          │ │Card 8    │ │              │   │
│ └───────┘ └──────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```
- **Colunas:** 4 colunas lado a lado, scroll horizontal
- **Cards:** titulo, prioridade badge, responsável, data
- **Drag-and-drop:** arrastar card entre colunas
- **Empty column:** "Nenhuma tarefa" + ícone
- **Nova tarefa:** Modal com formulário

### 7. Card da Tarefa (Kanban)
```
┌──────────────────────┐
│ 🔴 Alta              │
│ Implementar login    │
│                      │
│ Implementar o módulo │
│ de autenticação...   │
│                      │
│ 👤 Carlos  📅 15/06 │
│ 🏷️ Projeto CRM      │
└──────────────────────┘
```
- **Prioridade:** bolinha colorida (baixa=cinza, media=azul, alta=amarelo, urgente=vermelho)
- **Título:** bold, truncate 2 linhas
- **Descrição:** texto menor, line-clamp 2
- **Footer:** responsável, data, projeto badge

### 8. Gestão de Usuários (Admin)
```
┌─────────────────────────────────────────────┐
│ Usuários                    [+ Novo Usuário] │
│                                              │
│ ┌─────────────────────────────────────────┐  │
│ │ Nome     │ Email      │ Role    │ Status│  │
│ ├─────────┼────────────┼────────┼───────┤  │
│ │ Admin   │ admin@...  │ Admin  │ ✅    │  │
│ │ João    │ joao@...   │ Vended.│ ✅    │  │
│ │ Maria   │ maria@...  │ Vended.│ ❌    │  │
│ └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```
- **Ações:** Editar, Ativar/Desativar
- **Modal de criação:** Nome, Email, Senha, Role (Admin/Vendedor)

## Fluxo de Navegação
```
Login → Dashboard
         ├── Clientes → Novo Cliente
         │            → Detalhe → Editar
         ├── Kanban → Nova Tarefa
         └── Usuários (admin) → Novo Usuário
                               → Editar Usuário
```

## Responsividade

### Mobile (< 768px)
- Sidebar oculta com hamburger
- Cards do dashboard em coluna única
- Tabelas com scroll horizontal
- Kanban com scroll horizontal
- Formulários em largura total

### Desktop (≥ 768px)
- Sidebar visível
- Cards em grid
- Tabelas com largura total
- Kanban com 4 colunas visíveis

## Estados de UI

| Estado | Ação |
|--------|------|
| **Loading** | Skeleton/spinner no lugar do conteúdo |
| **Empty** | Mensagem + CTA (ex: "Nenhum cliente. Cadastre o primeiro!") |
| **Error** | Banner de erro com mensagem + botão "Tentar novamente" |
| **Success** | Feedback visual (toast) após criar/editar |
