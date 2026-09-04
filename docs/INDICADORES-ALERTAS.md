# Indicadores de Atendimento, Alertas e Visão Geral

Este documento explica como os **indicadores**, **alertas** e a **Visão Geral** funcionam no CodeHelp — incluindo definições, metas padrão, classificações e o catálogo de alertas.

---

## 1. Indicadores de Atendimento

Endpoints: `GET /api/helpdesk/indicadores*` (página `/app/helpdesk/indicadores`).

Metas configuráveis via `HelpdeskConfig.metas_indicadores` (JSON). Padrões:

| Indicador | Definição | Meta padrão | Risco |
|-----------|-----------|-------------|-------|
| **TMR** (Tempo Médio de Resolução) | Tempo entre abertura e fechamento do ticket. | ≤ 360 min | > 480 min |
| **TME** (Tempo Médio de Espera do Cliente) | Soma dos gaps em que o cliente ficou esperando resposta do agente (com espera pendente incluída). | ≤ 30 min | > 60 min |
| **PR** (Primeira Resposta) | Tempo até a primeira resposta do agente. | ≤ 15 min | > 30 min |
| **Taxa SLA** | % de tickets resolvidos dentro do SLA. | ≥ 95% | < 80% |

### Classificação (sempre com ícone + texto)

- 🟢 **Dentro da meta** — OK.
- 🟡 **Atenção** — próximo do limite (ex.: 80%–95% da meta).
- 🔴 **Fora da meta** — acima do risco.

### SLA em tempo real

- `getSlaTicketIndicador` reusa `calcularSlaRestanteMinutos` do `sla.service.ts` para mostrar tempo restante por ticket (aba **Indicadores** no `TicketAtendimentoPage`, polling 30s).

### Retrabalho (`rework`)

Agregado a partir de `AuditoriaProfissional`:

| Métrica | Definição |
|---------|-----------|
| Reaberturas | Tickets reabertos após encerramento. |
| Retrabalho | Atendimentos com retrabalho identificado pela auditoria. |
| Taxa de reabertura | `reaberturas / total auditadas`. |
| Taxa de retrabalho | `retrabalhos / total auditadas`. |

---

## 2. Alertas

### 2.1 Alertas operacionais (`getAlertasOperacionais`)

Base do `GET /api/analytics/executivo` (campo `alertas`) e da Visão Geral.

| Tipo | Nível | Gatilho |
|------|-------|---------|
| `sla_violado` | 🔴 crítico | Ticket com SLA estourado. |
| `whatsapp_offline` | 🔴 crítico | Conexão WhatsApp offline. |
| `sla_em_risco` | 🟡 atenção | SLA ≥ 90% do prazo. |
| `sla_alerta` | 🟡 atenção | SLA ≥ 75% do prazo. |
| `parado_aguardando_os` | 🟡 atenção | `aguardando_os` há mais de 24h. |
| `aguardando_cliente` | 🟡 atenção | `aguardando_cliente` há mais de 48h. |
| `csat_baixo` | 🟡 atenção | CSAT médio < 3.5. |
| `resposta_acima_meta` | 🟡 atenção | TMR > 360 min. |
| `resolucao_baixa` | 🟡 atenção | Taxa de resolução < 60%. |
| `taxa_sla_baixa` | 🟡 atenção | Taxa SLA < 80%. |
| `volume_alto` | 🟡 atenção | Volume 3x acima da média diária (mín. 10 tickets). |

Cada alerta possui: `nivel`, `tipo`, `titulo`, `mensagem`, `contagem?`, `link?`, `icone?`, `dataHora?`, `responsavel?`, `origem?`, `acao?` (sugestão acionável).

### 2.2 Alertas da Visão Geral (`getAlertasVisaoGeral`)

Endpoint: `GET /api/analytics/visao-geral?dias=7|30|90`. Compõe os alertas operacionais **+** alertas gerenciais:

| Tipo | Nível | Gatilho |
|------|-------|---------|
| `chamado_sem_movimentacao` | 🔴 crítico | Chamado sem atualização há muito tempo. |
| `chamado_encerrado_reaberto` | 🔴 crítico | Encerrado e depois reaberto (sem confirmação de resolução). |
| `tarefa_atrasada` | 🔴 crítico | Tarefa kanban com prazo vencido. |
| `tarefa_bloqueada` | 🔴 crítico | Tarefa sem progresso há muito tempo. |
| `chamado_reaberto` | 🟡 atenção | Reabertura de chamado. |
| `chamado_baixa_avaliacao` | 🟡 atenção | CSAT baixo no chamado. |
| `chamado_sem_justificativa` | 🟡 atenção | Encerrado sem justificativa/motivo. |
| `cliente_problema_recorrente` | 🟡 atenção | Cliente com padrão recorrente de problemas. |
| `analista_desempenho` | 🟡 atenção | Analista com nota/indicador abaixo da meta. |
| `tarefa_sem_responsavel` | 🟡 atenção | Tarefa sem responsável atribuído. |
| `tarefa_vencendo_hoje` | 🟡 atenção | Tarefa vence hoje. |
| `tarefa_vencendo_em_breve` | 🟡 atenção | Tarefa vence nos próximos dias. |
| `dev_atrasado` | 🟡 atenção | Tarefa de desenvolvimento atrasada. |
| `dev_em_andamento` | 🟢 info | Desenvolvimento em andamento. |
| `implantacao_atrasado` | 🟡 atenção | Implantação atrasada. |
| `implantacao_em_andamento` | 🟢 info | Implantação em andamento. |

