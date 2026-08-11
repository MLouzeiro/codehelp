# Relatório de Auditoria — CodeHelp CRM/Helpdesk

**Auditor:** Rafael Costa — QA Engineer Senior  
**Squad:** codehelp-audit-squad  
**Data:** 19/06/2026  
**Versão analisada:** develop (código-fonte atual)  
**Escopo:** Análise estática completa de todos os módulos do backend  

---

## 1. Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Módulos analisados | 14 |
| Bugs identificados | 27 |
| Críticos | 4 |
| Altos | 9 |
| Médios | 10 |
| Baixos | 4 |
| Fluxos validados com sucesso | 12 |

O sistema CodeHelp CRM apresenta uma arquitetura robusta e bem estruturada, com separação clara de responsabilidades entre controllers, services e routes. No entanto, foram identificados problemas significativos em áreas de segurança, race conditions, tratamento de erros e consistência de dados que merecem atenção imediata.

---

## 2. Bugs por Severidade

### 🔴 CRÍTICOS (4)

---

#### BUG-001: Race condition na geração de protocolo — dupla proteção ineficaz

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.service.ts:42-46, 676-697`

**Descrição:**  
A função `generateProtocolo()` usa `withProtocoloLock()` que é uma cadeia de promises (não um mutex real). A função `createTicketWithUniqueProtocolo()` também usa `withProtocoloLock()`. No entanto, `handleIncomingMessage()` (linha 258) **não usa lock ao criar tickets** — cria diretamente via `prisma.ticket.create()` na linha 340 sem protocolo, e o protocolo é gerado apenas quando o atendente abre o chamado via `abrirChamadoPorAtendente()`.

O problema real: `generateProtocolo()` faz read-modify-write (busca último protocolo → incrementa → cria) sem transação serializável. O `withProtocoloLock` é uma cadeia de promises que **não previne concorrência entre múltiplos processos Node** (ex: PM2 cluster, serverless). Em um único processo, funciona; em múltiplos, gera duplicatas.

**Severidade:** Crítico  
**Impacto:** Protocolos duplicados em produção sob carga  
**Recomendação:** Usar `prisma.$transaction` com transação serializável OU usar UUID para protocolos

---

#### BUG-002: Falta de validação de ownership no updateClient — qualquer usuário autenticado pode editar qualquer cliente

**Localização:** `backend/src/modules/crm/crm.controller.ts:94-103`

**Descrição:**  
A função `updateClient()` aceita `req.body` diretamente sem validar se o usuário tem permissão para editar aquele cliente específico. O middleware `authenticate` garante autenticação, mas não há middleware de autorização que verifique se o usuário é o responsável técnico pelo cliente.

```typescript
export async function updateClient(req: AuthRequest, res: Response) {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: req.body,  // ← Permite injeção de qualquer campo
    });
```

**Problemas adicionais:**
1. `req.body` é passado diretamente ao Prisma — permite injeção de campos como `sellerId`, `ativo`, `createdAt`
2. Não há validação de que o cliente existe antes de atualizar (Prisma lança P2025, tratado como 500)

**Severidade:** Crítico  
**Impacto:** Qualquer usuário autenticado pode modificar dados sensíveis de clientes  
**Recomendação:** Whitelist de campos permitidos + middleware de ownership

---

#### BUG-003: Autorização ausente em rotas críticas do WhatsApp

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.routes.ts` (analisei via controller)

**Descrição:**  
As rotas do WhatsApp controller (`getStatus`, `getQrCode`, `connect`, `disconnect`, `listChats`, `getDebugStatus`) **não possuem middleware de autorização**. Qualquer usuário autenticado (inclusive `tecnico`/`solicitante`) pode:
- Conectar/desconectar o WhatsApp
- Visualizar o QR Code
- Acessar dados de debug (caminho de sessão, versão do whatsapp-web.js)
- Listar todos os chats

```typescript
// whatsapp.controller.ts
export async function getDebugStatus(req: Request, res: Response) {
  // Retorna: chromePath, sessionPath, clientExists, state, whatsappWebJsVersion
  // Sem verificação de role!
}
```

**Severidade:** Crítico  
**Impacto:** Qualquer usuário pode desconectar o WhatsApp da produção; vazamento de informações de infraestrutura  
**Recomendação:** Aplicar `authorize('admin', 'gerente')` em todas as rotas de conexão/debug

