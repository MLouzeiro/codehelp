# CodeHelp CRM/Helpdesk — Guia de Menus

## Visão Geral

O CodeHelp possui **16 menus principais** organizados na sidebar lateral. Alguns menus possuem submenus acessíveis apenas por admin/gerente.

---

## 1. Painel Geral (`/app/dashboard`)

**Descrição:** Dashboard executivo com visão geral do sistema.

**O que mostra:**
- 8 cards de KPIs (chamados no mês, abertos, fechados, tempo médio de resposta, OS, clientes, oportunidades)
- Gráfico de chamados por período (linha)
- Chamados por categoria (pizza)
- Desempenho por funcionário (barras horizontais)
- Distribuição por status (donut)
- Chamados por prioridade (barras)
- Chamados por canal (pizza)
- Tempo de resposta (área)
- Chamados por departamento (barras)
- CSAT trending (área)
- Insights de IA (3 análises automáticas)

**Permissões:** Todos os usuários

---

## 2. Chamados (`/app/helpdesk`)

**Descrição:** Kanban principal de atendimento. Aqui os atendentes gerenciam tickets.

**O que mostra:**
- Board com colunas por etapa (Triagem → Fila → Em Atendimento → Aguardando Cliente → Aguardando OS → Concluído)
- Cards de tickets com prioridade, cliente, protocolo, tempo
- Painel lateral com detalhes do ticket
- Mensagens do ticket (chat)
- Ações: assumir, atribuir, resolver, transferir, descartar
- Filtro por departamento
- Envio de mensagens via WhatsApp

**Permissões:** Todos os usuários

---

## 3. Atendimento Ao Vivo (`/app/helpdesk/painel`)

**Descrição:** Painel operacional em tempo real para supervisores.

**O que mostra:**
- Tickets em atendimento com tempo decorrido
- Status de cada atendente (online/offline)
- Fila de espera por departamento
- Últimos movimentos do sistema
- Quantidade de tickets por etapa

**Permissões:** admin, gerente

---

## 4. Relatórios e Métricas (`/app/helpdesk/metrics`)

**Descrição:** Métricas detalhadas de desempenho do helpdesk.

**O que mostra:**
- Backlog por etapa, prioridade e fila
- MTTR (tempo médio de resolução)
- MTFA (tempo médio de primeira resposta)
- SLA compliance (no prazo vs violados)
- FCR (resolução no primeiro contato)
- CSAT (satisfação do cliente)
- Performance por agente
- Distribuição por categoria

**Permissões:** admin, gerente

---

## 5. Quadro de Status (`/app/helpdesk/board`)

**Descrição:** Visualização read-only de todos os tickets organizados por status.

**O que mostra:**
- 7 colunas de status (Aberto, Em Andamento, Pendente, Escalonado, Resolvido, Fechado, Cancelado)
- Cards com prioridade, cliente, tempo
- Auto-refresh a cada 15 segundos
- Busca por protocolo/nome

**Permissões:** admin, gerente

---

## 6. Aprovações (`/app/helpdesk/aprovacoes`)

**Descrição:** Workflow de aprovações pendentes.

**O que mostra:**
- Lista de aprovações pendentes/aprovadas/rejeitadas
- Filtro por tipo e status
- Ação: aprovar ou rejeitar com observação

**Permissões:** admin, gerente

---

## 7. Base de Conhecimento (`/app/kb`)

**Descrição:** Artigos de ajuda e documentação interna.

**O que mostra:**
- Lista de artigos com busca e categorias
- CRUD de artigos (criar, editar, publicar/despublicar)
- Votos (util/não útil)
- Visualizações

**Permissões:** Todos os usuários

---

## 8. Automações (`/app/automations`)

**Descrição:** Motor de regras de automação.

**O que mostra:**
- Lista de regras ativas/inativas
- Triggers: novo_ticket, msg_recebida, ticket_movido, etc.
- Condições: campo, operador, valor
- Ações: definir_prioridade, atribuir, notificar, enviar_msg, mover_etapa
- CRUD completo

**Permissões:** admin, gerente, supervisor

---

## 9. Clientes (`/app/crm`)

**Descrição:** Gestão de clientes (CRM).

**O que mostra:**
- Lista de clientes com busca e filtro por status
- Detalhe do cliente com abas (visão geral, colaboradores, tickets, OS, oportunidades)
- CRUD de clientes
- Dados: razão social, CNPJ/CPF, contato, segmento, contrato

