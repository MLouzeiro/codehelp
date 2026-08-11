# Manual de Funcionalidades — CodeHelp CRM

**Versão:** 1.0  
**Data:** 19/06/2026  
**Squad:** codehelp-audit-squad  
**Público-alvo:** Administradores, gestores, atendentes e técnicos de laboratórios de análises clínicas

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Primeiros Passos (Onboarding)](#2-primeiros-passos-onboarding)
3. [Helpdesk](#3-helpdesk)
4. [WhatsApp](#4-whatsapp)
5. [CRM](#5-crm)
6. [Ordens de Serviço (OS)](#6-ordens-de-serviço-os)
7. [Kanban de Tarefas](#7-kanban-de-tarefas)
8. [Dashboard e Analytics](#8-dashboard-e-analytics)
9. [Automações](#9-automações)
10. [Base de Conhecimento (KB)](#10-base-de-conhecimento-kb)
11. [Notificações e Alertas](#11-notificações-e-alertas)
12. [Aprovações](#12-aprovações)
13. [Configurações](#13-configurações)
14. [Gestão de Usuários](#14-gestão-de-usuários)
15. [API (para Desenvolvedores)](#15-api-para-desenvolvedores)
16. [Solução de Problemas](#16-solução-de-problemas)
17. [Glossário](#17-glossário)

---

## 1. Visão Geral do Sistema

### O que é

O **CodeHelp CRM** é um sistema de gestão de relacionamento com clientes (CRM) e helpdesk projetado especificamente para **laboratórios de análises clínicas**. Ele integra WhatsApp, atendimento ao cliente, ordens de serviço, automações e analytics em uma única plataforma.

### Para que serve

- **Centralizar** toda comunicação com clientes via WhatsApp em um único painel
- **Organizar** o atendimento com Kanban visual, filas e escalação automática
- **Gerenciar** cadastro de clientes, contratos e oportunidades comerciais
- **Automatizar** respostas, triagem e follow-ups
- **Acompanhar** métricas de atendimento com dashboard e insights de IA

### Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma + PostgreSQL |
| Auth | JWT (access 15min + refresh 7d) + bcrypt cost 12 |
| Frontend | React 18 + Vite + TypeScript |
| Estilização | Tailwind CSS |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Roteamento | React Router DOM |
| HTTP | Axios com interceptor de refresh |
| WhatsApp | whatsapp-web.js |

### Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    CODEHELP CRM                         │
├─────────────┬─────────────┬─────────────┬──────────────┤
│  WhatsApp   │   Helpdesk  │    CRM      │  Dashboard   │
│  Integrado  │   Kanban    │   Clientes  │  Analytics   │
├─────────────┴─────────────┴─────────────┴──────────────┤
│                    Backend API                          │
├─────────────────────────────────────────────────────────┤
│              Prisma ORM + PostgreSQL                    │
└─────────────────────────────────────────────────────────┘
```

### Módulos do Sistema

| Módulo | Descrição |
|--------|-----------|
| Helpdesk | Kanban de atendimento, triagem, filas, SLA |
| WhatsApp | Integração com mensagens, multi-numero |
| CRM | Cadastro de clientes, contatos, oportunidades |
| OS Digital | Ordens de serviço com assinatura digital |
| Kanban Interno | Tarefas da equipe |
| Dashboard | KPIs, gráficos, insights de IA |
| Automações | Regras WHEN/IF/THEN |
| Base de Conhecimento | Artigos e FAQ |
| Notificações | Alertas internos e sonoros |
| Aprovações | Fluxo formal de aprovação |
| Configurações | Departamentos, filas, mensagens automáticas |

---

## 2. Primeiros Passos (Onboarding)

### 2.1 Acesso e Login

#### O que é
Tela de autenticação para acesso ao sistema.

#### Como acessar
- Acesse a URL do sistema no navegador
- Clique em "Acessar Sistema" na landing page

#### Passo a passo
1. Digite seu **email** no campo "Email"
2. Digite sua **senha** no campo "Senha"
3. Clique no botão **"Entrar"**

#### Campos e opções
| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Email | Endereço de email cadastrado | Sim |
| Senha | Senha do usuário | Sim |

#### Dicas
- Se esqueceu a senha, entre em contato com o administrador do sistema
- Use o email fornecido pelo administrador na criação da conta

#### Cuidados
- Após 5 tentativas incorretas, o sistema bloqueia o login por 1 hora
- Não compartilhe suas credenciais com outros usuários

---

### 2.2 Configuração Inicial

#### O que é
Após o primeiro login, o administrador precisa configurar o sistema antes de começar a receber atendimentos.

#### Para que serve
Garantir que o sistema esteja pronto para operar com departamentos, filas e mensagens automáticas configuradas.

#### Configurações essenciais (em ordem recomendada)

1. **Departamentos** — Crie os setores do laboratório (Ex: Suporte Técnico, Comercial, Financeiro)
2. **Filas de Atendimento** — Configure filas por nível (N1, N2, N3) com SLA
3. **Mensagens Automáticas** — Personalize mensagens de boas-vindas, triagem e atendimento
4. **Conectar WhatsApp** — Escaneie o QR Code para vincular o número do laboratório
5. **Convidar Equipe** — Crie contas para atendentes e técnicos

#### Cuidados
- Configure os departamentos **antes** de conectar o WhatsApp
- Personalize as mensagens automáticas antes de receber o primeiro chamado

---

### 2.3 Convite de Usuários

#### O que é
Criação de contas para membros da equipe que utilizarão o sistema.

#### Como acessar
- Menu lateral → **Configurações** → **Usuários**

#### Quem pode criar usuários
- **Admin** (acesso total)
- **Gerente** (pode criar usuários)

#### Passo a passo
1. Acesse **Configurações → Usuários**
2. Clique em **"Novo Usuário"**
3. Preencha os campos:
   - **Nome**: Nome completo do usuário
   - **Email**: Email único para login
   - **Senha**: Senha temporária (o usuário deve alterar no primeiro acesso)
   - **Role**: Selecione o perfil de acesso
   - **Telefone**: Opcional
4. Clique em **"Salvar"**

#### Campos e opções

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Nome | Nome completo | Sim |
| Email | Email para login (único) | Sim |
| Senha | Senha inicial | Sim |
| Role | Perfil de acesso | Sim |
| Telefone | Telefone de contato | Não |
| Avatar | Foto do perfil | Não |

#### Dicas
- Comece criando os usuários com perfil **técnico** para a equipe de atendimento
- Use o perfil **gerente** para supervisores que precisam ver relatórios
- O perfil **vendedor** é para a equipe comercial

---

## 3. Helpdesk

### 3.1 Visão Geral do Kanban

#### O que é
O Kanban de Helpdesk é o painel principal de atendimento. Ele mostra todos os chamados organizados em colunas por etapa de atendimento.

#### Para que serve
Visualizar e gerenciar todo o fluxo de atendimento ao cliente de forma visual e intuitiva.

#### Como acessar
- Menu lateral → **Helpdesk** → **Kanban**

#### Visão do Kanban

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  FILA    │ TRIAGEM  │EM ATEND. │AGUARD.   │AGUARD.OS │CONCLUÍDO │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ [Card 1] │ [Card 3] │ [Card 5] │ [Card 7] │ [Card 9] │ [Card 11]│
│ [Card 2] │ [Card 4] │ [Card 6] │ [Card 8] │ [Card 10]│ [Card 12]│
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### Elementos visuais do card

| Elemento | Descrição |
|----------|-----------|
| Cor da borda | Indica prioridade (vermelho = crítica, amarelo = alta) |
| Badge de departamento | Departamento responsável |
| Badge de categoria | Tipo do problema |
| Posição na fila | Número da posição do chamado |
| Protocolo | Identificador único do chamado |
| Avatar do responsável | Técnico atribuído |

#### Dicas
- Use os **filtros** por departamento para focar nos chamados do seu setor
- A **busca por texto** encontra protocolos, nomes ou assuntos específicos
- A **ordenção** pode ser por data, prioridade ou posição na fila

---

### 3.2 Fluxo de Triagem

#### O que é
A triagem é o processo de classificação e direcionamento de novos chamados para o departamento e fila corretos.

#### Como funciona
1. Mensagem chega via WhatsApp
2. Sistema cria ticket na etapa **"Triagem"**
3. Atendente seleciona departamento, categoria e prioridade
4. Ticket move para a etapa **"Fila"** do departamento escolhido

#### Passo a passo para triagem
1. Clique em um ticket na coluna **"Triagem"**
2. No painel lateral, preencha:
   - **Departamento**: Setor responsável
   - **Categoria**: Tipo do problema
   - **Prioridade**: Urgência (Baixa, Média, Alta, Crítica)
   - **Assunto**: Resumo do problema
3. Clique em **"Triar"**

#### Dicas
- Triagem rápida evita que o cliente espere muito tempo
- Use categorias padronizadas para manter consistência nos relatórios

---

### 3.3 Fila de Atendimento

#### O que é
Fila ordenada de chamados aguardando atendimento, respeitando a ordem de chegada e prioridade.

#### Como funciona
- Chamados entram na fila na posição **1** (último a chegar)
- Chamados são atendidos na ordem: **posição 1 primeiro**
- Ao assumir um chamado, ele move para **"Em Atendimento"**
- Posições são recalculadas automaticamente

#### Passo a passo para assumir um chamado
1. Na coluna **"Fila"**, localize o chamado desejado
2. Clique no botão **"Assumir"** no card
3. O ticket move para **"Em Atendimento"** com seu nome como responsável

#### Dicas
- Assuma sempre os chamados na posição 1 para manter a ordem justa
- Se não puder atender, avise ao supervisor para redistribuição

#### Cuidados
- Não pule a fila sem autorização do supervisor
- Chamados com prioridade **crítica** devem ser atendidos imediatamente

---

### 3.4 Atendimento ao Cliente

#### O que é
Painel de chat para troca de mensagens com o cliente via WhatsApp.

#### Como acessar
- Clique em qualquer ticket no Kanban → Painel lateral abre com o chat

#### Funcionalidades do chat
| Funcionalidade | Descrição |
|----------------|-----------|
| Mensagens | Envie e receba mensagens de texto |
| Anexos | Envie imagens e documentos |
| Interno | Marque mensagens como internas (não enviadas ao cliente) |
| Protocolo | Identificador único visível para o cliente |
| Histórico | Todas as mensagens anteriores |

#### Passo a passo para responder
1. Clique no ticket desejado no Kanban
2. No painel lateral, veja a conversa
3. Digite sua mensagem na caixa de texto
4. Clique em **"Enviar"** ou pressione **Enter**

#### Dicas
- Use mensagens **internas** para observações que não devem ser vistas pelo cliente
- Consulte a **Base de Conhecimento** antes de responder dúvidas técnicas

---

### 3.5 Escalonamento

#### O que é
Processo de transferir um chamado de um nível de suporte para outro (ex: N1 → N2).

#### Para que serve
Quando o atendente atual não tem expertise para resolver o problema, ele escala para um nível superior.

#### Passo a passo para escalar
1. No painel do ticket, clique em **"Escalar"**
2. Selecione o **nível de suporte** de destino (N2, N3, etc.)
3. Adicione uma **observação** sobre o motivo da escalação
4. Confirme

#### Como funciona
- O ticket move para a fila do nível superior
- SLA é recalculado para o novo nível
- Notificação é enviada ao nível de destino

#### Dicas
- Sempre documente o motivo da escalação para o próximo atendente
- Verifique se o nível de destino tem atendentes disponíveis

---

### 3.6 Resolução e Fechamento

#### O que é
Processo de encerrar um chamado após a resolução do problema.

#### Passo a passo para resolver
1. No painel do ticket, clique em **"Resolver"**
2. Adicione um **resumo da resolução** (obrigatório)
3. Confirme

#### O que acontece
- Ticket move para **"Concluído"**
- Data de resolução é registrada
- SLA é finalizado
- Pesquisa de satisfação (CSAT) pode ser enviada ao cliente

#### Cuidados
- Documente sempre como o problema foi resolvido
- Feche apenas após confirmação do cliente

---

### 3.7 Métricas e SLA

#### O que é
Sistema de acompanhamento do tempo de resposta e resolução dos chamados.

#### SLA por Prioridade

| Prioridade | Tempo Máximo de Resposta | Tempo Máximo de Resolução |
|------------|-------------------------|--------------------------|
| Crítica | 15 minutos | 2 horas |
| Alta | 30 minutos | 4 horas |
| Média | 60 minutos | 8 horas |
| Baixa | 120 minutos | 24 horas |

#### Como acessar
- **Dashboard**: Visão geral de SLA
- **Kanban**: Indicador visual no card (quando implementado)
- **API**: `/helpdesk/tickets/:id/sla`

#### Dicas
- Monitore os indicadores de SLA no Dashboard
- Escale antes de vencer o SLA para manter a satisfação do cliente

---

### 3.8 CSAT (Pesquisa de Satisfação)

#### O que é
Pesquisa automática enviada ao cliente após a resolução do chamado para medir satisfação.

#### Como funciona
1. Chamado é resolvido
2. Sistema envia mensagem com link de pesquisa
3. Cliente avalia de 1 a 5 estrelas e pode comentar
4. Resultado é registrado no sistema

#### Como acessar
- **Endpoint**: `/csat/respostas`
- **Dashboard**: Métricas de satisfação

#### Dicas
- Monitore a nota média de satisfação mensalmente
- Responda a clientes que deram notas baixas para recuperar o relacionamento

---

## 4. WhatsApp

### 4.1 Conexão do Número

#### O que é
Vinculação do número de WhatsApp do laboratório ao sistema para receber e enviar mensagens automaticamente.

#### Como acessar
- Menu lateral → **WhatsApp**

#### Passo a passo para conectar
1. Acesse a página **WhatsApp**
2. Clique em **"Conectar"**
3. Um QR Code será exibido
4. No seu celular:
   - Abra o **WhatsApp**
   - Toque nos **três pontos** (menu)
   - Selecione **"Dispositivos conectados"**
   - Toque em **"Conectar dispositivo"**
   - Escaneie o QR Code exibido
5. Aguarde a confirmação de conexão

#### Dicas
- Mantenha o celular conectado à internet
- A conexão é persistente (não precisa escanear novamente)
- Se desconectar, clique em **"Reconectar"**

#### Cuidados
- Apenas **admin** e **gerente** podem conectar/desconectar o WhatsApp
- Não escaneie o QR Code de dispositivos públicos

---

### 4.2 Multi-Numero

#### O que é
Suporte para múltiplas conexões WhatsApp, permitindo atender diferentes departamentos ou números.

#### Como funciona
- Cada número pode ser vinculado a um departamento diferente
- Mensagens são direcionadas automaticamente para a fila correta
- Cada conexão tem status independente

#### Como configurar
1. Acesse **WhatsApp → Configurações**
2. Adicione uma nova conexão
3. Defina o **nome** e **número**
4. Vincule a um **departamento** (opcional)
5. Escaneie o QR Code

---

### 4.3 Mensagens Automáticas

#### O que é
Mensagens pré-configuradas enviadas automaticamente em diferentes etapas do atendimento.

#### Tipos de mensagem

| Tipo | Quando é enviada |
|------|------------------|
| Boas-vindas | Primeira mensagem do cliente |
| Ack Suporte | Confirmação de recebimento no suporte |
| Ack Comercial | Confirmação de recebimento no comercial |
| Opção Inválida | Quando o cliente seleciona opção inexistente |
| Fora de Horário | Mensagem fora do horário comercial |
| Triagem | Ao mover para triagem |
| Em Atendimento | Ao iniciar atendimento |
| Aguardando Cliente | Quando aguarda resposta do cliente |
| Aguardando OS | Quando aguarda OS para resolver |
| Concluído | Ao resolver o chamado |
| CSAT | Pesquisa de satisfação |
| Follow-up | Mensagem de acompanhamento |

#### Como configurar
1. Acesse **Configurações → Mensagens Automáticas**
2. Selecione o tipo de mensagem
3. Edite o texto conforme necessário
4. Salve

#### Dicas
- Use linguagem amigável e clara
- Inclua o **protocolo** na mensagem para referência
- Teste cada mensagem antes de ativar

---

### 4.4 Horário de Atendimento

#### O que é
Configuração do horário em que o sistema aceita novos chamados via WhatsApp.

#### Como configurar
1. Acesse **Configurações → Helpdesk**
2. Configure:
   - **Horário de início** (ex: 08:00)
   - **Horário de término** (ex: 18:00)
   - **Horário de sábado** (ex: 07:00 - 12:00)
   - **Dias de atendimento** (segunda a sexta)

#### Como funciona
- **Dentro do horário**: Mensagem é recebida e ticket criado
- **Fora do horário**: Mensagem automática de "fora de horário" é enviada
- **Feriados**: Sistema considera feriados cadastrados

#### Dicas
- Cadastre os feriados nacionais e municipais
- Configure antecipadamente os horários de feriados especiais

---

### 4.5 Gerenciamento de Conversas

#### O que é
Painel para visualizar e responder todas as conversas do WhatsApp em tempo real.

#### Como acessar
- Menu lateral → **WhatsApp**

#### Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| Lista de conversas | Todas as conversas ativas |
| Preview | Última mensagem recebida |
| Status | Conectado/Desconectado |
| Abrir Chamado | Criar ticket a partir da conversa |
| Transferir | Mover conversa para outro atendente |
| Descartar | Encerrar conversa sem criar ticket |

#### Passo a passo para atender
1. Selecione uma conversa na lista
2. Leia a mensagem do cliente
3. Digite sua resposta
4. Envie

#### Dicas
- Responda rapidamente para manter o tempo de resposta baixo
- Use templates de resposta para dúvidas frequentes

---

## 5. CRM

### 5.1 Cadastro de Clientes

#### O que é
Módulo para cadastro e gestão de informações dos laboratórios clientes.

#### Como acessar
- Menu lateral → **CRM** → **Clientes**

#### Passo a passo para criar um cliente
1. Clique em **"Novo Cliente"**
2. Preencha os campos:
   - **Razão Social** (obrigatório): Nome oficial da empresa
   - **Nome Fantasia**: Nome popular
   - **CNPJ/CPF**: Documento fiscal
   - **Segmento**: Tipo de empresa (Laboratório, Clínica, Hospital)
   - **Telefone**: Telefone principal
   - **Email**: Email de contato
   - **Cidade/Estado**: Localização
   - **Status**: Ativo, Inativo ou Prospecto
   - **Origem**: Como o cliente chegou (manual, indicação, etc.)
   - **Tipo de Contrato**: Tipo do serviço contratado
   - **Valor Mensalidade**: Valor mensal do contrato
3. Clique em **"Salvar"**

#### Campos e opções

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Razão Social | Nome oficial da empresa | Sim |
| Nome Fantasia | Nome popular | Não |
| CNPJ/CPF | Documento fiscal | Não |
| Segmento | Tipo de empresa | Não |
| Telefone | Telefone principal | Não |
| Email | Email de contato | Não |
| Cidade | Cidade | Não |
| Estado | Estado (UF) | Não |
| Status | Situação do cliente | Não |
| Origem | Como chegou ao sistema | Não |

#### Dicas
- Mantenha os dados sempre atualizados
- Use o campo **Segmento** para filtrar clientes por tipo
- Cadastre todos os colaboradores do cliente para facilitar o atendimento

---

### 5.2 Contatos e Colaboradores

#### O que é
Registro de pessoas que trabalham no cliente e interações realizadas com elas.

#### Diferença entre Contato e Colaborador

| Tipo | Descrição |
|------|-----------|
| **Colaborador** | Pessoa que trabalha no cliente (nome, cargo, setor) |
| **Contato** | Interação registrada (ligação, email, reunião) |

#### Como acessar
- **Colaboradores**: CRM → Cliente → Aba "Colaboradores"
- **Contatos**: CRM → Cliente → Aba "Contatos"

#### Passo a passo para adicionar colaborador
1. Acesse o detalhe do cliente
2. Vá para a aba **"Colaboradores"**
3. Clique em **"Novo Colaborador"**
4. Preencha:
   - **Nome** (obrigatório)
   - **Cargo**
   - **Setor**
   - **Email**
   - **Telefone**
   - **WhatsApp**
   - **Principal**: Marque se for o contato principal
5. Salve

---

### 5.3 Oportunidades (Pipeline)

#### O que é
Pipeline visual para acompanhar oportunidades comerciais em diferentes etapas.

#### Como acessar
- Menu lateral → **CRM** → **Pipeline**

#### Etapas do Pipeline

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ PROSPECÇÃO  │ QUALIFICAÇÃO│PROPOSTA     │ NEGOCIAÇÃO  │ FECHAMENTO  │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ Oportunid.  │ Oportunid.  │ Oportunid.  │ Oportunid.  │ Oportunid.  │
│ em prospec. │ qualificadas│ enviadas    │ em negoc.   │ ganhas      │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

#### Passo a passo para criar oportunidade
1. Acesse **CRM → Pipeline**
2. Clique em **"Nova Oportunidade"**
3. Preencha:
   - **Título**: Nome da oportunidade
   - **Cliente**: Cliente vinculado
   - **Valor Estimado**: Valor potencial
   - **Etapa**: Fase atual
   - **Probabilidade**: % de chance de fechamento
   - **Data de Fechamento Prevista**
   - **Responsável**: Vendedor responsável
4. Salve

#### Dicas
- Mantenha as oportunidades atualizadas para relatórios precisos
- Use a probabilidade para calcular o pipeline ponderado

---

### 5.4 Temas CRM

#### O que é
Personalização visual do CRM com temas de cores para diferentes categorias ou departamentos.

#### Como acessar
- Menu lateral → **CRM** → **Temas**

#### Passo a passo
1. Clique em **"Novo Tema"**
2. Defina um **nome** e **cor**
3. Salve

---

## 6. Ordens de Serviço (OS)

### 6.1 Criação de OS

#### O que é
Documento formal de prestação de serviço, com número sequencial, descrição, equipamentos e assinatura digital.

#### Como acessar
- Menu lateral → **Ordens de Serviço**

#### Passo a passo para criar OS
1. Clique em **"Nova OS"**
2. Preencha os campos:
   - **Cliente**: Laboratório destinatário
   - **Tipo de Servício**: Tipo do serviço realizado
   - **Descrição**: Detalhes do serviço
   - **Sistemas Envolvidos**: Sistemas utilizados
   - **Equipamentos**: Equipamentos utilizados
   - **Técnico Responsável**: Profissional responsável
   - **Valor do Serviço**: Valor cobrado
   - **Data Prevista de Entrega**
3. Clique em **"Salvar"**

#### Campos e opções

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| Número OS | Gerado automaticamente | Automático |
| Cliente | Laboratório destinatário | Sim |
| Tipo de Servício | Tipo do serviço | Sim |
| Descrição | Detalhes do serviço | Não |
| Técnico Responsável | Profissional | Sim |
| Valor | Valor cobrado | Não |
| Status | Situação da OS | Automático |

---

### 6.2 Status e Fluxo

#### Fluxo de uma OS

```
Rascunho → Em Andamento → Concluída → Assinada
    ↓           ↓              ↓          ↓
 Cancelada  Suspensa      Arquivada   PDF Gerado
```

#### Status disponíveis

| Status | Descrição |
|--------|-----------|
| Rascunho | OS criada, ainda em preenchimento |
| Em Andamento | Serviço em execução |
| Concluída | Serviço finalizado |
| Assinada | OS assinada digitalmente |
| Cancelada | OS cancelada |

---

### 6.3 Assinatura Digital

#### O que é
Assinatura eletrônica do cliente para validação da OS, sem necessidade de impressão.

#### Como funciona
1. Técnico envia a OS para assinatura
2. Cliente recebe link por WhatsApp/email
3. Cliente acessa o link e assina no celular/computador
4. Assinatura é registrada com IP, data e hora

#### Passo a passo para enviar para assinatura
1. Na OS, clique em **"Enviar para Assinatura"**
2. Confirme o envio
3. O cliente receberá um link de assinatura

#### Passo a passo para assinar (cliente)
1. Acesse o link recebido
2. Preencha:
   - **Nome**
   - **CPF**
   - **Cargo**
3. Assine na tela com o dedo ou mouse
4. Clique em **"Confirmar Assinatura"**

#### Cuidados
- O link de assinatura expira em **7 dias**
- A assinatura é vinculada ao IP e dispositivo do assinante

---

### 6.4 Geração de PDF

#### O que é
Geração automática do documento da OS em formato PDF para download e envio.

#### Como acessar
- Na OS → Botão **"Gerar PDF"**
- Via API: `GET /orders/:id/pdf`

#### O que contém no PDF
- Dados do laboratório
- Descrição do serviço
- Equipamentos utilizados
- Valor
- Assinatura digital (se assinada)

---

## 7. Kanban de Tarefas

### 7.1 Board de Tarefas

#### O que é
Painel visual para organizar tarefas internas da equipe (não relacionadas a clientes).

#### Como acessar
- Menu lateral → **Kanban**

#### Colunas padrão

| Coluna | Descrição |
|--------|-----------|
| A Fazer | Tarefas a iniciar |
| Em Andamento | Tarefas em execução |
| Concluído | Tarefas finalizadas |
| Cancelado | Tarefas canceladas |

---

### 7.2 Criação e Edição

#### Passo a passo para criar tarefa
1. Acesse **Kanban**
2. Clique em **"Nova Tarefa"**
3. Preencha:
   - **Título** (obrigatório)
   - **Descrição**
   - **Prioridade** (Baixa, Média, Alta)
   - **Responsável**
   - **Projeto**
   - **Sprint**
   - **Data de Vencimento**
4. Salve

#### Passo a passo para editar
- Clique no card da tarefa
- Edite os campos necessários
- Salve

---

### 7.3 Drag and Drop

#### O que é
Movimentação de tarefas entre colunas arrastando os cards.

#### Como usar
1. Clique e segure o card da tarefa
2. Arraste para a coluna desejada
3. Solte o card

#### Dicas
- Use o drag-and-drop para atualizar o status visualmente
- Organize por responsável usando filtros

---

## 8. Dashboard e Analytics

### 8.1 Dashboard Principal

#### O que é
Painel com indicadores chave de desempenho (KPIs) e gráficos para visão geral do negócio.

#### Como acessar
- Menu lateral → **Dashboard**

#### KPIs disponíveis

| KPI | Descrição |
|-----|-----------|
| Chamados no Mês | Total de tickets abertos no mês |
| Chamados Abertos | Tickets aguardando atendimento |
| Chamados Resolvidos | Tickets fechados no mês |
| TMR Médio | Tempo Médio de Resposta |
| TMRes Médio | Tempo Médio de Resolução |
| OS no Mês | Ordens de serviço criadas |
| OS Aguardando | OS pendentes de conclusão |
| Clientes Ativos | Total de clientes ativos |

#### Gráficos disponíveis

| Gráfico | Tipo | Dados |
|---------|------|-------|
| Chamados por Período | Linha | Volume diário/semanal |
| Por Categoria | Pizza | Distribuição por tipo |
| Por Status | Pizza | Aberto/Em andamento/Concluído |
| Por Canal | Pizza | WhatsApp/Telefone/Email |
| Por Prioridade | Pizza | Baixa/Média/Alta/Crítica |
| Por Funcionário | Barras | Volume por atendente |
| Tempo de Resposta | Área | Evolução do TMR |

#### Dicas
- Use o filtro de período (7/30/90 dias) para comparar tendências
- Consulte os **Insights de IA** para sugestões automáticas

---

### 8.2 Relatórios

#### O que é
Dados consolidados para análise de desempenho e tomada de decisão.

#### Tipos de relatório

| Relatório | Descrição |
|-----------|-----------|
| Helpdesk | Métricas de atendimento |
| CRM | Análise de clientes e oportunidades |
| OS | Ordens de serviço por período |
| SLA | Cumprimento de acordos de nível de serviço |
| CSAT | Satisfação dos clientes |

#### Como acessar
- **Helpdesk**: Menu → Helpdesk → Métricas
- **CSAT**: API `/csat/respostas`
- **SLA**: API `/helpdesk/sla-configs`

---

### 8.3 KPIs

#### O que são
Indicadores Chave de Performance para medir a eficiência do atendimento.

#### Principais KPIs

| KPI | Fórmula | Meta |
|-----|---------|------|
| TMR (Tempo Médio de Resposta) | Σ(tempo_resposta) / total_chamados | < 30 min |
| TMRes (Tempo Médio de Resolução) | Σ(tempo_resolução) / total_resolvidos | < 4 horas |
| Taxa de Resolução | resolvidos / total * 100 | > 80% |
| CSAT Médio | Σ(notas) / total_respostas | > 4.0 |
| SLA Compliance | dentro_sla / total * 100 | > 90% |

#### Dicas
- Acompanhe os KPIs semanalmente
- Identifique tendências de queda e aja preventivamente

---

## 9. Automações

### 9.1 Regras de Automação

#### O que é
Sistema de regras que executam ações automáticas quando condições específicas são atendidas.

#### Como acessar
- Menu lateral → **Automações**

#### Estrutura de uma regra

```
QUANDO (Trigger) → SE (Condições) → ENTÃO (Ações)
```

#### Triggers disponíveis

| Trigger | Descrição |
|---------|-----------|
| Novo ticket | Quando um novo ticket é criado |
| Mudança de status | Quando o status do ticket muda |
| Mudança de etapa | Quando o ticket move de etapa |
| SLA próximo do vencimento | Quando SLA está em 75% ou 90% |
| Mensagem recebida | Quando cliente envia mensagem |

#### Condições disponíveis

| Condição | Descrição |
|----------|-----------|
| Departamento | Departamento do ticket |
| Categoria | Categoria do ticket |
| Prioridade | Nível de prioridade |
| Status | Status atual |
| Horário | Dentro/fora do horário |

#### Ações disponíveis

| Ação | Descrição |
|------|-----------|
| Enviar mensagem | Mensagem automática ao cliente |
| Notificar equipe | Alerta para a equipe |
| Mover ticket | Mudar de etapa automaticamente |
| Atribuir ticket | Designar responsável |
| Escalar ticket | Mudar de nível |

---

### 9.2 Triggers e Ações

#### Passo a passo para criar regra
1. Acesse **Automações**
2. Clique em **"Nova Regra"**
3. Configure:
   - **Nome**: Identificador da regra
   - **Trigger**: Evento que dispara
   - **Condições**: Filtros para ativação
   - **Ações**: O que será executado
4. Salve e ative

#### Dicas
- Comece com regras simples (ex: notificar ao receber mensagem)
- Teste cada regra antes de ativar em produção
- Use a ordem de prioridade para regras conflitantes

---

## 10. Base de Conhecimento (KB)

### 10.1 Criação de Artigos

#### O que é
Repositório de artigos e documentos para consulta da equipe e dos clientes.

#### Como acessar
- Menu lateral → **Base de Conhecimento**

#### Passo a passo para criar artigo
1. Clique em **"Novo Artigo"**
2. Preencha:
   - **Título**: Nome do artigo
   - **Conteúdo**: Texto completo (suporta Markdown)
   - **Resumo**: Resumo curto para busca
   - **Categoria**: Classificação do artigo
   - **Tags**: Palavras-chave para busca
   - **Autor**: Criador do artigo
3. Salve como **rascunho**

---

### 10.2 Publicação e Busca

#### Passo a passo para publicar
1. Abra o artigo
2. Revise o conteúdo
3. Clique em **"Publicar"**
4. O artigo fica disponível para busca

#### Busca de artigos
- Use a barra de busca na página da KB
- Filtre por categoria
- Pesquise por tags

#### Dicas
- Mantenha os artigos atualizados
- Use linguagem clara e objetiva
- Inclua exemplos práticos

---

## 11. Notificações e Alertas

### 11.1 Notificações Internas

#### O que é
Sistema de alertas visuais e sonoros para informar sobre eventos importantes.

#### Tipos de notificação

| Tipo | Descrição |
|------|-----------|
| Novo ticket | Chamado atribuído a você |
| Nova mensagem | Mensagem recebida em ticket aberto |
| SLA vencido | Ticket com SLA violado |
| Aprovação pendente | Aprovação aguardando decisão |

#### Como acessar
- Ícone de sino no header (canto superior direito)
- Indicador de não lidas

#### Dicas
- Mantenha as notificações habilitadas para não perder chamados urgentes
- Configure alertas sonoros preferenciais

---

### 11.2 Alertas WhatsApp

#### O que é
Alertas automáticos enviados para a equipe quando há violação de SLA ou eventos críticos.

#### Como configurar
1. Acesse **Configurações → Alertas**
2. Adicione destinatários
3. Configure os tipos de alerta

---

## 12. Aprovações

### 12.1 Fluxo de Aprovação

#### O que é
Sistema formal para aprovação de ações que exigem autorização (ex: orçamentos, descontos).

#### Como acessar
- Menu lateral → **Aprovações**

#### Fluxo

```
Solicitação → Pendente → Aprovado/Rejeitado
     ↓           ↓              ↓
  Notificação  Aguardando   Registro
```

---

### 12.2 Decisão (Aprovar/Rejeitar)

#### Passo a passo
1. Acesse **Aprovações → Pendentes**
2. Selecione a solicitação
3. Leia o motivo e detalhes
4. Clique em **"Aprovar"** ou **"Rejeitar"**
5. Adicione observação (opcional)
6. Confirme

#### Cuidados
- Documente o motivo da decisão
- Aprovações são registradas com auditoria completa

---

## 13. Configurações

### 13.1 Helpdesk (Etapas, Filas, Níveis)

#### Etapas do Kanban

| Configuração | Descrição |
|--------------|-----------|
| Criar etapa | Adicionar nova coluna no Kanban |
| Renomear | Alterar nome da etapa |
| Reordenar | Mudar posição da etapa |
| Ativar/Desativar | Mostrar ou ocultar etapa |

#### Filas de Atendimento

| Configuração | Descrição |
|--------------|-----------|
| Criar fila | Nova fila de atendimento |
| Nível | N1, N2, N3, etc. |
| SLA | Tempo alvo em minutos |
| Departamento | Vinculação departamental |
| Próxima fila | Escalonamento automático |

#### Níveis de Suporte

| Configuração | Descrição |
|--------------|-----------|
| Criar nível | Novo nível de suporte |
| Nome | Identificador (N1, N2, etc.) |
| SLA | Tempo alvo para o nível |

---

### 13.2 Departamentos

#### O que é
Organização da empresa em setores para direcionamento de chamados.

#### Passo a passo
1. Acesse **Configurações → Departamentos**
2. Clique em **"Novo Departamento"**
3. Preencha:
   - **Nome**: Nome do departamento
   - **Slug**: Identificador URL-friendly
   - **Cor**: Cor de identificação
   - **Ícone**: Ícone representativo
4. Salve

---

### 13.3 Feriados

#### O que é
Cadastro de feriados nacionais, estaduais e municipais para bloqueio do horário comercial.

#### Como acessar
- **Configurações → Feriados**

#### Passo a passo
1. Clique em **"Novo Feriado"**
2. Preencha:
   - **Data**: Data do feriado
   - **Nome**: Nome do feriado
   - **Tipo**: Nacional, Estadual ou Municipal
   - **Recorrente**: Se repete anualmente
3. Salve

#### Dicas
- Cadastre feriados com antecedência
- Use a recorrência para feriados que se repetem todo ano

---

### 13.4 Permissões e Roles

#### Roles disponíveis

| Role | Descrição | Permissões |
|------|-----------|------------|
| Admin | Administrador total | Acesso completo |
| Gerente | Gestor de equipe | Gerenciar tickets, relatórios |
| Técnico | Atendente | Atender tickets atribuídos |
| Vendedor | Equipe comercial | Gerenciar clientes e oportunidades |

#### Como configurar
1. Acesse **Configurações → Permissões**
2. Selecione a role
3. Configure as permissões por módulo
4. Salve

---

### 13.5 Mensagens Automáticas

#### O que é
Personalização das mensagens enviadas automaticamente pelo sistema.

#### Tipos disponíveis

| Tipo | Variáveis disponíveis |
|------|----------------------|
| Boas-vindas | {nome}, {empresa} |
| Triagem | {protocolo}, {departamento} |
| Em Atendimento | {tecnico}, {protocolo} |
| Concluído | {protocolo}, {resumo} |
| CSAT | {link_pesquisa} |
| Follow-up | {protocolo}, {mensagem} |

#### Como acessar
- **Configurações → Mensagens Automáticas**

---

## 14. Gestão de Usuários

### 14.1 Criar/Editar Usuários

#### O que é
Gerenciamento de contas de acesso ao sistema.

#### Como acessar
- **Configurações → Usuários** (apenas admin)

#### Passo a passo para criar
1. Clique em **"Novo Usuário"**
2. Preencha nome, email, senha e role
3. Salve

#### Passo a passo para editar
1. Clique no usuário
2. Altere os campos necessários
3. Salve

#### Passo a passo para desativar
1. Clique no usuário
2. Desmarque **"Ativo"**
3. Salve

---

### 14.2 Roles e Permissões

#### Hierarquia de roles

```
Admin (total)
  └── Gerente (gerenciamento)
       └── Técnico (atendimento)
            └── Vendedor (comercial)
```

#### O que cada role pode fazer

| Ação | Admin | Gerente | Técnico | Vendedor |
|------|-------|---------|---------|----------|
| Ver tickets | ✅ | ✅ | ✅ | ❌ |
| Editar tickets | ✅ | ✅ | ✅ | ❌ |
| Deletar tickets | ✅ | ❌ | ❌ | ❌ |
| Ver clientes | ✅ | ✅ | ✅ | ✅ |
| Editar clientes | ✅ | ✅ | ❌ | ✅ |
| Deletar clientes | ✅ | ❌ | ❌ | ❌ |
| Ver relatórios | ✅ | ✅ | ❌ | ❌ |
| Configurar sistema | ✅ | ❌ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ✅ | ❌ | ❌ |

---

### 14.3 RBAC (Controle de Acesso)

#### O que é
Sistema de Controle de Acesso Baseado em Papéis que determina quem pode fazer o quê no sistema.

#### Como funciona
1. Usuário faz login → role é identificada
2. Middleware verifica se a role tem permissão para a ação
3. Se não tiver, retorna erro 403

#### Dicas
- Use o princípio do menor privilégio
- Revise permissões periodicamente
- Nunca compartilhe contas de admin

---

## 15. API (para Desenvolvedores)

### 15.1 Autenticação

#### Como autenticar

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "senha": "senha123"
}
```

#### Resposta

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "Nome",
    "email": "email@exemplo.com",
    "role": "tecnico"
  }
}
```

#### Usando o token

```http
GET /api/helpdesk/kanban
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 15.2 Endpoints Principais

#### Helpdesk

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/helpdesk/kanban` | Listar tickets em formato Kanban |
| GET | `/helpdesk/tickets` | Listar todos os tickets |
| GET | `/helpdesk/tickets/:id` | Detalhes de um ticket |
| POST | `/helpdesk/tickets/:id/move` | Mover ticket de etapa |
| PATCH | `/helpdesk/tickets/:id/atribuir` | Atribuir ticket |
| POST | `/helpdesk/tickets/:id/triage` | Triar ticket |
| GET | `/helpdesk/dashboard` | Dashboard do helpdesk |
| GET | `/helpdesk/metrics` | Métricas de atendimento |

#### CRM

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/crm/clients` | Listar clientes |
| GET | `/crm/clients/:id` | Detalhes do cliente |
| POST | `/crm/clients` | Criar cliente |
| PUT | `/crm/clients/:id` | Atualizar cliente |
| DELETE | `/crm/clients/:id` | Deletar cliente |
| GET | `/crm/pipeline` | Pipeline de oportunidades |

#### WhatsApp

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/whatsapp/status` | Status da conexão |
| GET | `/whatsapp/qrcode` | QR Code para conexão |
| GET | `/whatsapp/tickets` | Tickets do WhatsApp |
| POST | `/whatsapp/send` | Enviar mensagem |
| POST | `/whatsapp/connect` | Conectar WhatsApp |
| POST | `/whatsapp/disconnect` | Desconectar WhatsApp |

#### Ordens de Serviço

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/orders` | Listar OS |
| GET | `/orders/:id` | Detalhes da OS |
| POST | `/orders` | Criar OS |
| PUT | `/orders/:id` | Atualizar OS |
| DELETE | `/orders/:id` | Deletar OS |
| POST | `/orders/:id/send-signature` | Enviar para assinatura |
| GET | `/orders/:id/pdf` | Gerar PDF |

#### Usuários

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users` | Listar usuários |
| POST | `/users` | Criar usuário |
| PUT | `/users/:id` | Atualizar usuário |
| DELETE | `/users/:id` | Deletar usuário |

#### Analytics

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/analytics/dashboard` | Dashboard geral |
| GET | `/analytics/insights` | Insights de IA |
| GET | `/analytics/kpis` | KPIs do sistema |

---

### 15.3 Exemplos de Uso

#### Criar cliente via API

```http
POST /api/crm/clients
Content-Type: application/json
Authorization: Bearer <token>

{
  "razaoSocial": "Laboratório Exemplo LTDA",
  "nomeFantasia": "Lab Exemplo",
  "cnpjCpf": "12.345.678/0001-90",
  "segmento": "laboratorio",
  "telefone": "(11) 99999-9999",
  "email": "contato@labexemplo.com.br",
  "cidade": "São Paulo",
  "estado": "SP"
}
```

#### Criar ticket via WhatsApp

```http
POST /api/whatsapp/tickets
Content-Type: application/json
Authorization: Bearer <token>

{
  "contactPhone": "5511999999999",
  "contactName": "João Silva",
  "departamentoId": "uuid-departamento",
  "assunto": "Dúvida sobre resultado"
}
```

#### Mover ticket de etapa

```http
POST /api/helpdesk/tickets/:id/move
Content-Type: application/json
Authorization: Bearer <token>

{
  "etapaNova": "em_atendimento",
  "mensagem": "Iniciando atendimento"
}
```

---

## 16. Solução de Problemas

### 16.1 FAQ

| Pergunta | Resposta |
|----------|----------|
| Como conectar o WhatsApp? | Acesse WhatsApp → Conectar → Escaneie o QR Code |
| Não recebo notificações | Verifique se o alarme está habilitado nas configurações |
| Esqueci minha senha | Entre em contato com o administrador |
| Como criar um ticket? | Via WhatsApp (automático) ou painel de tickets |
| Como mudar a prioridade? | No painel do ticket, selecione a prioridade desejada |
| Como escalar um ticket? | No painel do ticket, clique em "Escalar" |

---

### 16.2 Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Erro ao criar cliente" | Dados obrigatórios faltando | Verifique se todos os campos obrigatórios estão preenchidos |
| "CNPJ já cadastrado" | CNPJ duplicado | Use o CNPJ de outro cliente ou edite o existente |
| "Não autorizado" | Permissão insuficiente | Solicite ao admin para verificar suas permissões |
| "WhatsApp desconectado" | Conexão perdida | Reconecte via WhatsApp → Reconectar |
| "Token expirado" | Sessão expirada | Faça login novamente |

---

### 16.3 Contato com Suporte

| Canal | Informação |
|-------|-----------|
| Email | suporte@codemed.com.br |
| WhatsApp | (XX) XXXXX-XXXX |
| Horário | Segunda a sexta, 08:00 às 18:00 |

---

## 17. Glossário

| Termo | Definição |
|-------|-----------|
| **Kanban** | Quadro visual com colunas para organizar trabalho por etapas |
| **Ticket** | Chamado ou solicitação de atendimento ao cliente |
| **Protocolo** | Identificador único do ticket (ex: SUP-0001) |
| **SLA** | Service Level Agreement — Acordo de Nível de Serviço |
| **TMR** | Tempo Médio de Resposta — tempo até o primeiro atendimento |
| **TMRes** | Tempo Médio de Resolução — tempo até o fechamento do chamado |
| **CSAT** | Customer Satisfaction — Pesquisa de Satisfação do Cliente |
| **N1/N2/N3** | Níveis de suporte (N1=básico, N2=intermediário, N3=especialista) |
| **Triagem** | Classificação e direcionamento de novos chamados |
| **Fila** | Lista ordenada de chamados aguardando atendimento |
| **Escalonamento** | Transferência de chamado para nível superior |
| **Pipeline** | Fluxo de oportunidades comerciais por etapas |
| **OS** | Ordem de Serviço — documento formal de prestação de serviço |
| **RBAC** | Role-Based Access Control — Controle de Acesso Baseado em Papéis |
| **CSAT** | Customer Satisfaction Score — Pontuação de Satisfação do Cliente |
| **KB** | Knowledge Base — Base de Conhecimento |
| **WhatsApp Web.js** | Biblioteca de integração com WhatsApp |
| **QR Code** | Código bidimensional para autenticação da conexão WhatsApp |
| **Drift** | Mensagem automática de follow-up para clientes inativos |
| **Soft Delete** | Exclusão lógica (registro fica marcado como inativo) |
| **Hard Delete** | Exclusão física do registro no banco de dados |
| **JWT** | JSON Web Token — Token de autenticação |
| **Refresh Token** | Token para renovar o access token sem fazer login novamente |
| **Audit Log** | Registro de auditoria de todas as ações realizadas no sistema |
| **Insights IA** | Análises automáticas geradas por inteligência artificial |

---

**Manual gerado automaticamente pelo squad codehelp-audit-squad em 19/06/2026**  
**Tech Writer:** Beatriz Santos — Tech Writer Senior