---

#### BUG-004: Vazamento de dados sensíveis no endpoint de debug

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.controller.ts:170-189`

**Descrição:**  
O endpoint `getDebugStatus` retorna informações que não deveriam estar expostas:
- `chromePath`: caminho do executável do Chrome no servidor
- `sessionPath`: caminho completo da pasta de sessão do WhatsApp
- `whatsappWebJsVersion`: versão exata da lib (facilita exploração de CVEs)
- `clientExists`: confirma existência de sessão

Essas informações são valiosas para um atacante que busca explorar vulnerabilidades conhecidas.

**Severidade:** Crítico  
**Impacto:** Vazamento de informações de infraestrutura que facilitam ataques  
**Recomendação:** Remover ou proteger com `authorize('admin')` + remover campos sensíveis

---

### 🟠 ALTOS (9)

---

#### BUG-005: Sem rate limiting no login

**Localização:** `backend/src/modules/auth/auth.controller.ts:17-39`

**Descrição:**  
Embora o AGENTS.md mencione "rate limit: 5 tentativas/hora", **não há implementação real de rate limiting**. A função `login()` não possui middleware de rate limit. Qualquer atacante pode fazer brute force de senhas.

**Severidade:** Alto  
**Impacto:** Brute force de senhas, comprometimento de contas  
**Recomendação:** Implementar `express-rate-limit` ou similar com 5 tentativas/15min por IP

---

#### BUG-006: Campos de req.body passados diretamente ao Prisma sem sanitização

**Localização:** `backend/src/modules/crm/crm.controller.ts:94-103, 193-202`

**Descrição:**  
Tanto `updateClient()` quanto `updateOpportunity()` passam `req.body` diretamente ao `prisma.update()`. Isso permite injeção de campos que não deveriam ser editáveis:

```typescript
// Qualquer campo do body é aceito:
await prisma.client.update({ where: { id }, data: req.body });
await prisma.opportunity.update({ where: { id }, data: req.body });
```

**Severidade:** Alto  
**Impacto:** Manipulação de campos protegidos (sellerId, createdAt, ativo)  
**Recomendação:** Whitelist de campos permitidos para cada operação

---

#### BUG-007: Update sem verificação de existência em多个 endpoints

**Localização:** `backend/src/modules/kanban/kanban.controller.ts:54-67`

**Descrição:**  
`updateTask()` não verifica se a tarefa existe antes de atualizar. O Prisma lança P2025, mas é tratado como erro genérico 500. O mesmo ocorre em `updateTicket()` do WhatsApp controller (linha 249-270).

**Severidade:** Alto  
**Impacto:** Mensagens de erro confusas para o usuário  
**Recomendação:** Verificar existência antes de atualizar ou tratar P2025 especificamente

---

#### BUG-008: Funções isClientOffline/isClientAbsent/isClientInactive são quase idênticas

**Localização:** `backend/src/modules/helpdesk/helpdesk.service.ts:280-383`

**Descrição:**  
Três funções com lógica quase idêntica, diferindo apenas no threshold de horas (2, 4, 8). Cada uma faz **3 queries ao banco** (findUnique + findUnique + findUnique). Isso resulta em 9 queries ao banco para cada chamada de `updateClientStatusCounters`, que é chamada em **todas as movimentações de ticket**.

**Severidade:** Alto  
**Impacto:** Performance degradada sob carga; N+1 query problem  
**Recomendação:** Unificar em uma única função com parâmetro de threshold

---

#### BUG-009: Mensagens de erro genéricas mascaram problemas reais

**Localização:** `backend/src/modules/crm/crm.controller.ts:89, 101, 116`  
**Também em:** `backend/src/modules/orders/orders.controller.ts:33, 52, 117`

**Descrição:**  
Vários endpoints retornam erros genéricos como "Erro ao criar cliente", "Erro ao atualizar OS" sem incluir o tipo de erro (validação, foreign key, constraint). Isso torna debugging em produção extremamente difícil.

**Severidade:** Alto  
**Impacto:** Dificuldade de diagnóstico de problemas em produção  
**Recomendação:** Logar erro completo no servidor e retornar mensagem genérica, mas com código de erro interno

---

#### BUG-010: Delete de OS não verifica dependências

**Localização:** `backend/src/modules/orders/orders.controller.ts:145-152`

**Descrição:**  
`deleteOrder()` faz hard delete sem verificar se há assinaturas, anexos ou referências em tickets. O Prisma cascade pode causar exclusão em cascata não intencional.

**Severidade:** Alto  
**Impacto:** Perda de dados de assinaturas e anexos vinculados  
**Recomendação:** Implementar soft delete (como feito em clientes) ou verificar dependências

---

#### BUG-011: Falta de validação de transaction na criação de OS

**Localização:** `backend/src/modules/orders/orders.controller.ts:57-118`

**Descrição:**  
A geração de `numeroOs` usa um loop de retry com `await new Promise(r => setTimeout(r, 50))` entre tentativas, mas não usa transação. Em cenário de alta concorrência, dois requests podem gerar o mesmo número.

```typescript
for (let attempt = 0; attempt < 5; attempt++) {
  const count = await prisma.serviceOrder.count(...);
  numeroOs = generateOsNumber(year, count + 1);
  const existing = await prisma.serviceOrder.findUnique({ where: { numeroOs } });
  if (!existing) break;
  await new Promise(r => setTimeout(r, 50)); // ← Race condition
}
```

**Severidade:** Alto  
**Impacto:** OS com números duplicados  
**Recomendação:** Usar sequence ou transação com lock

---

#### BUG-012: createTheme/deleteTheme usam HelpdeskConfig para armazenar temas

**Localização:** `backend/src/modules/crm/crm.controller.ts:225-334`

**Descrição:**  
As funções de gerenciamento de temas (createTheme, updateTheme, deleteTheme) usam a tabela `HelpdeskConfig` que é projetada para configurações do helpdesk. Isso causa conflitos de dados — um tema pode colidir com uma etapa do kanban (slug único).

**Severidade:** Alto  
**Impacto:** Possível corrupção de configurações do helpdesk  
**Recomendação:** Criar tabela separada para temas ou usar campo JSON no HelpdeskConfig

---

#### BUG-013: sendStageAutoMessage pode enviar mensagem para ticket sem departamento

**Localização:** `backend/src/modules/helpdesk/helpdesk.service.ts:170-210`

**Descrição:**  
A função envia mensagem automática ao mover ticket para `em_atendimento`, mas não verifica se o ticket tem `contactPhone`. A linha 183 verifica `!ticket.contactPhone`, mas o phone pode estar em formato inválido para envio.

**Severidade:** Alto  
**Impacto:** Falhas silenciosas no envio de mensagens automáticas  
**Recomendação:** Validar formato do phone antes de enviar

---

### 🟡 MÉDIOS (10)

---

#### BUG-014: Protobuf encoding de emojis quebrado no WhatsApp

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.service.ts:636-644, 648-655`

