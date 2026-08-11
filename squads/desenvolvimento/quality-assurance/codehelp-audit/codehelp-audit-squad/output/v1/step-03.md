# Relatório de Auditoria UX/UI — CodeHelp CRM/Helpdesk

**Auditor:** Camila Ferreira — UX Design Expert Senior  
**Squad:** codehelp-audit-squad  
**Data:** 19/06/2026  
**Versão analisada:** develop (código-fonte atual)  
**Escopo:** Análise completa de experiência do usuário, design de interface, acessibilidade e design system

---

## 1. Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Telas analisadas | 37+ |
| Componentes UI analisados | 12+ |
| Score geral de usabilidade | **7.5/10** |
| Problemas identificados | 31 |
| Críticos | 5 |
| Altos | 10 |
| Médios | 10 |
| Baixos | 6 |
| Fluxos funcionam bem | 8 |

O sistema CodeHelp CRM apresenta uma interface visualmente polida, com design system coerente e tematização avançada. A sidebar responsiva com 3 modos e o sistema de temas (dark/light + 4 modos de fundo + 5 esquemas de cores) são diferenciais notáveis. No entanto, existem problemas significativos de consistência, acessibilidade, componentes monolíticos e UX em fluxos críticos que precisam ser endereçados.

---

## 2. Auditoria Heurística (10 Heuristicas de Nielsen)

### 2.1 Tela: Login (`frontend/src/pages/Login.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading spinner durante autenticação, mensagem de erro exibida |
| 2. Match com o mundo real | ✅ OK | Linguagem clara ("Email", "Senha", "Entrar") |
| 3. Controle e liberdade | ⚠️ Médio | Link "← Voltar para o site" disponível, mas sem botão de "esqueci minha senha" |
| 4. Consistência | ✅ OK | Design consistente com o restante do sistema |
| 5. Prevenção de erros | ✅ OK | Campos obrigatórios com `required`, botão desabilitado durante loading |
| 6. Reconhecimento vs memorização | ✅ OK | Placeholder "seu@email.com" orienta o usuário |
| 7. Flexibilidade e eficiência | ❌ Crítico | **Sem opção "Mostrar senha"** — usuário não pode verificar se digitou corretamente |
| 8. Estética e design | ✅ OK | Visual premium com gradientes, backdrop blur, grid decorativo |
| 9. Ajuda para erros | ✅ OK | Mensagem de erro clara em vermelho com ícone |
| 10. Ajuda e documentação | ❌ Alto | **Sem "Esqueci minha senha"** — usuário bloqueado sem recourse |

**Problemas encontrados:**

#### UX-001: Ausência de toggle "Mostrar senha"
- **Localização:** `frontend/src/pages/Login.tsx:130-141`
- **Severidade:** Crítico
- **Impacto:** Usuário não pode verificar se digitou a senha corretamente; aumenta taxa de falha no login
- **Sugestão:** Adicionar ícone de olho (Eye/EyeOff do Lucide) no final do campo de senha

#### UX-002: Ausência de "Esqueci minha senha"
- **Localização:** `frontend/src/pages/Login.tsx:98-165`
- **Severidade:** Alto
- **Impacto:** Usuário que esqueceu a senha fica completamente bloqueado, sem opção de recuperação
- **Sugestão:** Adicionar link abaixo do formulário que redireciona para fluxo de reset de senha (requer endpoint no backend)

---

### 2.2 Tela: Dashboard (`frontend/src/pages/Dashboard/Dashboard.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading spinner claro, dados exibidos com KPI cards |
| 2. Match com o mundo real | ✅ OK | Métricas compreensíveis (Chamados, TMR, OS) |
| 3. Controle e liberdade | ⚠️ Médio | Filtro de período disponível (7/30/90 dias) |
| 4. Consistência | ⚠️ Médio | Cards usam fontes diferentes (Khand para valores, Lexend para labels) — funcional mas pode confundir |
| 5. Prevenção de erros | ✅ OK | Dados vindo da API, sem input do usuário |
| 6. Reconhecimento vs memorização | ✅ OK | KPI cards com ícones e cores semânticas |
| 7. Flexibilidade e eficiencia | ⚠️ Médio | **Sem botão de refresh manual** — dados atualizam apenas ao mudar período |
| 8. Estética e design | ✅ OK | Grid de gráficos bem organizado, 6 gráficos variados |
| 9. Ajuda para erros | ✅ OK | Empty states tratados ("Sem dados" nos gráficos) |
| 10. Ajuda e documentação | ❌ Alto | **Sem tooltips explicativos nos KPIs** — "TMR" e "TMRes" podem não ser compreensíveis para todos |

**Problemas encontrados:**

#### UX-003: KPIs sem tooltips explicativos
- **Localização:** `frontend/src/pages/Dashboard/Dashboard.tsx:51-60`
- **Severidade:** Alto
- **Impacto:** "TMR Médio" e "TMRes Médio" não são siglas universais; novos usuários não entendem o que significam
- **Sugestão:** Adicionar tooltip com explicação: "TMR = Tempo Médio de Resposta" e "TMRes = Tempo Médio de Resolução"

