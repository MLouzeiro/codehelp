# Ciclo de Vida do Ticket — Regra Crítica de Negócio

> ⚠️ **CRITICAL BUSINESS RULE** — Esta regra é protegida por teste de regressão.
> Qualquer alteração no fluxo de encerramento/avaliação exige rodar:
> `npx vitest run src/__tests__/ticket-closure-regression.test.ts src/__tests__/interactive-message-flow.test.ts`

## Regra central

**Um ticket encerrado NUNCA é reaberto por nova mensagem do cliente.**
Nova mensagem sem ticket ativo → **novo ticket** (com menu de departamentos interativo),
ou resposta de avaliação pendente (quando aplicável).

## Etapas do ciclo

```
Cliente envia msg → sem ticket ativo → NOVO TICKET (etapa inicial) → menu interativo dept_<slug>
  → cliente clica departamento → ticket → fila → análise → em_atendimento
  → analista conclui (moveTicketEtapa etapa=concluido) → status=fechado, dataFechamento/Conclusao
  → finalizarAtendimento → evaluationStatus=aguardando → CSAT criado → lista interativa rating_1..5
  → cliente clica rating_N → finalizeTicketAfterEvaluation → CSAT respondido, evaluationStatus=respondido
  → nova mensagem → ticket fechado NÃO reabre → NOVO ticket
```

## Responsabilidades e arquivos

| Responsabilidade | Arquivo / Função |
|------------------|------------------|
| Encerramento (analista conclui) | `backend/src/modules/helpdesk/helpdesk.controller.ts` — `moveTicketEtapa` (etapa `concluido` → `status='fechado'` + datas) |
| Encerramento canônico (manual/IA) | `backend/src/modules/helpdesk/flow.service.ts` — `encerrarTicket` |
| Envio da avaliação | `flow.service.ts` — `finalizarAtendimento` → `csat.service.ts` — `enviarMensagemCsat` |
| Recebimento da avaliação (clique) | `whatsapp-message-handler.ts` — `finalizeTicketAfterEvaluation` (via `interactiveId` `rating_N`) |
| Mudança de status / fechamento | `flow.service.ts` — `buscarTicketAtivo` filtra `STATUS_ENCERRADO` + `ETAPAS_ENCERRADAS` (defesa dupla) |
| Estado do bot (in-memory auxiliar) | `whatsapp-message-handler.ts` — `setWhatsAppConversationState` (`IDLE/AWAITING_CSAT/AWAITING_DEPARTMENT`) |
| Nova mensagem → novo ticket | `whatsapp-message-handler.ts` — sem ticket ativo cria ticket + `enviarMenuInicial` |
| Associação mensagem→ticket | `whatsapp-message-handler.ts` — mensagem salva sempre no ticket resolvido |

## Constantes (fonte única)

`backend/src/modules/helpdesk/constants.ts`
- `STATUS_ENCERRADO = ['fechado', 'cancelado', 'arquivado']`
- `ETAPAS_ENCERRADAS = ['concluido', 'descartado']`
- `EVALUATION_AGUARDANDO / EVALUATION_RESPONDIDA / EVALUATION_CANCELADA`
- `STATUS_FECHADO_CSAT`, `WHERE_TICKET_RESOLVIDO`, `ETAPAS_FIXAS`

## Listas interativas (menu + avaliação)

- Provider ativo: **Baileys v6.7.23** (`@whiskeysockets/baileys`).
- Envio: `whatsapp-message-service.ts` — `enviarListaInterativa` → `whatsapp.service.ts` — `sendWhatsAppListMessage` → `baileys-provider.service.ts` — `sendListMessage` (monta `proto.Message.IListMessage` real via `generateWAMessageFromContent`).
- **NUNCA** enviar texto e retornar `success: true` no catch do envio interativo (isso mascara a falha e registra "interativo" no banco quando o cliente recebeu texto). O fallback para texto é **explícito** em `enviarListaInterativa` (seta `usedFallback: true` + log `[WHATSAPP_INTERACTIVE] fallback=text`).
- IDs estáveis: `dept_<slug>` (menu) e `rating_1..rating_5` (avaliação).
- Recebimento: Baileys normaliza clique via `listResponseMessage.singleSelectReply.selectedRowId` → `interactiveId` → handler usa `detectarOpcaoMenu` / `extrairNotaAvaliacao`.

## Idempotência

- `finalizeTicketAfterEvaluation`: se `CSATResposta.respondidoEm` já preenchido, retorna `{ ok: true, jaFinalizado: true }` **sem reprocessar** (proteção contra clique duplo/webhook duplicado). A nota original prevalece.
- `finalizarAtendimento`: não reenvia CSAT se `enviadoEm` já preenchido ou já respondido.
- `enviarMensagemCsat`: idempotente (`respondidoEm`/`enviadoEm`).

## Ticket=CLOSED independente do envio de mensagem

O estado do ticket NÃO depende do resultado do envio de mensagem. Se o WhatsApp falhar, o ticket permanece `fechado`/`concluido`. `finalizeTicketAfterEvaluation` reaplica `status='fechado'` + `etapa='concluido'` se o ticket tiver sido revertido indevidamente antes da avaliação.

## Testes de regressão (obrigatórios)

- `backend/src/__tests__/ticket-closure-regression.test.ts` — encerramento → avaliação → resposta → fechamento → nova msg = novo ticket; idempotência; `buscarTicketAtivo` nunca reabre.
- `backend/src/__tests__/interactive-message-flow.test.ts` — menu `dept_<slug>` → departamento; avaliação `rating_N` → nota; fluxo completo.
- `backend/src/__tests__/interactive.test.ts` — normalização (`extrairNotaAvaliacao`, `detectarOpcaoMenu`).

Se o fluxo quebrar (ticket reaberto, lista virar texto, avaliação duplicada), **o teste falha primeiro** — corrigir antes de prosseguir.