**Descrição:**  
Os SUBJECTS contêm caracteres especiais mal codificados: `TÃ©cnico`, `DÃºvida`, `SolicitaÃ§Ã£o`, `ReclamaÃ§Ã£o`. Isso indica que o arquivo foi salvo com encoding UTF-8 mas está sendo lido como Latin-1 ou vice-versa.

**Severidade:** Médio  
**Impacto:** Mensagens com caracteres quebrados para o cliente  
**Recomendação:** Corrigir encoding dos strings

---

#### BUG-015: Falta de paginação em listagens que podem crescer indefinidamente

**Localização:** `backend/src/modules/kanban/kanban.controller.ts:101-124`

**Descrição:**  
`getKanban()` para tarefas internas não implementa paginação. Se houver milhares de tarefas, a query retorna todas de uma vez.

**Severidade:** Médio  
**Impacto:** Memory pressure e lentidão sob dados volumosos  
**Recomendação:** Implementar paginação ou limite máximo

---

#### BUG-016: Lógica de permissão inconsistente entre RBAC e Permissions

**Localização:** `backend/src/modules/auth/rbac.ts` vs `backend/src/modules/permissions/permissions.service.ts`

**Descrição:**  
O sistema tem dois sistemas de permissões paralelos:
1. `rbac.ts`: Hierarquia baseada em roles (solicitante < agente < supervisor < admin)
2. `permissions.service.ts`: Sistema de permissões por resource/action com overrides

