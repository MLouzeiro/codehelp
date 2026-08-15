// ── Constantes centrais do Helpdesk ─────────────────────────────────────
// Fonte única para status, etapas e estados de encerramento/avaliação.
// FASE 2 da refatoração: substituir literais espalhados (flow.service,
// weeklyReport.service, csat.service, metrics.service, etc.).

// ── Estados finais / inativos do ticket — nunca reabrir por nova mensagem ──
export const STATUS_ENCERRADO: readonly string[] = ['fechado', 'cancelado', 'arquivado'];
export const ETAPAS_ENCERRADAS: readonly string[] = ['concluido', 'descartado'];

// Definição de "fechado/resolvido" usada na resolução de tickets
// (avaliação CSAT, encerramento por status). Inclui 'resolvido'.
export const STATUS_FECHADO_CSAT: readonly string[] = ['fechado', 'cancelado', 'resolvido'];

// WHERE Prisma para tickets encerrados conforme a definição CSAT
// (status fechado/cancelado/resolvido OU etapa concluido/descartado).
export const WHERE_TICKET_ENCERRADO_CSAT = {
  OR: [
    { status: { in: [...STATUS_FECHADO_CSAT] } },
    { etapa: { in: [...ETAPAS_ENCERRADAS] } },
  ],
};

// WHERE Prisma para tickets considerados "resolvidos" em relatórios
// (status 'fechado' OU etapa 'concluido' — definição usada no relatório semanal).
export const WHERE_TICKET_RESOLVIDO = {
  OR: [{ status: 'fechado' }, { etapa: 'concluido' }],
};

// Status considerados "abertos/ativos" (para backlog e pendentes).
export const STATUS_ABERTO: readonly string[] = ['aberto', 'em_atendimento', 'pendente'];

// ── Etapas fixas do pipeline (não reordenar — regra do projeto) ─────────
export const ETAPAS_FIXAS: readonly string[] = [
  'fila',
  'triagem',
  'em_atendimento',
  'aguardando_cliente',
  'aguardando_os',
  'concluido',
];

// ── Estados de avaliação (evaluationStatus) ─────────────────────────────
export const EVALUATION_AGUARDANDO = 'aguardando';
export const EVALUATION_RESPONDIDA = 'respondido';
export const EVALUATION_CANCELADA = 'cancelado';

// ── Estados do fluxo de confirmação de resolução (evaluationStatus) ─────
// Após encerrar, o bot pergunta "Seu problema foi resolvido?" antes do CSAT:
//   aguardando_confirmacao → aguardando SIM/NÃO do cliente
//   aguardando_descricao   → aguardando descrição do problema (após NÃO)
// O resultado "sem resolução" é persistido em Ticket.motivoStatus
// ('encerrado_sem_resolucao') + resumoFinal (descrição do cliente).
export const EVALUATION_AGUARDANDO_CONFIRMACAO = 'aguardando_confirmacao';
export const EVALUATION_AGUARDANDO_DESCRICAO = 'aguardando_descricao';

// Motivo persistido quando o cliente diz NÃO na confirmação de resolução.
export const MOTIVO_ENCERRADO_SEM_RESOLUCAO = 'encerrado_sem_resolucao';

// Palavras-chave aceitas para SIM/NÃO na confirmação de resolução.
export const RESOLUCAO_SIM_KEYWORDS = ['sim', 'yes', '1'];
export const RESOLUCAO_NAO_KEYWORDS = ['nao', 'não', 'no', '2'];

export const EVALUATION_STATES = [
  EVALUATION_AGUARDANDO,
  EVALUATION_RESPONDIDA,
  EVALUATION_CANCELADA,
  EVALUATION_AGUARDANDO_CONFIRMACAO,
  EVALUATION_AGUARDANDO_DESCRICAO,
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATES)[number] | null;

// ── Tipos de tarefa interna / registro de horas ─────────────────────────
// Centraliza os tipos de atividade usados em TimeEntry e nas tarefas
// internas do ticket (demandas de desenvolvimento/implantação/outro setor).
export const TIPO_ATIVIDADE = {
  SUPORTE: 'suporte',
  DESENVOLVIMENTO: 'dev',
  IMPLANTACAO: 'implantacao',
  OUTRO_SETOR: 'outro_setor',
  TREINAMENTO: 'treinamento',
  REUNIAO: 'reuniao',
  OUTRO: 'outro',
} as const;

export type TipoAtividade = (typeof TIPO_ATIVIDADE)[keyof typeof TIPO_ATIVIDADE];

// Tipos de TimeEntry (compat com o que já existe no banco/tela de Time Tracking)
export const TIME_ENTRY_TIPOS = Object.values(TIPO_ATIVIDADE);

// ── Tipos de tarefa no kanban interno (coluna/tipo de demanda) ─────────
export const TAREFA_TIPO = {
  DESENVOLVIMENTO: 'Desenvolvimento',
  IMPLANTACAO: 'Implantação',
  OUTRO_SETOR: 'Outro Setor',
} as const;