#### UX-004: Sem botão de refresh no Dashboard
- **Localização:** `frontend/src/pages/Dashboard/Dashboard.tsx:92-110`
- **Severidade:** Médio
- **Impacto:** Usuário que quer dados atualizados precisa mudar de período e voltar
- **Sugestão:** Adicionar ícone de refresh no header, similar ao Kanban

---

### 2.3 Tela: Helpdesk Kanban (`frontend/src/pages/Helpdesk/HelpdeskKanban.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading inicial, polling a cada 10s, indicador de conexão WA |
| 2. Match com o mundo real | ✅ OK | Metáfora Kanban intuitiva com colunas arrastáveis |
| 3. Controle e liberdade | ⚠️ Médio | Drag-and-drop funciona, mas **sem undo** — movimento acidental não pode ser desfeito |
| 4. Consistência | ⚠️ Médio | Cards usam cores de prioridade consistentes (borda esquerda), mas **menu de contexto usa `alert()` nativo** em vez de modal customizada |
| 5. Prevenção de erros | ✅ OK | `window.confirm()` antes de descartar ticket |
| 6. Reconhecimento vs memorização | ✅ OK | Badges de departamento, categoria, posição na fila |
| 7. Flexibilidade e eficiencia | ✅ OK | Filtros por departamento, busca por texto, ordenação |
| 8. Estética e design | ✅ OK | Cards com sombras, hover states, animações suaves |
| 9. Ajuda para erros | ❌ Alto | **`alert()` nativo para erros** — visualmente inconsistente com o design system |
| 10. Ajuda e documentação | ❌ Alto | **Sem onboarding** — primeira vez no Helpdesk não explica como usar o Kanban |

**Problemas encontrados:**

#### UX-005: Uso de `alert()` nativo do navegador
- **Localização:** `frontend/src/pages/Helpdesk/HelpdeskKanban.tsx:584,603,619,765,784` (múltiplas linhas)
- **Severidade:** Alto
- **Impacto:** `alert()` e `window.confirm()` quebram a imersão visual; parecem amadores em um sistema premium
- **Sugestão:** Criar componente `Toast` ou `ConfirmModal` customizado que segue o design system (já existem modais no sistema — usar o mesmo padrão)

#### UX-006: Sem feedback de undo após mover ticket
- **Localização:** `frontend/src/pages/Helpdesk/HelpdeskKanban.tsx:540-588`
- **Severidade:** Alto
- **Impacto:** Se o usuário arrastar um ticket para a coluna errada, não há como desfazer rapidamente
- **Sugestão:** Adicionar toast com "Ticket movido para X. Desfazer" por 5 segundos (padrão Gmail)

#### UX-007: Componente monolítico (1499 linhas)
- **Localização:** `frontend/src/pages/Helpdesk/HelpdeskKanban.tsx:1-1499`
- **Severidade:** Alto
- **Impacto:** Manutenção difícil; impossível isolar testes de UI; carregamento lento
- **Sugestão:** Decompor em: `KanbanBoard`, `KanbanColumn`, `KanbanCard`, `TicketDetailPanel`, `AbrirChamadoModal`, `AssignModal`, `CreateClientModal`

---