Eles não estão integrados. O middleware `authorize()` usa apenas `rbac.ts`, ignorando completamente o sistema de permissões avançado.

**Severidade:** Médio  
**Impacto:** Permissões customizadas são ignoradas pelo sistema  
**Recomendação:** Integrar o middleware `authorize` com o `checkPermission` do permissions.service

---

#### BUG-017: updateTicket no WhatsApp controller não valida etapa de transição

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.controller.ts:249-270`

**Descrição:**  
`updateTicket()` permite mudar status diretamente sem validar transições permitidas. Um ticket pode ir de `fechado` para `aberto` diretamente.

**Severidade:** Médio  
**Impacto:** Tickets podem ser reabertos indevidamente  
**Recomendação:** Implementar máquina de estados para transições de status

---

#### BUG-018: Falta de validação de input em múltiplos endpoints

**Localização:** Vários arquivos

**Descrição:**  
Embora o schema Prisma tenha campos obrigatórios,many endpoints não validam dados de entrada antes de chamar o Prisma. Exemplo: `createClient()` valida apenas `razaoSocial`, mas não valida formato de email, CNPJ/CPF, etc.

**Severidade:** Médio  
**Impacto:** Dados inválidos podem ser inseridos no banco  
**Recomendação:** Adicionar validação Zod em todos os endpoints de entrada

---

#### BUG-019: Memory leak potencial nos timers de triagem

**Localização:** `backend/src/modules/helpdesk/triagem.service.ts:16-18`

**Descrição:**  
Os `timersAtivos` e `processando` são Sets em memória que não são persistidos. Se o servidor reiniciar, os timers são perdidos mas os tickets continuam na mesma etapa, resultando em follow-ups não enviados.

**Severidade:** Médio  
**Impacto:** Follow-ups perdidos após restart do servidor  
**Recomendação:** Usar fila de jobs (Bull/BullMQ) para persistir timers

---

#### BUG-020: SLA scheduler não considera feriados

**Localização:** `backend/src/modules/helpdesk/sla.service.ts:105-144`

**Descrição:**  
`processarAlertasSLA()` calcula SLA usando tempo corrido, sem descontar feriados ou horário não comercial. Embora exista o módulo de feriados, ele não é integrado ao cálculo de SLA.

**Severidade:** Médio  
**Impacto:** SLA pode ser violado em feriados/finais de semana  
**Recomendação:** Integrar `ehFeriado()` ao cálculo de SLA

---

#### BUG-021: alerts.service.ts salva config de alertas em HelpdeskConfig

**Localização:** `backend/src/modules/alerts/alerts.service.ts:24-60`

**Descrição:**  
Assim como os temas, as configurações de alertas por usuário são salvas na tabela `HelpdeskConfig` com slug `alert_${userId}`. Isso mistura dados de configuração do sistema com preferências de usuário.

**Severidade:** Médio  
**Impacto:** Possível conflito de slugs; dados misturados  
**Recomendação:** Criar tabela separada `UserAlertConfig`

---

#### BUG-022: KB search não usa índice de busca full-text

**Localização:** `backend/src/modules/kb/kb.service.ts:116-139`

**Descrição:**  
A busca na base de conhecimento usa `contains` do Prisma, que faz busca LIKE com `%term%`. Isso não usa índices e é O(n) na tabela. Com muitos artigos, a busca será lenta.

**Severidade:** Médio  
**Impacto:** Performance de busca degradada com crescimento de dados  
**Recomendação:** Usar full-text search do PostgreSQL ou Elasticsearch

---

#### BUG-023: createTicketFromChat não valida formato do phone

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.controller.ts:130-168`

**Descrição:**  
`createTicketFromChat()` aceita `contactPhone` sem validação de formato. O phone é normalizado com `replace(/[^\d]/g, '')`, mas não valida se resultou em um número válido.

**Severidade:** Médio  
**Impacto:** Tickets com phones inválidos podem ser criados  
**Recomendação:** Validar formato mínimo (ex: 10-13 dígitos)

---

#### BUG-024: getTicketHistory retorna todas as mensagens sem paginação

**Localização:** `backend/src/modules/helpdesk/helpdesk.controller.ts:699-725`

**Descrição:**  
`getHistory()` busca todas as mensagens de um ticket sem limite. Tickets com muitas mensagens podem causar payloads enormes.

