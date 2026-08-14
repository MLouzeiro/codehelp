# IMPLEMENTATION_PROGRESS — CodeHelp CRM/Helpdesk

> Este arquivo é o **registro canônico de progresso**. Atualizar a cada fase concluída.
> Criado em: 2026-08-13 (FASE 0 — Diagnóstico).

Legenda status: ⏳ pendente · 🔧 em andamento · ✅ concluído · ⛔ bloqueado · 🔄 revisado

## Fases (ordem de execução recomendada)

| # | Fase | Prioridade | Status |
|---|------|-----------|--------|
| 0 | Diagnóstico do sistema + documentação base (ARCHITECTURE/FLOWS/PROGRESS) | Alta | ✅ |
| 1 | Suíte de testes integrada (infra de testes padrão + smoke dos fluxos críticos) | Alta | ✅ |
| 2 | Fluxos críticos de negócio (WhatsApp → ticket → atendimento → encerramento → avaliação) | Alta | ✅ |
| 3 | Time Tracking (apontamento de horas, relatórios, vínculo com OS/ticket) | Alta | ✅ |
| 4 | Aprovações (fluxo completo: solicitação → notificação → decisão → histórico) | Média | ✅ |
| 5 | Relatórios gerenciais (semanais, por analista, FCR, SLA, CSAT) | Média | ⏳ |
| 6 | Dashboard de indicadores (painel gerencial consolidado) | Média | ⏳ |
| 7 | Auditoria IA (agente de monitoramento de conversas) | Média | ⏳ |
| 8 | Auditoria individual por analista (relatório + replay de conversa) | Média | ⏳ |
| 9 | Refatoração de código legado (duplicações, handler legado) | Baixa | ⏳ |
| 10 | Documentação final (arquivos já criados + atualização AGENTS.md) | Média | ⏳ |
| 11 | Testes finais integrados (regressão completa) | Alta | ⏳ |

## Histórico de mudanças

| Data | Fase | Descrição | Resultado |
|------|------|-----------|-----------|
| 2026-08-14 | 4 | Aprovações via WhatsApp: `Aprovacao` ganhou `canal` (default interno), `telefoneAprovador`, `token` (@unique, prefixo `aprov_`, TTL 48h) e `expiraEm`. `solicitarAprovacao` aceita `canal`/`telefoneAprovador` e dispara WhatsApp para aprovadores com telefone cadastrado; `enviarAprovacaoWhatsApp` envia lista interativa (`aprovacao_<id>_aprovar`/`rejeitar`) + link fallback `/aprovacoes/<token>`; `decidirAprovacaoPorToken` (sem auth, sem criar ticket); `processarRespostaAprovacaoWhatsApp` intercepta resposta no handler canônico ANTES da criação de ticket (ZERO novo ticket) via interactiveId ou texto (aprovar/rejeitar/1/2/sim/não) casado pelo telefone do aprovador. Frontend: botão "WhatsApp" na lista de aprovações, página pública `/aprovacoes/:token` e rotas `POST /api/aprovacoes/:id/enviar-whatsapp` e `POST /api/aprovacoes/token/:token/decidir`. | Backend 329/329 (5 novos), frontend 5/5, tsc 0 erros novos. |
| 2026-08-14 | 3 | Time Tracking integrado ao ticket: TimeEntry ganhou `clienteId`, `tarefaId`, `setorId`; auto-start de timer ao criar tarefa no ticket (`criar-kanban`); relatório de consumo por cliente (Atendimento/Desenvolvimento/Implantação/Outro/Total) em `GET /api/timetracking/consumption/client`; blocos de tempo em `GET /api/timetracking/ticket/:id/blocks` e exibidos na timeline do ticket; aba "Consumo por Cliente" no TimeTrackingPage. | Backend 324/324 (4 novos), frontend 5/5, tsc 0 erros novos. |
| 2026-08-14 | 2 | Fluxos críticos validados. Suíte estabilizada (arquivos de teste em sequência — elimina corrida de SQLite compartilhado). Teste frontend `auth.test.tsx` atualizado (tokens migraram para cookies). Fix: tickets `aguardando_expediente` agora visíveis para agentes no kanban (`getKanban` — filtro OR). | Backend 320/320 estável (2 execuções consecutivas); frontend 5/5; tsc 0 erros novos. Commit `d8394b9` (checkpoint FASE 0-2). |
| 2026-08-13 | 1 | Infra de testes padrão: `helpers/test-utils.ts` (cleanup, ambiente helpdesk, horário 24/7, sendMessage mock) + smoke do handler canônico `whatsapp-handler.smoke.test.ts` (4 testes) | 318/318 testes passando; tsc 0 erros novos; cobertura do caminho mensagem→ticket→departamento→fila |
| 2026-08-13 | 0 | Diagnóstico do sistema; levantamento de módulos, schema, rotas, fluxos | Backlog mapeado — ver DIAGNÓSTICO |
| 2026-07-10 | — | Correções críticas: encerramento pós-avaliação + lista interativa mascarada | 314/314 testes passando; docs/critical-business-rules/ticket-lifecycle.md criado |

## Regras operacionais

1. **NÃO DESTRUIR**: antes de remover/alterar qualquer fluxo, verificar dependências (grep de chamadores) e rodar testes de regressão.
2. **Trabalho pendente NÃO é trabalho feito**: uma fase só é `✅` após implementação + testes + documentação.
3. **Preservar fluxos críticos** documentados em `docs/FLOWS.md` e protegidos por testes em `backend/src/__tests__/ticket-closure-regression.test.ts` e `interactive-message-flow.test.ts`.
4. Atualizar este arquivo ao final de cada fase com evidências (testes passando, tsc limpo, arquivos tocados).

## Mapa de prioridades abertas (detalhado)

- [ ] Ordem de serviço (Orders) — refinar fluxo de implantação/signature (parcialmente pronto)
- [ ] Dark mode global
- [ ] Auditoria IA: detectar encerramento prematuro / resolução real / reabertura (base: `aiAgentMonitor.service.ts` + `ai-audit.service.ts`)
- [ ] Dashboard IA: cards diário/semanal/por analista (base: `weeklyReport.service.ts`, `metrics.service.ts`, `AuditoriaAtendimento.tsx`)
- [ ] E2E WhatsApp real (Baileys v6.7.23) — pendente de conexão ativa no ambiente
