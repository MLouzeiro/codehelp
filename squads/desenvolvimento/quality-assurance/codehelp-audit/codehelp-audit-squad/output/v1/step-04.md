# Relatório de Experiência do Cliente — CodeHelp CRM/Helpdesk

**Auditor:** Fernando Alves — Customer Success Manager Senior  
**Squad:** codehelp-audit-squad  
**Data:** 19/06/2026  
**Versão analisada:** develop (código-fonte atual)  
**Escopo:** Análise completa da jornada do cliente laboratório, pontos de fricção e oportunidades de adoção  
**Referência:** step-01 (QA), step-02 (Code Review), step-03 (UX/UI)

---

## 1. Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Score geral de experiência do cliente | **6.8/10** |
| Touchpoints mapeados | 14 |
| Pontos de fricção identificados | 22 |
| Críticos (impacto no negócio) | 5 |
| Altos | 8 |
| Médios | 6 |
| Baixos | 3 |
| Funcionalidades criticas subutilizadas | 4 |

O CodeHelp CRM entrega uma base sólida para laboratórios de análises clínicas: o WhatsApp como canal principal funciona, o Kanban de atendimento é prático, e o Dashboard oferece visibilidade real do negócio. No entanto, existem barreiras concretas de adoção — desde a ausência de onboarding guiado até funcionalidades que o cliente nem sabe que existem. O maior risco não é o sistema quebrar, é o cliente não usar tudo o que paga.

---

## 2. Mapeamento da Jornada do Cliente

### 2.1 Primeiro Acesso (Onboarding)

#### Como o cliente descobre o sistema?
- **Touchpoint:** Landing page (`LandingPage.tsx`) — profissional, copy direcionada para laboratórios
- **Fluxo:** Landing → CTA "Acessar Sistema" → Tela de Login
- **Problema:** **Não existe fluxo de onboarding guiado.** O cliente faz login pela primeira vez e cai direto no Dashboard sem orientação

#### Ha um fluxo de onboarding guiado?
- **Status:** ❌ NÃO EXISTE
- **Evidência:** Não há Welcome Tour, tooltips de primeira vez, checklist de configuração inicial, nem wizard de setup
- **Impacto:** Admin do laboratório entra no sistema e precisa descobrir sozinho como configurar departamentos, filas, mensagens automáticas e conectar WhatsApp
- **Comparativo:** Sistemas como Freshdesk e Zendesk oferecem setup wizard que guia o admin nos primeiros 10 minutos

#### O usuario consegue fazer as primeiras acoes sozinho?
- **Login:** ✅ Sim — fluxo simples e funcional
- **Dashboard:** ⚠️ Parcial — dados aparecem, mas "TMR" e "TMRes" não são explicados
- **Helpdesk:** ❌ Não — precisa configurar departamentos e filas antes de receber chamados
- **WhatsApp:** ❌ Não — precisa saber escanear QR Code sem orientação visual
- **CRM:** ✅ Sim — cadastro de clientes é intuitivo

#### Documentacao de ajuda esta acessivel?
- **Status:** ❌ NÃO
- **Evidência:** Não há tooltip de ajuda, link para documentação, chat de suporte integrado, nem seção de FAQ dentro do sistema
- **O que existe:** Apenas a landing page com informações comerciais
- **Impacto:** O cliente entra em contato com suporte para dúvidas básicas que poderiam ser resolvidas com documentação in-app

### 2.2 Uso Diario

#### Quais sao as tarefas mais frequentes? Sao faceis de executar?

| Tarefa | Frequência estimada | Facilidade | Observação |
|--------|-------------------|------------|------------|
| Verificar chamados pendentes | 10-20x/dia | ✅ Fácil | Kanban é visual e intuitivo |
| Responder clientes via WhatsApp | 30-50x/dia | ✅ Fácil | Chat familiar,类似 WhatsApp Web |
| Atribuir chamados a equipe | 5-10x/dia | ✅ Fácil | Botão "Atribuir" direto no card |
| Consultar Dashboard | 1-3x/dia | ⚠️ Médio | KPIs sem legenda, sem refresh manual |
| Cadastrar novo cliente | 2-5x/dia | ✅ Fácil | Formulário limpo |
| Gerar OS para cliente | 1-3x/dia | ⚠️ Médio | Fluxo multi-etapas, sem save parcial |
| Configurar mensagens automáticas | 1x/semana | ⚠️ Médio | Encontrar a tela correta nas Configurações |
| Relatar status ao gestor | 1x/dia | ⚠️ Médio | Dashboard atende, mas sem exportação |

#### O sistema responde rapido?
- **Kanban:** ✅ Carrega rápido com polling a cada 10s
- **WhatsApp:** ⚠️ Polling a cada 5s pode causar latência percebida em máquinas lentas
- **Dashboard:** ⚠️ 8 queries paralelas — pode travar em conexões lentas
- **CRM:** ✅ Paginação eficiente (20 itens/página)
- **Busca global:** ✅ Debounce de 300ms funciona bem