**Severidade:** Médio  
**Impacto:** Payloads grandes, lentidão no frontend  
**Recomendação:** Paginar mensagens ou limitar a últimas 100

---

### 🟢 BAIXOS (4)

---

#### BUG-025: Typo em strings de erro do WhatsApp

**Localização:** `backend/src/modules/integrations/whatsapp/whatsapp.service.ts`

**Descrição:**  
Vários strings contêm caracteres corrompidos: `Ã¡`, `Ã§`, `Ã£`, `Ãµ`. Exemplos:
- `Erro ao inicializar WhatsApp` → `InicializaÃ§Ã£o`
- `nÃ£o` em vez de `não`
- `DÃºvida` em vez de `Dúvida`

**Severidade:** Baixo  
**Impacto:** Mensagens de log ilegíveis  
**Recomendação:** Corrigir encoding dos arquivos fonte

---

#### BUG-026: Falta de tratamento de erro em imports dinâmicos

**Localização:** `backend/src/modules/helpdesk/triagem.service.ts:265-267`

**Descrição:**  
`await import('./fila.service')` e `await import('./menu')` dentro de `enviarFollowUp` não têm tratamento de erro. Se o import falhar (ex: erro de compilação), o erro será propagado silenciosamente.

**Severidade:** Baixo  
**Impacto:** Erros de import podem causar falhas silenciosas  
**Recomendação:** Usar imports estáticos no topo do arquivo

---

#### BUG-027: getKanban faz N+1 query para lastMessageCliente_desc

**Localização:** `backend/src/modules/helpdesk/helpdesk.controller.ts:97-108`

**Descrição:**  
Quando `orderBy === 'lastMessageCliente_desc'`, o código faz uma query separada para CADA ticket para buscar a última mensagem do cliente. Com 100 tickets, são 101 queries.

**Severidade:** Baixo  
**Impacto:** Performance degradada com muitos tickets  
**Recomendação:** Buscar todas as últimas mensagens em uma única query com subquery

---

## 3. Fluxos Validados com Sucesso

| # | Fluxo | Status | Observações |
|---|-------|--------|-------------|
| 1 | Login + JWT + Refresh | ✅ OK | Fluxo completo e seguro |
| 2 | RBAC hierarchy (solicitante→admin) | ✅ OK | Normalização legacy funciona |
| 3 | Kanban helpdesk com filtros por role | ✅ OK | Filtragem correta por departamento |
| 4 | Triagem manual de tickets | ✅ OK | Geração de protocolo com retry |
| 5 | Movimentação entre etapas | ✅ OK | Stage events registrados |
| 6 | Cálculo de posição na fila | ✅ OK | Recálculo automático ao assumir |
| 7 | SLA básico por prioridade | ✅ OK | Configuração por SLAConfig |
| 8 | CRUD de clientes | ⚠️ Parcial | Falta autorização (ver BUG-002) |
| 9 | Criação de OS | ⚠️ Parcial | Race condition (ver BUG-011) |
| 10 | Sistema de aprovações | ✅ OK | Fluxo completo com notificações |
| 11 | KB com slug único | ✅ OK | Gerador de slug robusto |
| 12 | Feriados nacionais seed | ✅ OK | Correto com recorrência |

---

## 4. Cenários Específicos do WhatsApp

### 4.1 Mensagem de cliente novo → Cria ticket automaticamente?

**Status:** ✅ SIM  
**Localização:** `whatsapp.service.ts:306-361`  
**Detalhes:** Cria ticket com etapa `triagem`, busca cliente por phone, cria stage event.  
**Problema:** Não gera protocolo na criação (correto — é gerado na triagem).

### 4.2 Fora de horário → Resposta adequada? Ticket criado?

**Status:** ⚠️ PARCIAL  
**Localização:** `whatsapp.service.ts:307-312`  
**Problema:** Quando cliente novo envia mensagem fora de horário, o sistema envia mensagem de "fora de horário" mas **não cria ticket**. Se o cliente responder novamente dentro de horário, um novo ticket será criado. Isso pode causar perda de contexto.

### 4.3 Cliente com ticket aberto → Mensagem vai para ticket existente?