### 2.3 Alertas de Qualidade (`alertasQualidade`)

Compostos automaticamente pelo `qualidadeOperacional.service.ts` e inclusos na Visão Geral:

| Tipo | Nível | Gatilho |
|------|-------|---------|
| `reabertura_aumento` | 🟡 atenção | Taxa de reabertura acima de 15% no período. |
| `retrabalho_acima_meta` | 🟡 atenção | Taxa de retrabalho acima de 10%. |
| `fcr_abaixo_meta` | 🟡 atenção | FCR abaixo de 60%. |
| `problema_recorrente_sistemico` | 🔴 crítico | Mesmo problema afeta 3+ clientes diferentes. |

---

## 3. Qualidade Operacional

Endpoint: `GET /api/helpdesk/qualidade?dias=7|30|90`. Página: `/app/helpdesk/qualidade`.

### 3.1 Indicadores

| Indicador | Sigla | Meta | Classificação |
|-----------|-------|------|---------------|
| **Reaberturas** | FQR | ≤ 5% | 🟢 ≤5% / 🟡 5–15% / 🔴 >15% |
| **Recorrência** | FR | ≤ 10% | 🟢 ≤10% / 🟡 10–25% / 🔴 >25% |
| **Retrabalho** | RR | ≤ 5% | 🟢 ≤5% / 🟡 5–10% / 🔴 >10% |
| **FCR** | FCR | ≥ 60% | 🟢 ≥70% / 🟡 60–70% / 🔴 <60% |

### 3.2 Endpoints

| Rota | Descrição |
|------|-----------|
| `GET /api/helpdesk/qualidade` | Resumo completo (4 cards + alertas + sugestões + recorrência + retrabalho) |
| `GET /api/helpdesk/qualidade/reaberturas` | Detalhe de chamados reabertos |
| `GET /api/helpdesk/qualidade/recorrencia` | Detalhe de problemas recorrentes (filtro `?problema=`) |
| `GET /api/helpdesk/qualidade/retrabalho` | Detalhe de casos de retrabalho |
| `GET /api/helpdesk/qualidade/diagnostico/:tipo` | Diagnóstico IA (reabertura/recorrencia/retrabalho/fcr) |
| `GET /api/helpdesk/qualidade/cliente/:clientId` | Qualidade por cliente específico |

### 3.3 Sugestões de Melhoria

O sistema gera sugestões automáticas categorizadas:

| Categoria | Prioridade | Exemplo |
|-----------|------------|---------|
| `treinamento` | alta/média/baixa | "Necessário treinamento sobre [assunto] — [N] analistas afetados" |
| `desenvolvimento` | alta/média/baixa | "Correção necessária no sistema para [problema]" |
| `base_conhecimento` | alta/média/baixa | "Criar artigo sobre [assunto] — [N] chamados repetidos" |
| `processo` | alta/média/baixa | "Revisar processo de [etapa] — [N] ocorrências" |
| `automacao` | alta/média/baixa | "Automatizar [ação] — [N] casos manuais" |
| `gestao` | alta/média/baixa | "Revisar设计ção de [recurso] — [N] problemas" |

### 3.4 Diagnóstico IA

O diagnóstico IA (`getDiagnosticoIa`) analisa os dados do período e retorna:
- **Dados analisados**: métricas base do cálculo
- **Evidências**: trechos de tickets que justificam a conclusão
- **Conclusão**: resumo em linguagem natural
- **Recomendação**: ação sugerida
- **Fonte**: Claude API ou fallback local determinístico
- **Confiança**: percentual de confiança na análise

Ordem de exibição por severidade: `critico` → `atencao` → `info`.

---

## 3. Visão Geral (`Dashboard`)

Página `/app` (Dashboard). Consome `GET /api/analytics/executivo?dias=` (período funcional 7/30/90).

### Seções

1. **Saúde do atendimento** — 5 indicadores interpretados em linguagem simples:
   - Cumprimento de SLA (meta ≥ 95%)
   - Taxa de resolução (meta ≥ 80%)
   - TMR (meta ≤ 360 min)
   - CSAT (meta ≥ 4.0)
   - Resolução no 1º contato / FCR (meta ≥ 60%)
   
   Cada card exibe **valor + meta + recomendação** e muda de cor conforme o status (verde/âmbar/vermelho).

2. **Alertas e Atenção** — cards clicáveis por nível de severidade com título, mensagem, contagem e **sugestão de ação** (`acao`). Quando o alerta tem `link`, clicar leva direto ao chamado/página.

3. **KPIs + gráficos** — indicadores mensais, tendência, status, prioridade, canal, departamento, desempenho por funcionário, CSAT e resolução por IA.

> A interpretação de indicadores fica em `interpretarIndicadores(resumo)` no `Dashboard.tsx` — client-side e sem dependência de backend extra.

---

## 4. API Pública

Para integração externa (CRM, ERP), consulte `docs/API-INTEGRACAO-EXTERNA.md`.

---

## 5. Testes relacionados

| Arquivo | Cobre |
|---------|-------|
| `backend/src/__tests__/alertas-operacionais.test.ts` | Motor de alertas operacionais (12 testes). |
| `backend/src/__tests__/alertas-visao-geral.test.ts` | Orquestrador de alertas da Visão Geral (7 testes). |
| `backend/src/__tests__/public-api.test.ts` | API pública `/api/integration` (14 testes). |
| `backend/src/__tests__/auditoria-decisao-tarefa.test.ts` | Criação de tarefa kanban a partir de recomendação (3 testes). |