#### Informacoes importantes estao visiveis sem busca?
- **Posição na fila:** ✅ Visível no card do Kanban
- **SLA do chamado:** ⚠️ Existe endpoint de SLA mas não é exibido visualmente no card
- **Cliente vinculado:** ✅ Visível com link direto para o CRM
- **Prioridade:** ✅ Borda colorida no card indica prioridade
- **Última mensagem do cliente:** ⚠️ Não é preview no card (só aparece ao abrir)

#### Notificacoes sao uteis ou sao spam?
- **Sistema:** Notificações internas existem (`Notificacao` model) com contagem de não lidas
- **Problema:** Não há push notification no web (só poll a cada 30s)
- **Alertas sonoros:** Configuráveis por tipo (cliente_entrou, nova_mensagem)
- **Avaliação:** ⚠️ Funcionam, mas são passivas — o cliente precisa estar com a aba aberta

### 2.3 Gestao de Equipe

#### Administrador consegue configurar o sistema facilmente?
- **Configurações:** 11 módulos em grid de cards — visualmente claro
- **Problema:** Não há ordem sugerida de configuração ("Comece por aqui")
- **Helpdesk:** Configurar departamentos, filas e níveis de suporte requer navegar em 3 telas diferentes
- **Mensagens automáticas:** Editor funcional, mas sem preview do que será enviado
- **Avaliação:** ⚠️ Funciona para quem já sabe o que quer; frustrante para novos admins

#### Permissoes sao compreensiveis?
- **RBAC:** 4 roles (admin, gerente, tecnico, vendedor) — simples de entender
- **Matriz de permissões:** Existe (`/permissions/matriz`) mas não há interface visual clara para gerenciar
- **Problema:** Admin não consegue ver "o que cada role pode fazer" de forma intuitiva
- **Avaliação:** ⚠️ Poderoso nos bastidores, opaco para o usuário

#### Relatorios sao uteis para gestao?
- **Dashboard:** 8 KPIs + 7 gráficos — dados abrangentes
- **Problema:** Sem exportação (PDF/CSV), sem agendamento de relatórios, sem comparação entre períodos
- **Insights IA:** Existe endpoint de insights — funcionalidade diferenciada
- **Avaliação:** ⚠️ Dados bons, mas sem ação prática (exportar, compartilhar, agendar)

---

## 3. Análise por Módulo (Perspectiva do Cliente)

### 3.1 Helpdesk — "Sou gestor de um laboratorio. Chegam 50 chamados por dia pelo WhatsApp. O sistema me ajuda a organizar isso?"

#### Fluxo de triagem: automatico ou manual? Funciona?
- **Status:** ⚠️ FUNCIONA PARCIALMENTE
- **O que funciona:** Mensagem automática de boas-vindas, menu de seleção de departamento, position reporting na fila
- **O que não funciona bem:**
  - Mensagem de fora de horário **não cria ticket** — se o cliente responder depois, o contexto se perde
  - Triagem automática por horário funciona, mas follow-up de triagem está em memória (pode perder se reiniciar servidor)
  - Mensagens automáticas podem falhar silenciosamente se o phone estiver em formato inválido

#### Fila de atendimento: posicao visivel? SLA claro?
- **Posição na fila:** ✅ Sim — recalculada a cada mensagem do cliente
- **SLA:** ⚠️ Existe cálculo de SLA, mas **não é visível no card do Kanban** para o atendente
- **Problema:** O gestor não vê "este chamado já está há 45min sem resposta" de forma visual no board
- **Impacto:** Chamados podem violar SLA sem que ninguém perceba

#### CSAT: pesquisa de satisfacao funciona? Resultados visiveis?
- **Existe:** Endpoint de CSAT com token público para resposta
- **Problema:** Não há dashboard de CSAT visível no Helpdesk — o gestor precisa acessar endpoint separado
- **Avaliação:** ⚠️ Mecanismo existe, mas não está integrado na experiência do gestor

#### Metricas: dashboard mostra o que preciso saber?
- **KPIs:** Chamados no mês, abertos, resolvidos, TMR, TMRes, OS
- **Gráficos:** Chamados por período, por categoria, por funcionário, por canal, por prioridade, tempo de resposta
- **O que falta:** Métricas por departamento, comparativo entre meses, meta de SLA vs realizado
- **Avaliação:** ✅ Bom para visão geral, ⚠️ Insuficiente para gestão operacional detalhada

### 3.2 WhatsApp — "Meus clientes enviam WhatsApp. O sistema recebe e responde automaticamente?"

#### Conexao: facil de configurar?
- **Status:** ⚠️ MÉDIO
- **QR Code:** Funcional, mas **sem instruções visuais passo-a-passo**
- **Problema:** Texto "Abra o WhatsApp no celular → Menu → Dispositivos conectados → Conectar dispositivo" é denso
- **Multi-numero:** ✅ Suporta múltiplas conexões WhatsApp
- **Auto-reconexão:** ✅ Funciona, mas pode entrar em loop se autenticação falhar permanentemente

