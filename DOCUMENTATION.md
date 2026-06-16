# Documentação — Helpdesk Enhancements (v1.4-dev)

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Regras de Fila](#2-regras-de-fila)
3. [Temas do CRM](#3-temas-do-crm)
4. [Fluxo de Aprovação](#4-fluxo-de-aprovação)
5. [Alertas e Notificações](#5-alertas-e-notificações)
6. [Mensagens Automáticas](#6-mensagens-automáticas)
7. [Dashboard Dinâmico](#7-dashboard-dinâmico)
8. [Sessão e Segurança](#8-sessão-e-segurança)
9. [Suporte Mobile](#9-suporte-mobile)
10. [Assinatura Digital de OS](#10-assinatura-digital-de-os)
11. [Tema e Aparência](#11-tema-e-aparência)
12. [Guia de Aprovação de Clientes](#12-guia-de-aprovação-de-clientes)

---

## 1. Visão Geral

O módulo Helpdesk foi aprimorado com 12 melhorias significativas:

| Melhoria | Status | Arquivos |
|----------|--------|----------|
| Regras de Fila | ✅ Concluído | `helpdesk.service.ts` |
| Temas do CRM | ✅ Concluído | `CRMThemes.tsx` |
| Fluxo de Aprovação | ✅ Concluído | `aprovacao.service.ts` |
| Alertas de Atendente | ✅ Concluído | `alerts.service.ts`, `AlertSettings.tsx` |
| Mensagens Automáticas | ✅ Concluído | `autoMessages.service.ts`, `AutoMessagesPage.tsx` |
| Dashboard Dinâmico | ✅ Concluído | `Dashboard.tsx` |
| Fix Sessão | ✅ Concluído | `api.ts` |
| Mobile Responsivo | ✅ Concluído | `index.css`, `ThemeContext.tsx` |
| Tema Claro/Escuro | ✅ Concluído | `ThemeSettings.tsx` |
| Fundos Configuráveis | ✅ Concluído | `ThemeContext.tsx` |
| Alertas Sonoros | ✅ Concluído | `soundAlerts.ts`, `WhatsAppPage.tsx` |
| Assinatura OS Mobile | ✅ Concluído | `SignatureCanvas.tsx`, `SignPage.tsx` |

---

## 2. Regras de Fila

### O que faz
Pausa automaticamente os contadores de SLA quando o cliente está sem responder, offline, ausente ou inativo.

### Limiares configurados
| Status | Tempo | Função |
|--------|-------|--------|
| Sem resposta | 24 horas | `isClientWithoutResponse()` |
| Offline | 2 horas (durante horário comercial) | `isClientOffline()` |
| Ausente | 4 horas | `isClientAbsent()` |
| Inativo | 8 horas | `isClientInactive()` |

### Como funciona
1. A cada verificação de SLA, o sistema verifica o status do cliente
2. Se o cliente estiver em algum dos status acima, os contadores são pausados
3. Quando o cliente responde, os contadores são retomados
4. O status é atualizado automaticamente a cada 5 minutos

### Funções principais
- `pauseClientCounters(ticketId)` — Pausa os contadores
- `resumeClientCounters(ticketId)` — Retoma os contadores
- `updateClientStatusCounters(ticketId)` — Atualiza status baseado em condições atuais
- `getClientStatusInfo(ticketId)` — Retorna informações completas do status

---

## 3. Temas do CRM

### O que faz
Permite gerenciar temas (cores, estilos) usados em todo o CRM.

### Permissões
| Ação | Roles permitidos |
|------|-----------------|
| Listar temas | admin, gerente, vendedor |
| Criar tema | admin, gerente |
| Editar tema | admin, gerente |
| Excluir tema | admin |

### Como acessar
- Menu lateral → CRM → **Temas**
- Rota: `/app/crm/temas`

### Funcionalidades
- CRUD completo (Criar, Ler, Editar, Excluir)
- Busca por nome
- Preview das cores do tema
- Validação de cores (hex)

---

## 4. Fluxo de Aprovação

### O que faz
Sistema formal de aprovação para ações que requerem autorização de um superior.

### Como funciona

#### Passo 1: Solicitar Aprovação
1. Usuário realiza uma ação que requer aprovação
2. Sistema cria uma `Aprovacao` com status `pendente`
3. Notificação enviada para todos os admin/gerente

#### Passo 2: Avaliar Solicitação
1. Admin/gerente acessa **Aprovações** no menu
2. Visualiza solicitações pendentes
3. Pode **Aprovar** ou **Rejeitar** com justificativa

#### Passo 3: Resultado
- **Aprovada**: Ação é executada
- **Rejeitada**: Ação não é executada, solicitante é notificado

### Como enviar uma solicitação de autorização

#### Para clientes (aprovação de acesso):
1. Acesse o painel de clientes
2. Selecione o cliente que precisa de acesso
3. Clique em "Solicitar Aprovação"
4. Preencha o motivo da solicitação
5. Envie — notificação será enviada aos aprovadores

#### Para outros fluxos:
- A solicitação é criada automaticamente quando uma ação requer aprovação
- Exemplos: exclusão de registro, alteração de permissão, acesso a dado sensível

### Onde visualizar
- Menu lateral → **Aprovações** (ícone 🛡️)
- Rota: `/app/helpdesk/aprovacoes`
- Apenas admin e gerente têm acesso

### Status possíveis
| Status | Significado |
|--------|-------------|
| `pendente` | Aguardando avaliação |
| `aprovada` | Ação autorizada |
| `rejeitada` | Ação negada |

---

## 5. Alertas e Notificações

### O que faz
Configura alertas sonoros e notificações para atendentes quando clientes entram ou mensagens chegam.

### Configuração por atendente
Cada atendente pode configurar individualmente:
- **Alertas sonoros**: Ativar/desativar por tipo
- **Cores de prioridade**: Personalizar cores por nível
- **Prioridade**: Definir quais alertas são importantes

### Tipos de alerta
| Tipo | Descrição |
|------|-----------|
| `cliente_entrou` | Novo cliente entrou na fila |
| `nova_mensagem` | Mensagem recebida do cliente |
| `ticket_movido` | Ticket mudou de etapa |
| `sla_alerta` | SLA próximo do vencimento |
| `sla_vencido` | SLA vencido |

### Como acessar
- Menu lateral → **Configurações** → **Alertas Atendente**
- Rota: `/app/settings/alert-settings`

### Configuração de alertas semanais (admin)
- Menu lateral → **Configurações** → **Alertas**
- Rota: `/app/settings/alerts`
- Define destinatários de relatórios semanais

---

## 6. Mensagens Automáticas

### O que faz
Permite editar todas as mensagens enviadas automaticamente pela plataforma.

### Mensagens editáveis
| Slug | Descrição |
|------|-----------|
| `fila` | Mensagem ao entrar na fila |
| `triagem` | Mensagem durante triagem |
| `em_atendimento` | Mensagem ao iniciar atendimento |
| `aguardando_cliente` | Mensagem ao aguardar resposta do cliente |
| `aguardando_os` | Mensagem ao aguardar OS |
| `concluido` | Mensagem ao concluir atendimento |
| `followup` | Mensagem de follow-up |
| `boas_vindas` | Mensagem de boas-vindas |
| `opcao_invalida` | Resposta para opção inválida |
| `fora_horario` | Mensagem fora do horário comercial |

### Variáveis disponíveis
| Variável | Descrição |
|----------|-----------|
| `{{nome_contato}}` | Nome do contato |
| `{{numero_protocolo}}` | Número do protocolo |
| `{{tecnico}}` | Nome do técnico |
| `{{nome}}` | Nome do atendente |
| `{{saudacao}}` | Saudação (Bom dia/Boa tarde/Boa noite) |

### Como acessar
- Menu lateral → **Configurações** → **Mensagens Automáticas**
- Rota: `/app/settings/auto-messages`

### Funcionalidades
- Editar mensagem inline
- Visualizar variáveis clicando nelas
- Resetar para mensagem padrão
- Preview em tempo real

---

## 7. Dashboard Dinâmico

### O que faz
Adiciona gráficos interativos ao dashboard principal.

### Gráficos disponíveis
1. **Distribuição por Status** (Donut) — Tickets por status
2. **Distribuição por Prioridade** (Bar) — Tickets por prioridade
3. **Distribuição por Canal** (Donut) — Tickets por canal de entrada
4. **Tendência de Tempo de Resposta** (Area) — Tempo médio de resposta ao longo do tempo

### Como acessar
- Menu lateral → **Dashboard**
- Rota: `/app/dashboard`

### Dados exibidos
- Total de tickets
- Tickets abertos/fechados
- Tempo médio de resposta
- Taxa de resolução
- Clientes ativos

---

## 8. Sessão e Segurança

### Auto-refresh de token
O sistema renova automaticamente o token antes de expirar:
- Token de acesso: 15 minutos
- Token de refresh: 7 dias
- Renovação agendada 60 segundos antes da expiração
- Fila de requisições para evitar refresh concorrente

### Como funciona
1. Ao fazer login, o sistema agenda renovação automática
2. 60 segundos antes do token expirar, um novo token é solicitado
3. Requisições em fila aguardam o refresh antes de continuar
4. Se o refresh falhar, o usuário é redirecionado para login

---

## 9. Suporte Mobile

### O que foi implementado
- **Safe area insets**: CSS para respeitar áreas seguras do iPhone/notch
- **Touch targets**: Botões com mínimo 44px para toque
- **Viewport meta**: Configurado para zoom correto em mobile
- **Dark mode**: Suporte completo em dispositivos móveis
- **Layout responsivo**: Todos os componentes se adaptam

### Classes CSS utilitárias
```css
.safe-area { padding: env(safe-area-inset-top) env(safe-area-inset-right) ... }
.touch-target { min-height: 44px; min-width: 44px; }
```

### Como testar no celular
1. Acesse o sistema pelo navegador do celular
2. Use `Ctrl+Shift+M` no Chrome para simular mobile
3. Teste touch em todos os componentes

---

## 10. Assinatura Digital de OS

### O que faz
Permite assinar Ordens de Serviço digitalmente com canvas de assinatura otimizado para mobile.

### Componentes
- **SignatureCanvas.tsx**: Componente reutilizável de assinatura
- **SignPage.tsx**: Página de assinatura pública (via link)

### Funcionalidades do canvas
- Suporte a touch (dedo no celular)
- Suporte a mouse (computador)
- DPI-aware (Retina/HiDPI)
- Curvas suaves (quadratic bezier)
- Botões Desfazer e Limpar
- Placeholder com instruções

### Como assinar uma OS

#### Pelo sistema (admin/gerente):
1. Acesse **OS** → Selecione uma OS
2. Clique em **Enviar para Assinatura**
3. O cliente recebe um link por WhatsApp/email

#### Pelo link externo (cliente):
1. Abra o link recebido
2. Preencha: Nome, CPF, Cargo
3. Desenhe a assinatura com o dedo
4. Clique em **Assinar OS**
5. Receba confirmação e PDF por email

### Fluxo completo
```
Admin cria OS → Envia para assinatura → Link gerado →
Cliente assina (touch/mouse) → PDF gerado → Email enviado
```

---

## 11. Tema e Aparência

### Modos de fundo
| Modo | Descrição |
|------|-----------|
| `white` | Fundo branco padrão |
| `ice` | Fundo azul claro sutil |
| `gray` | Fundo cinza leve |
| `blue` | Fundo azul mais forte |

### Como alterar
1. Clique no ícone de configurações (⚙️) no header
2. Selecione **Modo de Fundo**
3. Escolha entre: Branco, Gelo, Cinza, Azul

### Modo Escuro
- Alterna entre tema claro e escuro
- Salva preferência no localStorage
- Aplicação imediata em todas as telas

### Configurações visuais
- **Escala de fonte**: Pequena, Média, Grande
- **Esquema de cores**: Padrão, Coral, Violeta, Floresta, Oceano, Dragão
- **Layout da sidebar**: Lateral, Compacta, Empilhada

---

## 12. Guia de Aprovação de Clientes

### Cenário: Cliente solicita acesso ao sistema

#### Passo 1: Receber solicitação
- Cliente entra em contato (WhatsApp, email, telefone)
- Solicita acesso ao sistema

#### Passo 2: Criar solicitação no sistema
1. Acesse **CRM** → **Clientes**
2. Selecione ou cadastre o cliente
3. Clique em **Solicitar Aprovação**
4. Preencha:
   - **Tipo**: Acesso ao sistema
   - **Motivo**: Descreva por que o cliente precisa de acesso
   - **Urgência**: Normal/Urgente

#### Passo 3: Aprovação
1. Admin/gerente recebe notificação
2. Acesse **Aprovações** no menu
3. Visualize os dados do cliente e o motivo
4. Clique em **Aprovar** ou **Rejeitar**
5. Se rejeitar, escreva a justificativa

#### Passo 4: Resultado
- **Aprovado**: Cliente recebe credenciais por email/WhatsApp
- **Rejeitado**: Solicitante é notificado com a justificativa

### Fluxo visual
```
Solicitação → Notificação → Avaliação → Aprovação/Rejeição → Resultado
    ↓              ↓            ↓              ↓                ↓
 Cliente      Admin/        Admin/         Admin/          Cliente
              Gerente       Gerente        Gerente         (credenciais)
```

### Quem pode aprovar
| Role | Pode aprovar? |
|------|--------------|
| admin | ✅ Sim |
| gerente | ✅ Sim |
| supervisor | ❌ Não |
| tecnico | ❌ Não |
| vendedor | ❌ Não |

---

## Resumo das Rotas

| Rota | Página | Acesso |
|------|--------|--------|
| `/app/dashboard` | Dashboard | Todos |
| `/app/helpdesk` | Helpdesk | Todos |
| `/app/helpdesk/aprovacoes` | Aprovações | admin, gerente |
| `/app/crm/temas` | Temas CRM | admin, gerente, vendedor |
| `/app/settings/auto-messages` | Mensagens Automáticas | admin, gerente |
| `/app/settings/alert-settings` | Alertas Atendente | Todos |
| `/app/settings/alerts` | Alertas Semanais | admin, gerente |
| `/assinar/:token` | Assinatura OS | Público (link) |

---

## Resumo dos Endpoints API

### Helpdesk
- `GET /helpdesk/auto-messages` — Listar mensagens automáticas
- `PUT /helpdesk/auto-messages/:slug` — Atualizar mensagem
- `POST /helpdesk/auto-messages/:slug/reset` — Resetar mensagem

### Aprovações
- `GET /aprovacoes` — Listar aprovações
- `POST /aprovacoes` — Criar solicitação
- `PUT /aprovacoes/:id/aprovar` — Aprovar
- `PUT /aprovacoes/:id/rejeitar` — Rejeitar

### Alertas
- `GET /alerts/agent/config` — Config do atendente
- `PUT /alerts/agent/config` — Salvar config
- `GET /alerts/agent/nao-lidos` — Alertas não lidos
- `GET /alerts/agent/resumo` — Resumo de alertas

### OS
- `GET /orders/sign/:token` — Dados da assinatura
- `POST /orders/sign/:token` — Enviar assinatura
- `POST /orders/:id/send-signature` — Gerar link de assinatura