**Permissões:** Todos os usuários

---

## 10. Pipeline de Vendas (`/app/crm/pipeline`)

**Descrição:** Kanban de oportunidades comerciais.

**O que mostra:**
- 5 colunas: Prospecção, Qualificação, Proposta, Negociação, Ganho/Perdido
- Cards com valor estimado, probabilidade, responsável
- Drag-and-drop
- Valor total e ponderado do pipeline

**Permissões:** Todos os usuários

---

## 11. Ordens de Serviço (`/app/orders`)

**Descrição:** Gestão de ordens de serviço (OS).

**O que mostra:**
- Lista de OS com filtro por status
- Detalhe da OS com dados do serviço
- Assinatura digital (página pública)
- Status: rascunho, pendente, em_andamento, aguardando_assinatura, concluido

**Permissões:** Todos os usuários

---

## 12. WhatsApp (`/app/whatsapp`)

**Descrição:** Interface de chat integrada ao WhatsApp.

**O que mostra:**
- Lista de conversas/tickets
- Chat em tempo real
- Envio de mensagens, áudio, imagem, vídeo
- Ações: abrir ticket, transferir, descartar
- Status de conexão WhatsApp
- Indicador de conexão ativa

**Permissões:** Todos os usuários

---

## 13. Conexão WhatsApp (`/app/whatsapp/conexoes`)

**Descrição:** Gerenciamento de múltiplas conexões WhatsApp.

**O que mostra:**
- Lista de conexões cadastradas
- CRUD de conexões (nome, número, departamento)
- Conectar/desconectar cada conexão individualmente
- QR Code para pareamento
- Status de cada conexão (conectado/desconectado/escaneando)

**Permissões:** admin, gerente

---

## 14. Tarefas Internas (`/app/kanban`)

**Descrição:** Kanban de tarefas internas da equipe.

**O que mostra:**
- Board com colunas: A Fazer, Em Andamento, Concluído
- Cards com prioridade, responsável, data de vencimento
- Drag-and-drop
- CRUD de tarefas

**Permissões:** Todos os usuários

---

## 15. Chatbots (`/app/robos`)

**Descrição:** Gestão de chatbots e respostas automáticas.

**O que mostra:**
- Lista de robots/triggers configurados
- Configuração de respostas automáticas
- Gatilhos por palavra-chave ou contexto

**Permissões:** Todos os usuários

---

## 16. Temas CRM (`/app/crm/temas`)

**Descrição:** Gestão de temas/tags para classificação de clientes.

**O que mostra:**
- Lista de temas com cores
- CRUD de temas
- Associação a clientes

**Permissões:** admin, gerente, vendedor

---

## Configurações (`/app/settings`)

**Descrição:** Painel centralizado de configurações do sistema.

**Submenus:**

| Menu | Descrição | Permissão |
|------|-----------|-----------|
| Usuários | Gestão de usuários e roles | admin |
| Permissões | Matriz RBAC por role | admin master |
| Helpdesk | Mensagens automáticas, menu, horário | admin, gerente |
| Mensagens Automáticas | Editar todas as mensagens da plataforma | admin, gerente |
| Etapas do Helpdesk | CRUD de etapas do kanban | admin master |
| Departamentos | Gestão de setores | admin, gerente |
| Filas | Filas de atendimento por departamento/nível | admin, gerente |
| Níveis de Suporte | Configurar N1, N2, N3, Supervisor | admin, gerente |
| Feriados | Calendário de feriados | admin, gerente |
| Alertas | Alertas semanais e destinatários | admin, gerente |
| Alertas Atendente | Configurar alertas sonoros | admin, gerente |

---

## Fluxo de Trabalho Típico

1. **Cliente envia mensagem** → WhatsApp cria ticket automaticamente
2. **Triagem** → Bot classifica e direciona ao departamento correto
3. **Fila de Espera** → Ticket aguarda atendente disponível
4. **Em Atendimento** → Atendente assume e conversa com cliente
5. **Aguardando Cliente/OS** → Pausa para retorno do cliente ou OS
6. **Concluído** → Ticket resolvido e fechado

---

## Atalhos Úteis

- **Protocolo:** Sempre visível nos tickets (ex: TKT-20260706-0001)
- **Prioridade:** baixa (azul), média (amarelo), alta (laranja), crítica (vermelho)
- **Status:** aberto, em_andamento, pendente, escalonado, resolvido, fechado, cancelado