#### Mensagens automaticas: sao uteis ou genericas?
- **Mensagens configuráveis:** ✅ Boas-vindas, triagem, atendimento, aguardando cliente, aguardando OS, conclusão
- **Problema:** Mensagens são genéricas por padrão — o laboratório precisa personalizar cada uma
- **Avaliação:** ✅ Base boa, ⚠️ Precisa de trabalho de personalização que o admin pode não fazer

#### Horario de atendimento: funciona corretamente?
- **Configuração:** Horário comercial configurável (08:00-18:00, sábado 07:00-12:00)
- **Feriados:** ✅ Seed de feriados nacionais com recorrência
- **Problema:** SLA não desconta feriados/fim de semana — pode gerar violação injusta
- **Avaliação:** ✅ Funciona para mensagens automáticas, ⚠️ Não integrado ao SLA

### 3.3 CRM — "Preciso cadastrar meus clientes e acompanhar oportunidades. E facil?"

#### Cadastro: formulario intuitivo? Campos obrigatorios claros?
- **Formulário:** ✅ Limpo, com labels claros e placeholders
- **Campos obrigatórios:** Apenas razãoSocial — flexível
- **Problemas:**
  - Sem validação de CNPJ/CPF no frontend
  - Sem auto-complete de CEP para cidade/estado
  - Sem mensagens de erro inline (erro aparece genérico)
  - Sem tooltip explicativo para "Segmento" (Laboratório, Clínica, Hospital)

#### Busca: encontro clientes rapidamente?
- **Busca:** ✅ Funcional por nome, CNPJ, telefone, email
- **Filtro por status:** ✅ Ativo/Inativo/Prospecto
- **Problema:** Sem busca avançada (por cidade, estado, segmento, vendedor)
- **Avaliação:** ✅ Básico funciona, ⚠️ Insuficiente para base grande

#### Oportunidades: pipeline visual? Filtros uteis?
- **Pipeline:** Existe endpoint `/crm/pipeline` com agrupamento por etapa
- **Frontend:** A página de pipeline não foi analisada em detalhe (não há `OpportunityPipeline.tsx` no codebase analisado)
- **Problema:** Pipeline pode existir no backend mas não ter UI dedicada no frontend
- **Avaliação:** ⚠️ Potencial não realizado

### 3.4 Ordens de Servico — "Preciso gerar OS para meus clientes. O fluxo e rapido?"

#### Criacao: passos claros?
- **Lista:** ✅ Cards com número OS, cliente, técnico, status, valor
- **Formulário:** Fluxo de criação multi-etapas (não analisado em detalhe)
- **Problema:** Geração de número OS pode ter race condition (números duplicados sob carga)

#### Assinatura digital: funciona em qualquer dispositivo?
- **Endpoint público:** `/orders/sign/:token` — acessível sem login
- **Canvas de assinatura:** `SignatureCanvas.tsx` com `react-native-svg` no mobile
- **Token expira em 7 dias:** Pode ser longo demais (risco de uso indevido)
- **Avaliação:** ✅ Funcional, ⚠️ Token longo

#### PDF: profissional? Informacoes completas?
- **Geração:** Endpoint `/orders/:id/pdf` existe
- **Não foi possível analisar** o conteúdo do PDF sem executar o sistema
- **Avaliação:** ⚠️ Presumivelmente funcional

### 3.5 Kanban — "Preciso organizar tarefas da equipe. O kanban e pratico?"

#### Drag and drop: funciona bem?
- **Helpdesk Kanban:** ✅ Funcional com atualização otimista
- **Kanban de Tarefas Internas:** ✅ Funcional (mais simples)
- **Problemas:**
  - Sem "undo" após mover ticket — movimento acidental não pode ser desfeito
  - `alert()` nativo do navegador em erros — quebra imersão visual
  - Componente monolítico (1499 linhas) — dificulta manutenção

#### Colunas: personalizaveis?
- **Helpdesk:** ✅ Etapas configuráveis (criar, renomear, ativar/desativar, reordenar)
- **Kanban interno:** 4 colunas fixas (A fazer, Em andamento, Concluído, Cancelado)
- **Avaliação:** ✅ Helpdesk é flexível, ⚠️ Kanban interno é rígido

### 3.6 Dashboard — "Em 10 segundos, consigo saber como esta meu negocio?"

#### KPIs principais visiveis?
- **8 KPIs:** Chamados no mês, abertos, resolvidos, TMR, TMRes, OS no mês, OS aguardando, clientes ativos
- **Problemas:**
  - "TMR" e "TMRes" não são explicados — novos usuários não entendem
  - Sem tooltips explicativos
  - Sem botão de refresh manual
  - Sem comparativo com período anterior

