# CodeHelp CRM - Manual de Instrucoes

## Guia Rapido de Uso

---

## Sumario

1. [Primeiros Passos](#1-primeiros-passos)
2. [Dashboard](#2-dashboard)
3. [Helpdesk - Gestao de Tickets](#3-helpdesk---gestao-de-tickets)
4. [Clientes (CRM)](#4-clientes-crm)
5. [Ordens de Servico](#5-ordens-de-servico)
6. [WhatsApp](#6-whatsapp)
7. [Base de Conhecimento](#7-base-de-conhecimento)
8. [Automacoes e Robos](#8-automacoes-e-robos)
9. [Configuracoes](#9-configuracoes)
10. [Dicas e Atalhos](#10-dicas-e-atalhos)

---

## 1. Primeiros Passos

### 1.1 Acessar o Sistema

1. Abra o navegador (Chrome, Firefox ou Edge)
2. Digite a URL do sistema na barra de endereco
3. Pressione Enter

### 1.2 Fazer Login

1. Na pagina de login, digite seu **email**
2. Digite sua **senha**
3. Clique no botao **Entrar**
4. Aguarde o redirecionamento para o Dashboard

### 1.3 Navegacao Basica

- **Menu Lateral**: Acesse todos os modulos pelo menu na esquerda
- **Barra de Busca**: Encontre qualquer coisa digitando na barra superior
- **Notificacoes**: Clique no sino para ver avisos
- **Perfil**: Clique no seu nome para ver opcoes de conta
- **Tema**: Alterne entre modo claro/escuro no menu de configuracoes

---

## 2. Dashboard

### 2.1 Visao Geral

O Dashboard mostra um resumo de todas as atividades do sistema:

#### Cards de KPIs (Topo)
- **Chamados no Mes**: Total de tickets criados
- **Em Aberto**: Tickets pendentes
- **Resolvidos**: Tickets finalizados
- **TMR Medio**: Tempo medio de resposta
- **OS no Mes**: Ordens de servico criadas
- **Clientes Ativos**: Total de clientes ativos

#### Graficos (Meio)
- **Tickets por Periodo**: Volume ao longo do tempo
- **Por Categoria**: Distribuicao por tipo
- **Por Atendente**: Produtividade da equipe
- **Por Status**: Situacao dos tickets
- **Tempo de Resposta**: Tendencia de performance

#### Insights de IA (Base)
- Analises automaticas de tendencias
- Sugestoes de melhoria
- Alertas de problemas detectados

### 2.2 Personalizar Visualizacao

1. Use os **filtros** no topo para alterar o periodo
2. Clique em um **grafico** para ver detalhes
3. Passe o mouse sobre os **cards** para ver tooltips

---

## 3. Helpdesk - Gestao de Tickets

### 3.1 Acessar o Helpdesk

1. Clique em **Helpdesk** no menu lateral
2. O board Kanban sera exibido

### 3.2 Entender as Colunas

| Coluna | Descricao | Quem Atende |
|--------|-----------|-------------|
| **Triagem** | Tickets novos aguardando direcionamento | Supervisores |
| **Fila de Espera** | Aguardando atendente disponivel | Automatico |
| **Em Atendimento** | Sendo atendido por um agente | Agentes |
| **Aguardando Cliente** | Esperando resposta do cliente | Cliente |
| **Aguardando OS** | Pendente de Ordem de Servico | Agentes |
| **Concluido** | Atendimento finalizado | - |
| **Descartados** | Spam, mensagens acidentais | - |

### 3.3 Operacoes com Tickets

#### Visualizar Detalhes
1. **Clique** em qualquer card do Kanban
2. O painel lateral abrirá com:
   - Dados do cliente
   - Historico de mensagens
   - Informacoes do ticket
   - Botoes de acao

#### Assumir um Ticket
1. Clique em um ticket na coluna **Fila de Espera**
2. Clique em **Atribuir a mim**
3. O ticket mudara para **Em Atendimento**

#### Responder Mensagem
1. Com o ticket aberto, digite na caixa de texto inferior
2. Clique em **Enviar** ou pressione **Enter**
3. A mensagem sera enviada via WhatsApp

#### Mover Ticket (Drag and Drop)
1. **Pressione e segure** o card
2. **Arraste** para a coluna de destino
3. **Solte** o card na nova coluna

#### Mover Ticket (Menu)
1. Clique no **menu** (tres pontos) do card
2. Selecione **Mover para**
3. Escolha a etapa de destino

#### Atribuir para Outro Agente
1. Clique no ticket para abrir detalhes
2. Clique em **Atribuir**
3. Selecione o agente na lista
4. Confirme

#### Descartar Ticket
1. Clique no **menu** do card
2. Selecione **Descartar**
3. Confirme a acao

### 3.4 Filtrar Tickets

1. No topo do Kanban, use os **filtros**:
   - **Busca**: Pesquise por nome, protocolo ou mensagem
   - **Departamento**: Filtre por setor
   - **Prioridade**: Filtre por urgencia
   - **Atendente**: Filtre por quem esta atendendo

### 3.5 Abrir Chamado Manualmente

1. Clique em **Novo Chamado** no topo
2. Preencha:
   - **Cliente** (busque pelo nome)
   - **Assunto**
   - **Categoria**
   - **Prioridade**
   - **Observacoes**
3. Clique em **Abrir Chamado**

---

## 4. Clientes (CRM)

### 4.1 Lista de Clientes

1. Clique em **Clientes** no menu lateral
2. Veja todos os clientes cadastrados
3. Use a **busca** para encontrar especifico

### 4.2 Criar Cliente

1. Clique em **Novo Cliente**
2. Preencha os campos:
   - **Razao Social** (obrigatorio)
   - **Nome Fantasia**
   - **CNPJ**
   - **Segmento** (Laboratorio, Hospital, Clinica, etc.)
   - **Origem** (WhatsApp, Manual, Web)
   - **Telefone**
   - **Email**
3. Clique em **Salvar**

### 4.3 Editar Cliente

1. Na lista, clique no nome do cliente
2. Clique em **Editar**
3. Altere os dados necessarios
4. Clique em **Salvar**

### 4.4 Detalhes do Cliente

No perfil do cliente, voce encontra:

#### Aba Gerais
- Dados cadastrais
- Status (Ativo, Suspenso, Cancelado, Prospecto)
- Contrato e valores

#### Aba Contatos
- Historico de interacoes
- Chamadas, emails, reunioes

#### Aba Colaboradores
- Pessoas que trabalham no cliente
- Dados de contato
- Principal contato

#### Aba Oportunidades
- Pipeline de vendas
- Valor estimado
- Probabilidade de fechamento

### 4.5 Pipeline de Vendas

1. Clique em **Pipeline** no menu lateral
2. Veja oportunidades em etapas:
   - **Prospeccao**
   - **Proposta**
   - **Negociacao**
   - **Fechamento**
   - **Ganho**
   - **Perdido**
3. Arraste cards para mover entre etapas

---

## 5. Ordens de Servico

### 5.1 Lista de OS

1. Clique em **OS** no menu lateral
2. Veja todas as ordens de servico
3. Filtre por status, cliente ou data

### 5.2 Criar OS

1. Clique em **Nova OS**
2. Selecione o **cliente**
3. Preencha:
   - **Tipo de Servico**
   - **Descricao**
   - **Equipamento**
   - **Sistemas Afetados**
   - **Valor**
4. Clique em **Salvar**

### 5.3 Enviar para Assinatura

1. No detalhe da OS, clique em **Enviar para Assinatura**
2. O sistema gera um **link unico**
3. O link e enviado via **WhatsApp** automaticamente
4. O cliente acessa e assina **digitalmente**

### 5.4 Processo de Assinatura (Cliente)

1. O cliente recebe o link no WhatsApp
2. Clica no link e abre o navegador
3. Preenche:
   - Nome completo
   - CPF
   - Cargo/Funcao
4. Assina na **tela do celular** (toque ou mouse)
5. O **PDF** e gerado automaticamente
6. A OS e marcada como **Concluida**

### 5.5 Status da OS

| Status | Descricao |
|--------|-----------|
| **Rascunho** | Sendo editada |
| **Em Andamento** | Servico em execucao |
| **Aguardando Aprovacao** | Pendente de assinatura |
| **Concluido** | Servico finalizado |
| **Cancelado** | OS cancelada |

### 5.6 Baixar PDF

1. No detalhe da OS, clique em **Baixar PDF**
2. O arquivo sera baixado na pasta de downloads

---

## 6. WhatsApp

### 6.1 Conectar WhatsApp

1. Clique em **WhatsApp** no menu lateral
2. Clique em **Conectar**
3. Um **QR Code** sera exibido
4. No celular:
   - Abra o WhatsApp
   - Va em **Mais opcoes** > **Aparelhos conectados**
   - Clique em **Conectar apos**
   - Escaneie o QR Code
5. A conexao sera estabelecida

### 6.2 Monitorar Conversas

1. Na aba **WhatsApp**, veja:
   - Lista de conversas ativas
   - Tickets associados
   - Status (Conectado/Desconectado)
   - Ultima mensagem

### 6.3 Enviar Mensagem

1. Selecione uma conversa ou ticket
2. Digite sua mensagem na caixa de texto
3. Clique em **Enviar**
4. A mensagem chegará no WhatsApp do cliente

### 6.4 Tipos de Mensagem

- **Texto**: Mensagem simples
- **Imagem**: Anexar fotos
- **Audio**: Enviar gravacoes
- **Documento**: Enviar arquivos

### 6.5 Transferir Conversa

1. Na conversa, clique em **Transferir**
2. Selecione o novo atendente
3. Adicione observacoes
4. Confirme

### 6.6 Status da Conexao

| Status | Significado |
|--------|-------------|
| **Conectado** | WhatsApp ativo e funcionando |
| **Desconectado** | Necessita reconexao |
| **QR Code** | Aguardando escaneamento |

---

## 7. Base de Conhecimento

### 7.1 Acessar

1. Clique em **Base de Conhecimento** no menu lateral
2. Veja a lista de artigos

### 7.2 Criar Artigo

1. Clique em **Novo Artigo**
2. Preencha:
   - **Titulo**
   - **Conteudo** (suporta Markdown)
   - **Resumo**
   - **Tags**
   - **Categoria**
3. Clique em **Salvar como Rascunho**

### 7.3 Editar Artigo

1. Clique no artigo desejado
2. Clique em **Editar**
3. Faca as alteracoes
4. Clique em **Salvar**

### 7.4 Publicar Artigo

1. No artigo, clique em **Publicar**
2. O artigo ficara disponivel para todos
3. Agentes podem sugerir artigos automaticamente

### 7.5 Buscar Artigos

1. Use a **barra de busca** no topo
2. Filtre por **categoria** ou **tags**
3. Clique para ver o conteudo

### 7.6 Dar Feedback

1. No artigo, clique em **Util** ou **Nao Util**
2. Seu feedback ajuda a melhorar o conteudo

---

## 8. Automacoes e Robos

### 8.1 Criar Regra de Automacao

1. Acesse **Automacoes** no menu lateral
2. Clique em **Nova Regra**
3. Configure:
   - **Nome**: Identificador da regra
   - **Evento Disparador**: Quando executar
   - **Condicoes**: Criterios de ativacao
   - **Acoes**: O que fazer quando ativar
4. Clique em **Salvar**

### 8.2 Eventos Disparadores

| Evento | Descricao |
|--------|-----------|
| **novo_ticket** | Quando um ticket e criado |
| **msg_recebida** | Quando uma mensagem chega |
| **status_alterado** | Quando o status muda |
| **sla_alerta** | Quando SLA esta critico |
| **csat_recebido** | Quando CSAT e respondido |

### 8.3 Testar Regra

1. Na regra, clique em **Testar**
2. Forneca um contexto simulado
3. Veja o resultado

### 8.4 Robos IA

1. Acesse **Robos** no menu lateral
2. Veja robos configurados
3. Clique em **Executar** para testar

---

## 9. Configuracoes

### 9.1 Gerenciar Usuarios

1. Acesse **Configuracoes > Usuarios**
2. Para criar:
   - Clique em **Novo Usuario**
   - Preencha nome, email, senha
   - Selecione a role (Admin, Gerente, Tecnico, etc.)
   - Atribua departamentos
   - Clique em **Salvar**

### 9.2 Configurar Helpdesk

1. Acesse **Configuracoes > Helpdesk**
2. Configure:
   - **Etapas**: Nome, cor, ordem
   - **Mensagens**: Textos automaticos
   - **Horarios**: Inicio e fim do expediente
   - **Regras**: Classificacao automatica

### 9.3 Gerenciar Departamentos

1. Acesse **Configuracoes > Departamentos**
2. Para criar:
   - Clique em **Novo Departamento**
   - Preencha nome, descricao, cor
   - Clique em **Salvar**

### 9.4 Configurar Filas

1. Acesse **Configuracoes > Filas**
2. Para criar:
   - Clique em **Nova Fila**
   - Vincule ao departamento
   - Defina o nivel de suporte
   - Configure ordenacao
   - Clique em **Salvar**

### 9.5 Gerenciar Permissoes

1. Acesse **Configuracoes > Permissoes**
2. Selecione a **role**
3. Marque/desmarque permissoes
4. As alteracoes sao imediatas

### 9.6 Configurar Alertas

1. Acesse **Configuracoes > Alertas**
2. Adicione **destinatarios** para relatorios semanais
3. Configure sons de alerta por agente

### 9.7 Feriados

1. Acesse **Configuracoes > Feriados**
2. Clique em **Carregar Feriados Nacionais**
3. Adicione feriados municipais se necessario

---

## 10. Dicas e Atalhos

### 10.1 Atalhos de Teclado

| Tecla | Acao |
|-------|------|
| **Enter** | Enviar mensagem |
| **Esc** | Fechar dialogo/janela |
| **Tab** | Navegar entre campos |
| **Shift + Tab** | Navegar para tras |

### 10.2 Dicas de Uso

#### Para Agentes
1. **Foque em um ticket por vez** - Evite multitarefa
2. **Use templates** - Respostas rapidas para perguntas comuns
3. **Acompanhe SLA** - Verifique o tempo restante
4. **Documente tudo** - Registre cada interacao

#### Para Supervisores
1. **Monitore o Kanban** - Verifique tickets parados
2. **Use metricas** - Analise performance da equipe
3. **Configure automacoes** - Reduza trabalho manual
4. **Revise CSAT** - Acompanhe satisfacao

#### Para Administradores
1. **Configure departamentos** - Organize o fluxo
2. **Defina permissoes** - Controle acesso
3. **Cadastre feriados** - SLA nao conta feriados
4. **Treine a equipe** - Use este manual!

### 10.3 Solucao de Problemas

| Problema | Solucao |
|----------|---------|
| WhatsApp desconectado | Reconecte escaneando o QR Code |
| Ticket nao aparece | Verifique filtros e permissoes |
| Mensagem nao envia | Verifique conexao WhatsApp |
| SLA vencido | Escalone o ticket |
| Login falhou | Verifique email/senha |

### 10.4 Contato com Suporte

Em caso de duvidas:
- Acesse a **Base de Conhecimento**
- Consulte este **Manual**
- Abra um **ticket** no Helpdesk

---

## Contas de Teste (Desenvolvimento)

| Email | Senha | Role |
|-------|-------|------|
| admin@codemed.com.br | admin123 | Admin Master |
| gerente@codemed.com.br | tecnico123 | Gerente |
| joao@codemed.com.br | tecnico123 | Tecnico |
| maria@codemed.com.br | tecnico123 | Tecnico |
| comercial@codemed.com.br | tecnico123 | Comercial |

> **IMPORTANTE**: Estas sao contas de desenvolvimento. Em producao, use senhas seguras!

---

*Manual de Instrucoes - CodeHelp CRM*
*Versao: 1.4*
*Data: 19/06/2026*