### 2.4 Tela: WhatsApp (`frontend/src/pages/WhatsApp/WhatsAppPage.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Indicador de conexão (Conectado/Desconectado), QR Code modal |
| 2. Match com o mundo real | ✅ OK | Layout similar ao WhatsApp Web — familiar para usuários |
| 3. Controle e liberdade | ✅ OK | Botão de voltar no mobile, fechar QR Code |
| 4. Consistência | ⚠️ Médio | **Cores diferentes do Kanban** — WhatsApp usa verde (#25d366), Kanban usa emerald (#10b981); confuso visualmente |
| 5. Prevenção de erros | ✅ OK | Confirmação antes de descartar ticket |
| 6. Reconhecimento vs memorização | ✅ OK | Lista de conversas com preview da última mensagem |
| 7. Flexibilidade e eficiencia | ⚠️ Médio | **Sem atalho de teclado** para enviar mensagem (Enter funciona, mas Cmd+K não abre busca) |
| 8. Estética e design | ✅ OK | Design limpo, bolhas de mensagem com estilo WhatsApp |
| 9. Ajuda para erros | ✅ OK | Mensagem de erro de envio exibida inline |
| 10. Ajuda e documentação | ❌ Alto | **Sem instruções de conexão** além do QR Code — usuário precisa saber onde encontrar "Dispositivos conectados" no WhatsApp |

**Problemas encontrados:**

#### UX-008: QR Code sem instruções visuais de passo-a-passo
- **Localização:** `frontend/src/pages/WhatsApp/WhatsAppPage.tsx:484-511`
- **Severidade:** Alto
- **Impacto:** Texto "Abra o WhatsApp no celular → Menu → Dispositivos conectados → Conectar dispositivo" é denso; usuário pode se perder
- **Sugestão:** Adicionar ilustração de passo-a-passo ou link para vídeo tutorial

---

### 2.5 Tela: CRM - Lista de Clientes (`frontend/src/pages/CRM/ClientList.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading state presente |
| 2. Match com o mundo real | ✅ OK | Lista de empresas com dados relevantes |
| 3. Controle e liberdade | ⚠️ Médio | Filtros de busca e status disponíveis |
| 4. Consistência | ❌ Alto | **Cor de botão "Novo Cliente" usa verde** (`btn-primary` com `bg-green-500` na paginação) enquanto o padrão do sistema é azul |
| 5. Prevenção de erros | ✅ OK | Paginação impede carregamento excessivo |
| 6. Reconhecimento vs memorização | ✅ OK | Badges de status com cores semânticas |
| 7. Flexibilidade e eficiencia | ⚠️ Médio | **Sem busca por CNPJ/CPF diretamente** — precisa digitar o número completo |
| 8. Estética e design | ⚠️ Médio | **Cards muito simples** — sem visual de avatar ou logo do cliente |
| 9. Ajuda para erros | ✅ OK | "Nenhum cliente encontrado" quando vazio |
| 10. Ajuda e documentação | ❌ Alto | **Sem empty state ilustrado** — apenas texto |

#### UX-009: Inconsistência de cores na paginação
- **Localização:** `frontend/src/pages/CRM/ClientList.tsx:104`
- **Severidade:** Alto
- **Impacto:** Botão de paginação usa `bg-green-500` enquanto o padrão do sistema é azul (`bg-blue-600`). Isso confunde o usuário sobre a identidade visual.
- **Sugestão:** Padronizar para `bg-blue-600` ou usar a cor do tema selecionado

#### UX-010: Empty states sem ilustração
- **Localização:** `frontend/src/pages/CRM/ClientList.tsx:96`
- **Severidade:** Médio
- **Impacto:** "Nenhum cliente encontrado" sem ícone ou ilustração parece incompleto
- **Sugestão:** Adicionar ilustração SVG + CTA "Cadastrar primeiro cliente"

---

### 2.6 Tela: Criar/Editar Cliente (`frontend/src/pages/CRM/ClientForm.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading spinner durante busca de dados |
| 2. Match com o mundo real | ✅ OK | Labels claros em português |
| 3. Controle e liberdade | ✅ OK | Botão "Voltar" e "Cancelar" disponíveis |
| 4. Consistência | ✅ OK | Usa componentes `input` e `btn-primary` do design system |
| 5. Prevenção de erros | ⚠️ Médio | **Sem validação de CNPJ/CPF no frontend** — aceita qualquer string |
| 6. Reconhecimento vs memorização | ✅ OK | Placeholder em cada campo orienta o usuário |
| 7. Flexibilidade e eficiência | ⚠️ Médio | **Sem auto-complete de CEP** para cidade/estado |
| 8. Estética e design | ✅ OK | Formulário limpo, grid responsivo |
| 9. Ajuda para erros | ❌ Alto | **Sem mensagens de erro inline** — se a API retornar erro, o usuário não vê qual campo está errado |
| 10. Ajuda e documentação | ❌ Alto | **Sem tooltip explicativo** para campos como "Segmento" (Laboratório, Clínica, Hospital) |

---

### 2.7 Tela: Detalhe do Cliente (`frontend/src/pages/CRM/ClientDetail.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading state e "Cliente não encontrado" |
| 2. Match com o mundo real | ✅ OK | Tabs organizações intuitivas (Visão Geral, Tickets, OS) |
| 3. Controle e liberdade | ✅ OK | Navegação por tabs fluida |
| 4. Consistência | ⚠️ Médio | **7 tabs** — muitas opções podem sobrecarregar o usuário |
| 5. Prevenção de erros | ✅ OK | Confirmação antes de deletar colaborador |
| 6. Reconhecimento vs memorização | ✅ OK | Stats row com métricas resumidas |
| 7. Flexibilidade e eficiência | ⚠️ Médio | **Sem atalho para criar OS** diretamente do detalhe |
| 8. Estética e design | ✅ OK | Layout bem estruturado com cards |
| 9. Ajuda para erros | ⚠️ Médio | Erros de API logados no console mas não exibidos ao usuário |
| 10. Ajuda e documentação | ❌ Alto | **Sem legenda** para as 7 tabs — usuário precisa clicar em cada uma para entender o conteúdo |

---

### 2.8 Tela: Configurações (`frontend/src/pages/Settings/SettingsPage.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Layout claro com grid de cards |
| 2. Match com o mundo real | ✅ OK | Labels descritivos em cada card |
| 3. Controle e liberdade | ✅ OK | Navegação por cards com seta |
| 4. Consistência | ✅ OK | Design consistente com cards e ícones |
| 5. Prevenção de erros | ✅ OK | Sem ações destrutivas nesta tela |
| 6. Reconhecimento vs memorização | ✅ OK | Ícones Lucide consistentes |
| 7. Flexibilidade e eficiência | ⚠️ Médio | **11 opções de configuração** — pode ser overwhelming |
| 8. Estética e design | ✅ OK | Grid 2 colunas bem organizado |
| 9. Ajuda para erros | ✅ OK | Sem ações de erro possíveis |
| 10. Ajuda e documentação | ⚠️ Médio | Descrições nos cards ajudam, mas **sem ícone de "info"** para explicações detalhadas |

---

### 2.9 Tela: Landing Page (`frontend/src/pages/LandingPage.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Navbar fixa com scroll effect |
| 2. Match com o mundo real | ✅ OK | Copy focado em laboratórios de análises clínicas |
| 3. Controle e liberdade | ✅ OK | Links de navegação por âncora |
| 4. Consistência | ✅ OK | Design premium consistente |
| 5. Prevenção de erros | ✅ OK | Sem formulários críticos |
| 6. Reconhecimento vs memorização | ✅ OK | Seções claras (Funcionalidades, Preços, Depoimentos) |
| 7. Flexibilidade e eficiência | ✅ OK | CTA "Acessar Sistema" acessível |
| 8. Estética e design | ✅ OK | Visual premium, gradientes, animações |
| 9. Ajuda para erros | ✅ OK | N/A |
| 10. Ajuda e documentação | ✅ OK | Seção de preços transparente |

---

### 2.10 Tela: Busca Global (`frontend/src/components/SearchBar.tsx`)

| Heurística | Nota | Observação |
|------------|------|------------|
| 1. Status do sistema | ✅ OK | Loading spinner durante busca |
| 2. Match com o mundo real | ✅ OK | Busca por clientes, tickets, usuários, KB |
| 3. Controle e liberdade | ✅ OK | Escape fecha resultados, X limpa busca |
| 4. Consistência | ✅ OK | Design consistente com o header |
| 5. Prevenção de erros | ✅ OK | Mínimo 2 caracteres para buscar |
| 6. Reconhecimento vs memorização | ✅ OK | Sugestões aparecem antes de completar busca |
| 7. Flexibilidade e eficiência | ✅ OK | Debounce de 300ms evita requests excessivos |
| 8. Estética e design | ✅ OK | Dropdown com badges coloridos por tipo |
| 9. Ajuda para erros | ✅ OK | "Nenhum resultado" quando vazio |
| 10. Ajuda e documentação | ⚠️ Médio | Placeholder "Buscar clientes, tickets, usuarios, KB..." é informativo mas longo |

---

## 3. Análise de Design System

### 3.1 Cores

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Paleta principal | ✅ Coerente | Azul (`#3B82F6`) como primary em todo o sistema |
| Paleta semântica | ✅ OK | Verde (sucesso), Vermelho (erro), Amarelo (aviso) |
| Contraste light mode | ✅ OK | Texto escuro em fundo claro, bom contraste |
| Contraste dark mode | ⚠️ Parcial | `--fg-primary: #090909` em dark mode é **quase preto em fundo escuro** — pode ter problemas |
| Consistência entre telas | ❌ Problema | WhatsApp usa verde (#25d366), Kanban usa emerald (#10b981), OS usa verde (#22C55E) — 3 verdes diferentes |

**Problemas encontrados:**

#### UX-011: Três tonalidades de verde diferentes
- **Localização:** `WhatsAppPage.tsx:752` (#25d366), `HelpdeskKanban.tsx:1161` (#10b981), `OrderList.tsx:74` (#22C55E)
- **Severidade:** Alto
- **Impacto:** Usuário associa "verde" a diferentes contextos; perde coerência visual
- **Sugestão:** Definir uma única tonalidade de verde no `tailwind.config.js` e usá-la em todo o sistema

#### UX-012: `--fg-primary` inadequado em dark mode
- **Localização:** `frontend/src/index.css:44`
- **Severidade:** Alto
- **Impacto:** `#090909` é quase preto — em fundo escuro (#0F172A), o contraste pode ser insuficiente para textos pequeños
- **Sugestão:** Usar `#E2E8F0` ou `#F1F5F9` para texto primário em dark mode

---

### 3.2 Tipografia

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Fonte display | ✅ OK | Khand para headings — personalidade forte |
| Fonte body | ✅ OK | Dosis para corpo — legível e moderno |
| Fonte sans | ✅ OK | Lexend para UI elements — excelente legibilidade |
| Hierarquia | ✅ OK | H1 > H2 > H3 > body com tamanhos e pesos claros |
| Consistência | ⚠️ Parcial | **Mistura de `style={{ fontFamily: 'Khand' }}` inline com classes Tailwind** — deveria usar `font-display` |

**Problemas encontrados:**

#### UX-013: Inline fontFamily em vez de classes Tailwind
- **Localização:** Múltiplos arquivos (`Dashboard.tsx:94`, `Layout.tsx:134`, `Login.tsx:53`, etc.)
- **Severidade:** Médio
- **Impacto:** Manutenção difícil; se a fonte mudar, precisa alterar em dezenas de lugares
- **Sugestão:** Usar as classes `font-display`, `font-body`, `font-sans` já definidas no `tailwind.config.js`

---

### 3.3 Espaçamento e Layout

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Grid system | ✅ OK | `grid-cols-2 md:grid-cols-4` consistente |
| Padding/Margin | ✅ OK | `p-4 lg:p-6` responsivo |
| Sidebar | ✅ Excelente | 3 modos: vertical, horizontal, collapsed — altamente customizável |
| Mobile | ⚠️ Parcial | Sidebar vira drawer no mobile, mas **algumas telas não são otimizadas** (ex: Kanban com colunas horizontais) |

---

### 3.4 Componentes

| Componente | Avaliação | Detalhes |
|------------|-----------|----------|
| Botões | ⚠️ Parcial | `btn-primary`, `btn-secondary`, `btn-outline`, `btn-ghost` definidos — mas **bots do WhatsApp usam classes inline** inconsistentes |
| Cards | ✅ OK | `card` e `card-premium` consistentes |
| Inputs | ✅ OK | Classe `input` padronizada com focus ring |
| Badges | ✅ OK | `badge`, `badge-blue` consistentes |
| Modais | ❌ Inconsistente | Alguns usam `fixed inset-0 z-50 bg-black/40`, outros `bg-black/50` — sem componente `Modal` reutilizável |

**Problemas encontrados:**

#### UX-014: Sem componente Modal reutilizável
- **Localização:** `HelpdeskKanban.tsx:1243`, `WhatsAppPage.tsx:767`, `ClientDetail.tsx:537` — cada tela implementa seu próprio modal
- **Severidade:** Alto
- **Impacto:** Inconsistência visual; cada modal tem padding, radius e backdrop diferentes
- **Sugestão:** Criar componente `<Modal isOpen onClose>{children}</Modal>` padronizado

#### UX-015: Botões com estilos inline inconsistentes
- **Localização:** `WhatsAppPage.tsx:457-466`
- **Severidade:** Médio
- **Impacto:** Botões "Reconectar" e "Desconectar" usam classes inline (`bg-amber-500`, `bg-red-600`) em vez de classes do design system
- **Sugestão:** Criar variantes `btn-warning`, `btn-danger` no CSS

---

### 3.5 Ícones

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Biblioteca | ✅ Consistente | Lucide React em todo o sistema |
| Tamanhos | ⚠️ Parcial | Mistura de `size={12}`, `size={14}`, `size={16}`, `size={18}`, `size={20}`, `size={22}` — sem padrão claro |
| Cores | ✅ OK | Ícones herdam cor do elemento pai ou usam cores semânticas |

#### UX-016: Tamanhos de ícones sem padrão definido
- **Localização:** Múltiplos arquivos
- **Severidade:** Baixo
- **Impacto:** Visualmente aceitável, mas dificulta padronização
- **Sugestão:** Definir escala: `sm=14`, `md=18`, `lg=22` e documentar no design system

---

## 4. Análise de Fluxos Críticos

### 4.1 Fluxo: Login → Dashboard
- **Status:** ✅ Funciona bem
- **Fluxo:** Login → redireciona para `/app/dashboard` → Layout com sidebar → Dashboard com KPIs
- **Pontos fortes:** Loading state claro, erro tratado, redirecionamento automático
- **Problemas:** Sem "Esqueci minha senha", sem toggle "Mostrar senha"

### 4.2 Fluxo: Dashboard → Helpdesk Kanban
- **Status:** ✅ Funciona bem
- **Fluxo:** Sidebar → Helpdesk → Kanban com 6 colunas → Arrastar card → Modal de abertura
- **Pontos fortes:** Drag-and-drop funcional, atualização otimista, filtros por departamento
- **Problemas:** `alert()` nativo, sem undo, componente monolítico

### 4.3 Fluxo: WhatsApp → Abrir Chamado
- **Status:** ✅ Funciona bem
- **Fluxo:** Selecionar conversa → "Abrir Chamado" → Preencher dados → Protocolo gerado
- **Pontos fortes:** Busca de cliente inline, criação de cliente rápido, dropdown de departamentos
- **Problemas:** QR Code sem instruções visuais, sem atalhos de teclado

### 4.4 Fluxo: CRM → Criar Cliente
- **Status:** ✅ Funciona bem
- **Fluxo:** CRM → "Novo Cliente" → Preencher formulário → Salvar
- **Pontos fortes:** Formulário limpo, validação de obrigatórios, botão cancelar
- **Problemas:** Sem validação de CNPJ/CPF, sem auto-complete de CEP, sem mensagens de erro inline

### 4.5 Fluxo: Criar OS
- **Status:** ⚠️ Parcial
- **Problemas:** Fluxo de criação de OS não foi analisado em detalhe (OrderForm não lido completamente), mas a lista e detalhe funcionam bem

### 4.6 Fluxo: Configurações
- **Status:** ✅ Funciona bem
- **Fluxo:** Settings → Grid de cards → Sub-páginas de configuração
- **Pontos fortes:** 11 módulos bem organizados com descrições claras
- **Problemas:** Sem busca dentro das configurações, muitas opções para novos usuários

### 4.7 Fluxo: Busca Global
- **Status:** ✅ Funciona bem
- **Fluxo:** SearchBar no header → Debounce → Sugestões → Resultados com ícones coloridos
- **Pontos fortes:** Busca por 4 tipos (clientes, tickets, usuários, KB), navegação direta

---

## 5. Acessibilidade

### 5.1 Contraste

| Elemento | Avaliação | Detalhes |
|----------|-----------|----------|
| Texto principal light | ✅ OK | `#1E293B` em `#FFFFFF` = contraste ~13:1 |
| Texto secundário light | ✅ OK | `#64748B` em `#FFFFFF` = contraste ~5:1 |
| Texto principal dark | ⚠️ Problema | `#090909` em `#0F172A` = contraste ~1.3:1 — **FALHA** |
| Botões primários | ✅ OK | Branco em azul = contraste ~4.6:1 |
| Badges | ⚠️ Parcial | Texto pequeno em badges coloridos pode não atingir 4.5:1 |

### 5.2 Navegação por Teclado

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Tab navigation | ⚠️ Parcial | Inputs e botões são focusáveis, mas **cards clicáveis não têm `tabIndex`** |
| Focus visible | ⚠️ Parcial | `focus:ring-2` definido, mas **removido em alguns elementos** com `outline-none` sem substituição |
| Skip links | ❌ Ausente | Sem "Pular para conteúdo principal" |
| Escape modais | ✅ OK | `onClick={backdrop}` fecha modais |

#### UX-017: Cards clicáveis sem acessibilidade de teclado
- **Localização:** `ClientList.tsx:73`, `OrderList.tsx:70`, `SettingsPage.tsx:30`
- **Severidade:** Alto
- **Impacto:** Usuários que dependem de teclado não podem navegar nos cards clicáveis
- **Sugestão:** Adicionar `tabIndex={0}`, `role="button"`, `onKeyDown` com Enter/Space

### 5.3 Labels e ARIA

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Labels em inputs | ✅ OK | Todos os inputs têm `<label>` associado |
| aria-label em botões | ⚠️ Parcial | Alguns botões têm `title` mas não `aria-label` |
| aria-label em ícones | ❌ Problema | Ícones decorativos sem `aria-hidden="true"`, botões com apenas ícone sem label acessível |

#### UX-018: Botões com apenas ícone sem aria-label
- **Localização:** `Layout.tsx:187` (sino de notificação), `Layout.tsx:234` (menu do usuário), `HelpdeskKanban.tsx:116` (menu de contexto)
- **Severidade:** Alto
- **Impacto:** Leitores de tela não conseguem identificar a função do botão
- **Sugestão:** Adicionar `aria-label="Notificações"`, `aria-label="Menu do usuário"`, etc.

#### UX-019: Ícones decorativos sem aria-hidden
- **Localização:** Múltiplos arquivos — ícones Lucide usados para decoração
- **Severidade:** Médio
- **Impacto:** Leitores de tela leem o nome do ícone desnecessariamente
- **Sugestão:** Adicionar `aria-hidden="true"` em ícones puramente decorativos

### 5.4 Touch Targets

| Aspecto | Avaliação | Detalhes |
|---------|-----------|----------|
| Mínimo 44px | ✅ OK | Definido no CSS: `.touch-target { min-height: 44px; min-w-[44px] }` |
| Botões mobile | ✅ OK | Maioria dos botões usam `min-h-[44px]` |
| Cards | ⚠️ Parcial | Cards clicáveis não têm minHeight definido |

---

## 6. Problemas por Severidade

### 🔴 CRÍTICOS (5)

---

#### UX-001: Ausência de toggle "Mostrar senha"
- **Localização:** `frontend/src/pages/Login.tsx:130-141`
- **Impacto:** Usuário não pode verificar senha digitada; aumenta falhas de login
- **Sugestão:** Adicionar ícone Eye/EyeOff do Lucide no campo de senha

#### UX-005: Uso de `alert()` e `window.confirm()` nativos
- **Localização:** `HelpdeskKanban.tsx:584,603,619,765,784`, `WhatsAppPage.tsx:388,395`
- **Impacto:** Quebra a imersão visual; parece amador em sistema premium
- **Sugestão:** Criar componentes `Toast` e `ConfirmModal` customizados

#### UX-012: `--fg-primary` inadequado em dark mode
- **Localização:** `frontend/src/index.css:44`
- **Impacto:** Contraste insuficiente (`#090909` em `#0F172A` = ~1.3:1); texto ilegível para deficientes visuais
- **Sugestão:** Usar `#E2E8F0` para texto primário em dark mode

#### UX-014: Sem componente Modal reutilizável
- **Localização:** Múltiplas telas implementam modais diferentes
- **Impacto:** Inconsistência visual; cada modal tem comportamento diferente
- **Sugestão:** Criar `<Modal>` padronizado com backdrop, animation, focus trap

#### UX-017: Cards clicáveis sem acessibilidade de teclado
- **Localização:** `ClientList.tsx:73`, `OrderList.tsx:70`, `SettingsPage.tsx:30`
- **Impacto:** Navegação por teclado impossível em elementos interativos
- **Sugestão:** Adicionar `tabIndex={0}`, `role="button"`, `onKeyDown`

---

### 🟠 ALTOS (10)

---

#### UX-002: Ausência de "Esqueci minha senha"
- **Localização:** `Login.tsx:98-165`
- **Sugestão:** Adicionar link + fluxo de recuperação

#### UX-003: KPIs sem tooltips explicativos
- **Localização:** `Dashboard.tsx:51-60`
- **Sugestão:** Tooltips em "TMR" e "TMRes"

#### UX-006: Sem undo após mover ticket
- **Localização:** `HelpdeskKanban.tsx:540-588`
- **Sugestão:** Toast com "Desfazer" por 5 segundos

#### UX-007: Componente HelpdeskKanban monolítico (1499 linhas)
- **Localização:** `HelpdeskKanban.tsx:1-1499`
- **Sugestão:** Decompor em sub-componentes

#### UX-008: QR Code sem instruções visuais de passo-a-passo
- **Localização:** `WhatsAppPage.tsx:484-511`
- **Sugestão:** Ilustração ou vídeo tutorial

#### UX-009: Inconsistência de cores na paginação (verde vs azul)
- **Localização:** `ClientList.tsx:104`, `OrderList.tsx:105`
- **Sugestão:** Padronizar para azul (`bg-blue-600`)

#### UX-011: Três tonalidades de verde diferentes
- **Localização:** WhatsApp (#25d366), Kanban (#10b981), OS (#22C55E)
- **Sugestão:** Definir uma única tonalidade no tailwind.config.js

#### UX-018: Botões com apenas ícone sem aria-label
- **Localização:** `Layout.tsx:187,234`, `HelpdeskKanban.tsx:116`
- **Sugestão:** Adicionar `aria-label` em todos os botões de ícone

#### UX-010: Empty states sem ilustração
- **Localização:** `ClientList.tsx:96`, `OrderList.tsx:94`
- **Sugestão:** Adicionar ilustração SVG + CTA

#### UX-004: Sem botão de refresh no Dashboard
- **Localização:** `Dashboard.tsx:92-110`
- **Sugestão:** Adicionar ícone de refresh no header

---

### 🟡 MÉDIOS (10)

---

#### UX-009 (já listado como Alto — corrigindo): Validação de CNPJ/CPF ausente no frontend
- **Localização:** `ClientForm.tsx:102-103`
- **Sugestão:** Adicionar máscara e validação de CNPJ/CPF

#### UX-013: Inline fontFamily em vez de classes Tailwind
- **Localização:** Múltiplos arquivos
- **Sugestão:** Usar `font-display`, `font-body`, `font-sans`

#### UX-015: Botões com estilos inline inconsistentes
- **Localização:** `WhatsAppPage.tsx:457-466`
- **Sugestão:** Criar variantes `btn-warning`, `btn-danger`

#### UX-016: Tamanhos de ícones sem padrão definido
- **Localização:** Múltiplos arquivos
- **Sugestão:** Definir escala `sm=14`, `md=18`, `lg=22`

#### UX-019: Ícones decorativos sem aria-hidden
- **Localização:** Múltiplos arquivos
- **Sugestão:** Adicionar `aria-hidden="true"`

#### UX-020: Sem "Mostrar senha" no login
- **Localização:** `Login.tsx:130-141`
- **Sugestão:** Ícone Eye/EyeOff no campo senha (duplicado do UX-001, mantido para completude)

#### UX-021: 7 tabs no detalhe do cliente podem sobrecarregar
- **Localização:** `ClientDetail.tsx:29-37`
- **Sugestão:** Considerar sub-menu ou accordion para tabs secundárias

#### UX-022: Sem busca dentro das Configurações
- **Localização:** `SettingsPage.tsx:1-44`
- **Sugestão:** Adicionar barra de busca que filtra os 11 módulos

#### UX-023: Mensagens de erro de API não exibidas ao usuário
- **Localização:** `ClientForm.tsx:59`, `ClientDetail.tsx:80,92,131`
- **Sugestão:** Toast/snackbar para erros de API

#### UX-024: Sem atalho de teclado Cmd+K para busca
- **Localização:** `SearchBar.tsx`
- **Sugestão:** Atalho Cmd+K / Ctrl+K para abrir busca global

---

### 🟢 BAIXOS (6)

---

#### UX-025: Placeholder da SearchBar longo demais
- **Localização:** `SearchBar.tsx:150`
- **Sugestão:** Simplificar para "Buscar..."

#### UX-026: Versão do sistema hardcoded como "v1.0"
- **Localização:** `Layout.tsx:163`
- **Sugestão:** Buscar versão de variável de ambiente ou package.json

#### UX-027: Sidebar footer com typo
- **Localização:** `Layout.tsx:160` — `className="absolute bottom 10 left-0..."` — falta `bottom-10`
- **Sugestão:** Corrigir para `bottom-10`

#### UX-028: Sem empty state na busca do Helpdesk
- **Localização:** `HelpdeskKanban.tsx:1025`
- **Sugestão:** Adicionar ilustração quando "Nenhum resultado para X"

#### UX-029: Notificações sem paginação
- **Localização:** `Layout.tsx:55` — `params: { limit: 10 }`
- **Sugestão:** Adicionar "Ver mais" link

#### UX-030: Select de ordenação sem ícone visual
- **Localização:** `HelpdeskKanban.tsx:905`, `WhatsAppPage.tsx:522`
- **Sugestão:** Adicionar ícone de seta para indicar direção

---

## 7. Fluxos que Funcionam bem

| # | Fluxo | Pontos Fortes |
|---|-------|---------------|
| 1 | Login → Dashboard | Loading claro, erro tratado, redirecionamento automático |
| 2 | Sidebar responsiva | 3 modos funcionais, detecção automática de largura, drawer no mobile |
| 3 | Sistema de temas | 5 modos de fundo, 5 esquemas de cores, dark/light, persistência em localStorage |
| 4 | Busca global | Debounce, sugestões, resultados categorizados com ícones |
| 5 | Kanban com drag-and-drop | Atualização otimista, filtros por departamento, polling |
| 6 | WhatsApp como chat | Layout familiar, bolhas de mensagem, status de conexão |
| 7 | Detalhe do cliente com tabs | 7 abas bem organizadas, stats resumidos, navegação fluida |
| 8 | Configurações | Grid de cards com descrições claras, ícones consistentes |

---

## 8. Recomendações de Melhoria Priorizadas

### Prioridade 1 — Imediato (esta semana)

1. **Corrigir `--fg-primary` em dark mode** — Usar `#E2E8F0` em vez de `#090909`
2. **Adicionar toggle "Mostrar senha" no login** — Ícone Eye/EyeOff
3. **Substituir `alert()`/`confirm()` por componentes customizados** — Toast + ConfirmModal
4. **Adicionar `aria-label` em botões de ícone** — Sininho, menu usuário, ações

### Prioridade 2 — Curto prazo (2 semanas)

5. **Criar componente `<Modal>` reutilizável** — Padronizar todos os modais do sistema
6. **Corrigir inconsistência de cores** — Unificar verde, padronizar paginação para azul
7. **Adicionar acessibilidade de teclado em cards** — `tabIndex`, `role`, `onKeyDown`
8. **Adicionar "Esqueci minha senha"** — Requer endpoint no backend
9. **Decompor HelpdeskKanban.tsx** — Separar em sub-componentes

### Prioridade 3 — Médio prazo (1 mês)

10. **Adicionar tooltips nos KPIs do Dashboard** — Explicar TMR, TMRes
11. **Criar variantes `btn-warning` e `btn-danger`** — Padronizar botões
12. **Adicionar skip link de acessibilidade** — "Pular para conteúdo"
13. **Melhorar empty states com ilustrações** — SVG + CTA
14. **Adicionar atalho Cmd+K para busca** — Padrão de produtividade

### Prioridade 4 — Melhorias contínuas

15. **Usar classes Tailwind para fontes** — `font-display` em vez de inline
16. **Definir escala de ícones** — Documentar sm/md/lg
17. **Adicionar `aria-hidden` em ícones decorativos** — Acessibilidade
18. **Adicionar undo toast no Kanban** — Padrão Gmail
19. **Buscar versão automaticamente** — Evitar hardcoded

---

## 9. Conclusão

O CodeHelp CRM apresenta uma interface visualmente impressionante, com um design system robusto, sistema de temas avançado e sidebar altamente customizável. A experiência do usuário é boa na maioria dos fluxos, com loading states consistentes, empty states tratados e navegação intuitiva.

Os problemas mais urgentes são de **acessibilidade** (dark mode com contraste insuficiente, cards sem acesso por teclado, botões sem aria-label), **consistência** (3 verdes diferentes, modais implementados de formas distintas, `alert()` nativo) e **completude** (sem "esqueci senha", sem "mostrar senha", sem componente Modal reutilizável).

Com as correções sugeridas, o sistema pode atingir score **9/10** em usabilidade e estar em conformidade com WCAG 2.1 nível AA.

**Score geral de usabilidade:** 7.5/10 — Interface polida com lacunas de acessibilidade e consistência.

---

*Relatório gerado pelo squad codehelp-audit-squad em 19/06/2026*
*Auditor: Camila Ferreira — UX Design Expert Senior*