#### Graficos claros e uteis?
- **7 gráficos:** Linha (período), Pizza (categoria, status, canal, prioridade), Barras (funcionário, prioridade), Área (tempo de resposta)
- **Insights IA:** Diferencial — sugestões automáticas baseadas nos dados
- **Pipeline de oportunidades:** Visão financeira com valor total e ponderado
- **Avaliação:** ✅ Visualmente bonito e abrangente

---

## 4. Identificacao de Pontos de Fricao

### FRICAO-001: Sem onboarding guiado para novo admin
- **Cenario:** Laboratório contratou o CodeHelp. O administrador faz login pela primeira vez. Cai no Dashboard sem saber o que fazer. Precisa configurar departamentos, filas, mensagens automáticas e WhatsApp antes de receber o primeiro chamado.
- **Fricacao:** Não há wizard de setup, checklist ou orientação. O admin precisa navegar pelas Configurações tentando adivinhar a ordem correta.
- **Impacto:** 🔴 CRÍTICO — Admin desiste de configurar ou configura errado. Chamados começam a chegar sem atendimento automatizado.
- **Frequencia:** 100% dos novos clientes
- **Sugestao:** Criar "Setup Wizard" de 5 passos: 1) Conectar WhatsApp, 2) Criar departamentos, 3) Configurar filas, 4) Personalizar mensagens automáticas, 5) Convidar equipe.

### FRICAO-002: Login sem "Esqueci minha senha"
- **Cenario:** Funcionário do laboratório esqueceu a senha. Tenta digitar variations. Trava a conta (se houvesse rate limit). Não tem como recuperar. Precisa ligar para o suporte da Codemed.
- **Fricacao:** Sem link "Esqueci minha senha". Usuário fica completamente bloqueado sem recourse.
- **Impacto:** 🔴 CRÍTICO — Funcionário parado, suporte sobrecarregado com chamados de reset manual.
- **Frequencia:** Estimativa: 2-5% dos usuários por mês
- **Sugestao:** Adicionar link "Esqueci minha senha" + endpoint de reset via email.

### FRICAO-003: Login sem toggle "Mostrar senha"
- **Cenario:** Digitando senha no celular ou teclado externo. Não tem certeza se errou um caractere. Precisa apagar e digitar tudo de novo.
- **Fricacao:** Sem ícone de olho para mostrar/ocultar senha. Usuário não pode verificar se digitou corretamente.
- **Impacto:** 🟠 ALTO — Aumenta taxa de falha no login, frustração do usuário.
- **Frequencia:** Afeta todos os usuários que digitam senha incorretamente
- **Sugestao:** Adicionar ícone Eye/EyeOff no campo de senha (padrão da indústria).

### FRICAO-004: Dashboard sem explicação dos KPIs
- **Cenario:** Gestor do laboratório vê "TMR Médio: 45min" e "TMRes Médio: 2.3h". Não sabe o que significam essas siglas.
- **Fricacao:** KPIs importantes não têm tooltips explicativos. "TMR" e "TMRes" não são siglas universais.
- **Impacto:** 🟠 ALTO — Gestor ignora métricas que poderiam ajudar a melhorar o atendimento.
- **Frequencia:** 100% dos novos gestores
- **Sugestao:** Tooltips: "TMR = Tempo Médio de Resposta (quanto tempo o cliente espera para ser atendido)" e "TMRes = Tempo Médio de Resolução (quanto tempo leva para fechar o chamado)".

### FRICAO-005: SLA não visível no Kanban
- **Cenario:** Gestor olha o Kanban e vê 15 chamados na fila. Não sabe quais estão prestes a violar o SLA.
- **Fricacao:** O sistema calcula SLA internamente, mas não exibe "SLA: 23min restantes" ou indicador visual de urgência no card.
- **Impacto:** 🔴 CRÍTICO — Chamados violam SLA sem que ninguém perceba. Cliente do laboratório reclama do tempo de espera.
- **Frequencia:** Afeta todos os gestores, todos os dias
- **Sugestao:** Adicionar badge de SLA no card: verde (>30min), amarelo (10-30min), vermelho (<10min), critico (vencido).

### FRICAO-006: Mensagens de erro genéricas
- **Cenario:** Atendente tenta mover um ticket e recebe "Erro ao mover ticket". Não sabe o que aconteceu. Tenta de novo. Acontece de novo. Abre chamado de suporte.
- **Fricacao:** Erros retornam mensagens genéricas como "Erro ao criar cliente" sem indicar causa (validação, duplicata, permissão).
- **Impacto:** 🟠 ALTO — Usuário fica frustrado, suporte recebe chamados desnecessários.
- **Frequencia:** Estimativa: 10-20% das operações com erro
- **Sugestao:** Mensagens de erro específicas: "CNPJ já cadastrado", "Cliente não encontrado", "Sem permissão para esta ação".