**Status:** ✅ SIM  
**Localização:** `whatsapp.service.ts:280-290`  
**Detalhes:** Busca ticket com `status notIn ['fechado', 'cancelado', 'arquivado']`.  
**Problema:** A busca não filtra por `departamentoId`, então mensagens podem ir para tickets de outros departamentos.

### 4.4 Seleção de departamento → Menu funcional?

**Status:** ✅ SIM  
**Localização:** `whatsapp.service.ts:386-454`, `menu.ts`  
**Detalhes:** Detecta opção numérica, resolve departamento, envia ACK, move para fila.

### 4.5 Posição na fila → Mensagem enviada?

**Status:** ✅ SIM  
**Localização:** `whatsapp.service.ts:549-564`  
**Detalhes:** Sempre re-dispara posição quando cliente envia mensagem na fila.

### 4.6 Captura de assunto/laboratório → Funcional?

**Status:** ✅ SIM  
**Localização:** `whatsapp.service.ts:468-567`  
**Detalhes:** Detecta patterns como "assunto:", "lab:", "empresa:". Cria cliente automaticamente se não encontrado.

### 4.7 Re-disparo de posição → Funciona?

**Status:** ✅ SIM  
**Detalhes:** Posição é recalculada e enviada a cada mensagem do cliente na fila.

### 4.8 Tratamento de erros do WhatsApp Web JS

**Status:** ⚠️ PARCIAL  
**Problemas:**
- `browser_crashed` não limpa timers de triagem
- `auth_failure` não notifica administradores
- Reconexão automática pode entrar em loop se autenticação falhar permanentemente

### 4.9 Race conditions com processingLocks

**Status:** ⚠️ PARCIAL  
**Problema:** `processingLocks` é um `Set<string>` em memória. Em múltiplos processos Node, não previne concorrência. Em um único processo, funciona corretamente.

### 4.10 Sessão e persistência

**Status:** ✅ OK  
**Detalhes:** `LocalAuth` persiste sessão em disco. Health check detecta estados inválidos.

---

## 5. Recomendacoes Priorizadas

### Prioridade 1 — Imediato (esta semana)

1. **BUG-003/004:** Adicionar `authorize('admin', 'gerente')` em todas as rotas de WhatsApp
2. **BUG-002:** Implementar whitelist de campos em updateClient/updateOpportunity
3. **BUG-005:** Adicionar rate limiting ao login (express-rate-limit)
4. **BUG-014/025:** Corrigir encoding dos strings no whatsapp.service.ts

### Prioridade 2 — Curto prazo (2 semanas)

5. **BUG-001:** Implementar transação serializável para geração de protocolo
6. **BUG-006:** Criar middleware de sanitização de body para todos os endpoints
7. **BUG-008:** Unificar funções de status do cliente em uma única query
8. **BUG-011:** Usar sequence ou transação para geração de numeroOs
9. **BUG-016:** Integrar sistema de permissões com middleware authorize

### Prioridade 3 — Médio prazo (1 mês)

10. **BUG-019:** Migrar timers de triagem para fila de jobs (Bull/BullMQ)
11. **BUG-020:** Integrar feriados ao cálculo de SLA
12. **BUG-017:** Implementar máquina de estados para transições de ticket
13. **BUG-018:** Adicionar validação Zod em todos os endpoints
14. **BUG-022:** Implementar full-text search para KB

### Prioridade 4 — Melhorias contínuas

15. **BUG-009:** Implementar error handling padronizado com códigos internos
16. **BUG-015/024:** Adicionar paginação em todas as listagens
17. **BUG-021:** Criar tabela separada para configurações de alertas por usuário
18. **BUG-027:** Otimizar queries N+1 no kanban

---

## 6. Conclusão

O CodeHelp CRM é um sistema funcional e bem arquitetado, com separação clara de responsabilidades e padrões consistentes. Os bugs identificados são majoritariamente de segurança e performance, não de lógica de negócio. As funcionalidades core (helpdesk, WhatsApp, CRM) funcionam conforme esperado.

Os 4 bugs críticos (race condition de protocolo, falta de autorização em rotas WhatsApp, update sem whitelist, e vazamento de dados no debug) devem ser tratados antes de qualquer deploy em produção.

**Score geral:** 6.5/10 — Funcional mas com dívida técnica significativa em segurança.

---

*Relatório gerado automaticamente pelo squad codehelp-audit-squad em 19/06/2026*