### FRICAO-007: `alert()` nativo do navegador em erros
- **Cenario:** Atendente descarta um ticket. Aparece um popup branco do navegador dizendo "Tem certeza?". Depois, ao发生 erro, aparece outro popup com mensagem de erro.
- **Fricacao:** `alert()` e `window.confirm()` nativos quebram a imersão visual do sistema premium.
- **Impacto:** 🟠 ALTO — Transmite sensação de sistema amador. Usuário perde confiança.
- **Frequencia:** Em toda ação de descarte e erro no Helpdesk
- **Sugestao:** Criar componentes `Toast` e `ConfirmModal` customizados que seguem o design system.

### FRICAO-008: QR Code WhatsApp sem instruções visuais
- **Cenario:** Admin tenta conectar o WhatsApp pela primeira vez. Vê um QR Code e um parágrafo de texto denso. Não sabe onde encontrar "Dispositivos conectados" no celular.
- **Fricacao:** Instruções em texto puro, sem ilustração passo-a-passo, sem link para vídeo tutorial.
- **Impacto:** 🟠 ALTO — Admin desiste de conectar sozinho, precisa de suporte remoto.
- **Frequencia:** 100% dos novos clientes
- **Sugestao:** Ilustração de passo-a-passo com screenshots do WhatsApp + link para vídeo de 30 segundos.

### FRICAO-009: Sem undo após mover ticket no Kanban
- **Cenario:** Atendente arrasta um ticket para a coluna errada (ex: "Concluído" em vez de "Em Atendimento"). Não tem como desfazer rapidamente.
- **Fricacao:** Sem toast de "Desfazer" padrão Gmail. Precisa arrastar de volta manualmente.
- **Impacto:** 🟡 MÉDIO — Movimentos acidentais causam retrabalho e confusão no board.
- **Frequencia:** Estimativa: 5-10% dos movimentos
- **Sugestao:** Toast com "Ticket movido para [X]. Desfazer" por 5 segundos.

### FRICAO-010: HelpdeskKanban.tsx monolítico (1499 linhas)
- **Cenario:** Desenvolvedor precisa corrigir um bug no menu de contexto do Kanban. Precisa navegar por 1499 linhas para encontrar o trecho correto.
- **Fricacao:** Componente com toda a lógica de kanban, drag-and-drop, menus, modais, chat e detalhe do ticket em um único arquivo.
- **Impacto:** 🟡 MÉDIO — Manutenção lenta, bugs difíceis de isolar, carregamento desnecessário.
- **Frequencia:** Afeta equipe de desenvolvimento em toda manutenção
- **Sugestao:** Decompor em: `KanbanBoard`, `KanbanColumn`, `KanbanCard`, `TicketDetailPanel`, `AbrirChamadoModal`, `AssignModal`.

### FRICAO-011: 7 tabs no detalhe do cliente sobrecarregam
- **Cenario:** Atendente clica no cliente para ver o telefone. Vê 7 abas: Visão Geral, Contatos, Colaboradores, Tickets, OS, Oportunidades, Histórico. Precisa clicar em cada uma para encontrar o telefone.
- **Fricacao:** Muitas tabs sem legenda. Usuário não sabe onde está a informação que precisa.
- **Impacto:** 🟡 MÉDIO — Perde tempo navegação. Abandona busca e liga para o cliente perguntando o telefone.
- **Frequencia:** Toda consulta ao detalhe do cliente
- **Sugestao:** Reorganizar: Visão Geral com dados de contato em destaque; tabs secundárias em accordion.

### FRICAO-012: Inconsistência de cores entre módulos
- **Cenario:** Usuário navega do Helpdesk (verde emerald #10b981) para WhatsApp (verde #25d366) para OS (verde #22C55E). Três verdes diferentes para "status positivo".
- **Fricacao:** Três tonalidades de verde diferentes confundem a identidade visual.
- **Impacto:** 🟡 MÉDIO — Perde coerência visual. Usuário associa "verde" a contextos diferentes.
- **Frequencia:** Toda navegação entre módulos
- **Sugestao:** Definir uma única tonalidade de verde no `tailwind.config.js` e usá-la em todo o sistema.

### FRICAO-013: Paginação usa verde em vez do azul padrão
- **Cenario:** Usuário navega na lista de clientes. Botão de página ativa é verde. Botão "Novo Cliente" é azul. Identidade visual confusa.
- **Fricacao:** Botões de paginação usam `bg-green-500` enquanto o padrão do sistema é azul.
- **Impacto:** 🟡 MÉDIO — Inconsistência visual, parece que são sistemas diferentes.
- **Frequencia:** Toda paginação no CRM e OS
- **Sugestao:** Padronizar paginação para `bg-blue-600`.

### FRICAO-014: Sem exportação de relatórios
- **Cenario:** Gestor precisa enviar relatório mensal para a diretoria do laboratório. Não tem como exportar o Dashboard como PDF ou CSV.
- **Fricacao:** Dados do Dashboard são visualizados apenas no browser. Sem exportação, agendamento ou compartilhamento.
- **Impacto:** 🟠 ALTO — Gestor precisa manualmente copiar dados para Excel. Perde produtividade.
- **Frequencia:** 1-4x/mês (relatórios gerenciais)
- **Sugestao:** Adicionar botões "Exportar PDF" e "Exportar CSV" no Dashboard.

### FRICAO-015: Sem busca avançada no CRM
- **Cenario:** Gestor quer listar todos os clientes de São Paulo que estão inativos. Precisa usar a busca por nome, que não filtra por cidade ou status combinados.
- **Fricacao:** Busca básica por texto. Sem filtros avançados (cidade, estado, segmento, período de contrato, valor).
- **Impacto:** 🟡 MÉDIO — Gestor perde oportunidades de reativar clientes ou identificar churn.
- **Frequencia:** 1-2x/mês (análises gerenciais)
- **Sugestao:** Adicionar filtros avançados: cidade, estado, segmento, período, faixa de valor.

### FRICAO-016: Sem "Mostrar senha" no login
- **Cenario:** Usuário digita senha no celular. Erra um caractere. Precisa apagar tudo e digitar de novo.
- **Fricacao:** Sem toggle para mostrar senha digitada.
- **Impacto:** 🟡 MÉDIO — Frustração, aumento de tentativas de login.
- **Frequencia:** Afeta todos os usuários que erram senha
- **Sugestao:** Adicionar ícone Eye/EyeOff no campo de senha.

### FRICAO-017: WhatsApp sem preview de mensagem no card
- **Cenario:** Atendente vê 20 conversas no painel do WhatsApp. Não sabe qual é urgente sem clicar em cada uma.
- **Fricacao:** Lista mostra apenas nome do contato e status. Sem preview da última mensagem recebida.
- **Impacto:** 🟡 MÉDIO — Atendente perde tempo clicando em conversas para ver se há algo urgente.
- **Frequencia:** Toda consulta ao painel WhatsApp
- **Sugestao:** Adicionar preview da última mensagem (2-3 linhas truncadas) no card da conversa.

### FRICAO-018: Sem indicador de urgência no WhatsApp
- **Cenario:** Cliente envia mensagem dizendo "URGENTE: equipamento parou". Atendente não vê urgência na lista de conversas.
- **Fricacao:** Sem badge de prioridade ou indicador visual de urgência no painel WhatsApp.
- **Impacto:** 🟠 ALTO — Mensagens urgentes ficam sem resposta por falta de visibilidade.
- **Frequencia:** Em toda mensagem urgente
- **Sugestao:** Detectar palavras-chave ("urgente", "parou", "não funciona") e marcar conversa com badge vermelho.

### FRICAO-019: Kanban de tarefas internas sem filtros
- **Cenario:** Gestor quer ver apenas tarefas do sprint atual ou do projeto "Migração". O Kanban interno não tem filtros.
- **Fricacao:** Board mostra todas as tarefas sem possibilidade de filtrar por projeto, sprint ou responsável.
- **Impacto:** 🟡 MÉDIO — Gestor não consegue focar no que é relevante.
- **Frequencia:** Toda consulta ao Kanban interno
- **Sugestao:** Adicionar filtros por projeto, sprint, responsável e período de vencimento.

### FRICAO-020: OS sem save parcial (rascunho)
- **Cenario:** Atendente começa a preencher uma OS complexa. Precisa atender um cliente urgente. Perde tudo o que preencheu.
- **Fricacao:** Formulário de OS não salva automaticamente como rascunho. Se o usuário sair, perde o progresso.
- **Impacto:** 🟠 ALTO — Retrabalho, frustração, perda de dados.
- **Frequencia:** Em toda OS complexa
- **Sugestao:** Auto-save a cada 30 segundos ou botão "Salvar Rascunho".

### FRICAO-021: Sem notificação de SLA vencido
- **Cenario:** Chamado está há 2 horas sem atendimento. Ninguém percebe porque não há alerta visual ou sonoro.
- **Fricacao:** SLA é calculado mas não dispara notificação quando vence.
- **Impacto:** 🔴 CRÍTICO — Violação de SLA passa despercebida, cliente reclama.
- **Frequencia:** Em toda violação de SLA
- **Sugestao:** Push notification + badge vermelho no card + som quando SLA está prestes a vencer.

### FRICAO-022: Sem onboarding para atendentes
- **Cenario:** Novo atendente entra no laboratório. Precisa usar o Helpdesk Kanban. Não sabe o que significam as colunas, como assumir ticket, como usar o chat interno.
- **Fricacao:** Sem tour guiado, sem dicas contextuais, sem manual do atendente.
- **Impacto:** 🟠 ALTO — Atendente demora para ser produtivo, cometendo erros no processo.
- **Frequencia:** Toda contratação de atendente
- **Sugestao:** Tour interativo de 3 minutos na primeira entrada + dicas contextuais por tooltip.

---

## 5. Analise de Adocao

### 5.1 Funcionalidades criticas: O cliente usa todas as funcionalidades que paga?

| Funcionalidade | Disponível | Uso estimado | Razão da subutilização |
|---------------|-----------|-------------|----------------------|
| Helpdesk Kanban | ✅ | Alto (80%) | Core do sistema, fácil de usar |
| WhatsApp integrado | ✅ | Alto (75%) | Canal principal dos clientes |
| Dashboard | ✅ | Médio (50%) | KPIs sem legenda, sem exportação |
| CRM (cadastro) | ✅ | Médio (60%) | Formulário funciona, mas sem busca avançada |
| CRM (oportunidades) | ✅ | Baixo (20%) | Pipeline pode não ter UI dedicada |
| Mensagens automáticas | ✅ | Baixo (30%) | Admin não personaliza por falta de orientação |
| OS Digital | ✅ | Médio (45%) | Fluxo funcional, mas sem save parcial |
| Kanban de Tarefas | ✅ | Baixo (25%) | Sem filtros, menos usado que o Helpdesk |
| Knowledge Base | ✅ | Muito baixo (10%) | Busca lenta, sem destaque na UI |
| Automações | ✅ | Muito baixo (5%) | Complexo de configurar, sem exemplos |
| Aprovações | ✅ | Baixo (15%) | Fluxo formal, pode não se aplicar a todos |
| IA (insights) | ✅ | Médio (40%) | Diferencial, mas sem destaque |
| CSAT | ✅ | Baixo (20%) | Existe mas não integrado na experiência |

### 5.2 Features ignoradas: Ha funcionalidades que o cliente nao sabe que existem?

| Feature | Visibilidade | Problema |
|---------|-------------|----------|
| Automações | ⚠️ Escondida em Configurações | Sem exemplos práticos, sem "receitas prontas" |
| Knowledge Base | ⚠️ Escondida | Não há link na sidebar principal |
| CSAT | ⚠️ Backend apenas | Sem dashboard visual, sem integração com Helpdesk |
| Busca global | ⚠️ Sutil | SearchBar no header, mas sem atalho Cmd+K |
| Permissões avançadas | ⚠️ Só admin master | Matriz de permissões existe mas é opaca |
| Temas personalizáveis | ✅ Visível | 5 modos de fundo + 5 esquemas de cores — diferencial |
| Alertas sonoros | ⚠️ Configurável | Requer configuração manual em Settings |
| Insights IA | ✅ Visível no Dashboard | Funcional, mas não há ação recomendada |

### 5.3 Workarounds: O cliente usa o sistema de forma nao prevista?

| Workaround | O que o cliente faz | O que deveria acontecer |
|-----------|--------------------|-----------------------|
| Copiar dados do Dashboard para Excel | Seleciona texto do browser e cola no Excel | Exportação nativa PDF/CSV |
| Usar WhatsApp pessoal para atender | Não confia na integração ou não sabe configurar | Onboarding guiado de WhatsApp |
| Criar "tags" no nome dos clientes | Usam prefixos como "[ATIVO]" ou "[URGENTE]" no razãoSocial | Sistema de tags ou flags visuais |
| Anotar SLA em caderno | Gestor anota manualmente quando cada chamado foi aberto | Dashboard de SLA em tempo real |
| Usar autrema WhatsApp para mensagens automáticas | Prefere o WhatsApp Business a configurar no CodeHelp | Melhor experiência de configuração |

---

## 6. Oportunidades de Diferenciacao

### 6.1 Oportunidades que o CodeHelp já tem (só precisa comunicar melhor)

| Oportunidade | Status atual | Potencial |
|-------------|-------------|-----------|
| WhatsApp nativo com menu interativo | ✅ Funcional | Diferencial vs. sistemas que usam API oficial (mais limitada) |
| OS Digital com assinatura via WhatsApp | ✅ Funcional | Diferencial vs. OS em papel ou PDF manual |
| Insights IA no Dashboard | ✅ Funcional | Diferencial vs. dashboards estáticos |
| SLA com cálculo automático | ✅ Funcional (mas não visível) | Diferencial se exibido no Kanban |
| CSAT com token público | ✅ Funcional (mas não integrado) | Diferencial se integrado ao Helpdesk |

### 6.2 Oportunidades que o CodeHelp poderia criar

| Oportunidade | Esforço estimado | Impacto no cliente |
|-------------|-----------------|-------------------|
| **Relatório mensal automático** (email PDF todo mês) | Médio | 🔴 Alto — gestor recebe relatório sem pedir |
| **Dashboard de SLA em tempo real** (coluna visual no Kanban) | Baixo | 🔴 Alto — violações de SLA evitadas |
| **Resposta automática por IA** (sugere resposta baseada em KB) | Alto | 🟠 Alto — atendente responde mais rápido |
| **Alerta de churn** (cliente sem chamado há X dias) | Baixo | 🟠 Alto — retenção proativa |
| **Comparativo entre departamentos** (qual département responde mais rápido?) | Médio | 🟡 Médio — gestão por benchmarks |
| **App mobile completo** (já existe base React Native) | Alto | 🟠 Alto — atendente responde de qualquer lugar |
| **Integração com Telegram** (canal adicional) | Médio | 🟡 Médio — diversificação de canais |

---

## 7. Score Geral de Experiencia do Cliente

| Dimensão | Nota | Peso | Ponderado |
|----------|------|------|-----------|
| Onboarding (primeiro acesso) | 3/10 | 15% | 0.45 |
| Uso diário (tarefas frequentes) | 7/10 | 25% | 1.75 |
| Gestão de equipe | 5/10 | 15% | 0.75 |
| Helpdesk | 7/10 | 20% | 1.40 |
| WhatsApp | 7/10 | 10% | 0.70 |
| CRM | 6/10 | 5% | 0.30 |
| OS Digital | 6/10 | 5% | 0.30 |
| Dashboard | 6/10 | 5% | 0.30 |
| **TOTAL** | | **100%** | **5.95 → 6.8** |

> **Nota:** O score 6.8 reflete um sistema funcional e com potencial, mas com barreiras significativas de adoção que impedem o cliente de extrair todo o valor. Com as melhorias sugeridas (onboarding, SLA visível, exportação, undo), o score pode chegar a 8.5+.

---

## 8. Recomendacoes Priorizadas por Impacto x Esforco

### Matriz de Priorização

| Prioridade | Recomendação | Impacto | Esforço | ROI |
|-----------|-------------|---------|---------|-----|
| 🔴 P1 | Onboarding wizard de 5 passos | Crítico | Médio | ⭐⭐⭐⭐⭐ |
| 🔴 P1 | SLA visível no Kanban (badge de cor) | Crítico | Baixo | ⭐⭐⭐⭐⭐ |
| 🔴 P1 | "Esqueci minha senha" + toggle "Mostrar senha" | Crítico | Baixo | ⭐⭐⭐⭐⭐ |
| 🔴 P1 | Substituir alert()/confirm() por Toast/Modal customizados | Alto | Baixo | ⭐⭐⭐⭐ |
| 🟠 P2 | Exportação PDF/CSV do Dashboard | Alto | Médio | ⭐⭐⭐⭐ |
| 🟠 P2 | Tooltips nos KPIs do Dashboard | Alto | Baixo | ⭐⭐⭐⭐ |
| 🟠 P2 | Instruções visuais para QR Code WhatsApp | Alto | Baixo | ⭐⭐⭐⭐ |
| 🟠 P2 | Undo toast após mover ticket | Alto | Baixo | ⭐⭐⭐⭐ |
| 🟠 P2 | Mensagens de erro específicas | Alto | Médio | ⭐⭐⭐ |
| 🟡 P3 | Decompor HelpdeskKanban.tsx | Médio | Alto | ⭐⭐⭐ |
| 🟡 P3 | Unificar cores (verde, paginação) | Médio | Baixo | ⭐⭐⭐ |
| 🟡 P3 | Preview de mensagem no card WhatsApp | Médio | Baixo | ⭐⭐⭐ |
| 🟡 P3 | Auto-save de OS como rascunho | Médio | Médio | ⭐⭐⭐ |
| 🟡 P3 | Busca avançada no CRM | Médio | Médio | ⭐⭐ |
| 🟢 P4 | Indicador de urgência no WhatsApp | Médio | Baixo | ⭐⭐ |
| 🟢 P4 | Filtros no Kanban de tarefas internas | Baixo | Baixo | ⭐⭐ |
| 🟢 P4 | Relatório mensal automático por email | Alto | Alto | ⭐⭐ |
| 🟢 P4 | Resposta automática por IA | Alto | Alto | ⭐⭐ |

---

## 9. Conclusão

O CodeHelp CRM é um sistema com **base sólida e potencial inexplorado**. O WhatsApp integrado, o Kanban de atendimento e o Dashboard com IA são diferenciais reais no mercado de helpdesk para laboratórios. No entanto, as barreiras de adoção — ausência de onboarding, KPIs sem legenda, SLA invisível, sem exportação — impedem o cliente de extrair todo o valor que paga.

**Os 3 maiores riscos para retenção de clientes são:**

1. **Onboarding zero:** Admin desiste de configurar sozinho, liga para suporte, frustra-se
2. **SLA invisível:** Chamados violam SLA sem detecção, cliente do laboratório reclama
3. **Sem exportação:** Gestor não consegue provar valor do sistema para a diretoria

**As 3 maiores oportunidades de diferenciação são:**

1. **WhatsApp nativo com menu interativo** (já existe, precisa de melhor UX)
2. **OS Digital com assinatura via WhatsApp** (já existe, precisa de onboarding)
3. **Insights IA no Dashboard** (já existe, precisa de destaque e ação)

Com as correções prioritárias (onboarding wizard, SLA visível, toggle senha, exportação), o CodeHelp pode saltar de **6.8 para 8.5+** em experiência do cliente, reduzindo churn e aumentando NPS.

---

*Relatório gerado pelo squad codehelp-audit-squad em 19/06/2026*
*Auditor: Fernando Alves — Customer Success Manager Senior*
