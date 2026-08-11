export interface Departamento {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  _count?: { tickets: number; usuarios: number; filas: number };
}

export interface NivelSuporte {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  slaMinutos?: number;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  _count?: { tickets: number; filas: number };
}

export interface Fila {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  nivel: string;
  slaMinutos: number;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  departamentoId?: string;
  departamento?: Departamento;
  nivelSuporteId?: string;
  nivelSuporte?: NivelSuporte;
  _count?: { tickets: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendedor' | 'gerente' | 'comercial' | 'tecnico';
  isMaster?: boolean;
  phone?: string;
  signature?: string;
  active?: boolean;
  online?: boolean;
  lastSeenAt?: string;
  departamentos?: Departamento[];
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  sellerId: string;
  seller?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada';
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  order?: number;
  project?: string;
  dueDate?: string;
  assigneeId?: string;
  assignee?: User;
  createdAt: string;
  updatedAt: string;
}

export interface TicketChecklist {
  id: string;
  ticketId: string;
  titulo: string;
  concluida: boolean;
  ordem: number;
  responsavelId?: string;
  responsavel?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  items: string; // JSON string: [{titulo, ordem}]
  publico: boolean;
  criadorId: string;
  criador?: { id: string; name: string };
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface DashboardData {
  totalClients: number;
  pendingTasks: number;
  completedTasks: number;
  tasksByStatus: { status: string; count: number }[];
  tasksByPeriod: { month: string; count: string }[];
}

export type EtapaSlug =
  | 'fila'
  | 'triagem'
  | 'boas_vindas'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'aguardando_os'
  | 'concluido';

export interface HelpdeskEtapa {
  id: string;
  slug: EtapaSlug;
  nome: string;
  descricao?: string;
  cor: string;
  icone: string;
  ordem: number;
  enviarAuto: boolean;
  notificarEquipe: boolean;
  autoMessage?: string;
  ativo: boolean;
}

export interface HelpdeskTicket {
  id: string;
  protocolo?: string;
  contactName?: string;
  contactPhone?: string;
  assunto?: string;
  categoria?: string;
  tipo?: string;
  observacoes?: string;
  etapa: EtapaSlug;
  prioridade: string;
  status: string;
  client?: { id: string; razaoSocial?: string; nomeFantasia?: string; telefone?: string } | null;
  assignee?: { id: string; name: string; email: string } | null;
  departamentoId?: string;
  departamento?: Departamento;
  channelId?: string;
  channel?: { id: string; nome: string; tipo: string; slug: string; cor: string; avatar?: string } | null;
  nivelSuporteId?: string;
  nivel?: NivelSuporte;
  dataAbertura: string;
  dataInicioAtendimento?: string;
  dataFechamento?: string;
  updatedAt?: string;
  lastMessage?: { content?: string; fromMe?: boolean; createdAt?: string } | null;
  _count?: { messages: number; orders: number; checklists?: number };
  emAtendimentoDesde?: string;
  tempoDecorridoMin?: number;
  // ── IA ──
  resolvidoPorIa?: boolean;
  iaClassificacao?: string;
  iaResumoProblema?: string;
  iaSugestaoResposta?: string;
  iaNotaEncerramento?: string;
  iaAvaliacaoQualidade?: string;
  iaMensagensEnviadas?: number;
  prazoEntrega?: string;
  semPrazo?: boolean;
  horasDesenvolvimento?: number;
  dataInicioImplantacao?: string;
  dataFimImplantacao?: string;
  checklists?: TicketChecklist[];
}

export type StatusSlug =
  | 'aberto'
  | 'em_atendimento'
  | 'pendente'
  | 'escalonado'
  | 'resolvido'
  | 'fechado'
  | 'cancelado';

export interface StatusColumn {
  slug: StatusSlug;
  title: string;
  cor: string;
  icone: string;
  items: HelpdeskTicket[];
  total: number;
}

export interface Notificacao {
  id: string;
  tipo: string;
  mensagem: string;
  destinatarioId: string;
  ticketId?: string | null;
  dados?: string | null;
  lida: boolean;
  createdAt: string;
}

export interface NotificacoesResponse {
  items: Notificacao[];
  total: number;
  naoLidas: number;
}

export interface StatusBoardData {
  board: Record<StatusSlug, StatusColumn>;
  colunas: Array<{ slug: StatusSlug; titulo: string; cor: string; icone: string }>;
}

export interface HelpdeskKanbanData {
  board: Record<EtapaSlug, {
    id: string;
    slug: EtapaSlug;
    title: string;
    descricao?: string;
    cor: string;
    icone: string;
    enviarAuto: boolean;
    items: HelpdeskTicket[];
    total: number;
  }>;
  etapas: HelpdeskEtapa[];
  contagemEtapas: Record<string, number>;
}

export interface DashboardMetrics {
  periodo: { inicio: string; fim: string };
  backlog: {
    total: number;
    porEtapa: Record<string, number>;
    porPrioridade: Record<string, number>;
    porFila: Record<string, number>;
  };
  mttr: {
    mediaMinutos: number;
    medianaMinutos: number;
    p95Minutos: number;
  };
  mtfa: {
    mediaMinutos: number;
  };
  sla: {
    compliancePercentual: number;
    violados: number;
    noPrazo: number;
    total: number;
  };
  fcr: {
    percentual: number;
    primeiraResolucao: number;
    escalonados: number;
  };
  csat: {
    mediaNotas: number;
    totalRespostas: number;
    percentualResposta: number;
  };
  porAgente: Array<{
    usuarioId: string;
    nome: string;
    ticketsAtendidos: number;
    mttrMedioMin: number;
    csatMedio: number | null;
  }>;
  porCategoria: Array<{
    categoria: string;
    total: number;
    percentual: number;
  }>;
}

export interface KBCategoriaRef {
  id: string;
  nome: string;
  slug?: string;
  cor?: string;
  icone?: string;
}

export interface KBAutorRef {
  id: string;
  name: string;
}

export interface KBArticle {
  id: string;
  slug: string;
  titulo: string;
  conteudo: string;
  resumo?: string | null;
  categoriaId?: string | null;
  categoria?: KBCategoriaRef | null;
  tags: string;
  autorId?: string | null;
  autor?: KBAutorRef | null;
  visualizacoes: number;
  util: number;
  inutil: number;
  publicado: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface KBListResponse {
  items: KBArticle[];
  total: number;
}

export type AutomationTrigger = 'novo_ticket' | 'msg_recebida' | 'status_alterado' | 'sla_alerta' | 'csat_recebido';
export type AutomationAction = 'definir_categoria' | 'definir_prioridade' | 'atribuir_usuario' | 'mudar_etapa' | 'enviar_msg' | 'escalar_fila' | 'notificar' | 'adicionar_tag';
export type AutomationOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';

export interface AutomationCondition {
  campo: string;
  operador: AutomationOperator;
  valor: any;
}

export interface AutomationActionStep {
  tipo: AutomationAction;
  parametros: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  nome: string;
  descricao?: string | null;
  trigger: AutomationTrigger;
  condicoes: AutomationCondition[];
  acoes: AutomationActionStep[];
  logicOperator: 'all' | 'any';
  ativo: boolean;
  ordem: number;
  autorId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HelpdeskDashboardData {
  atualizadoEm: string;
  etapas: (HelpdeskEtapa & { total: number })[];
  contagemEtapas: Record<string, number>;
  emAtendimento: Array<{
    id: string;
    protocolo?: string;
    contactName?: string;
    cliente?: string;
    assignee?: { id: string; name: string; email: string } | null;
    emAtendimentoDesde?: string;
    tempoDecorridoMin: number;
  }>;
  filaEspera: number;
  concluidosHoje: number;
  totalAbertos: number;
  tempoMedioAtendimentoMin: number;
  ultimosMovimentos: Array<{
    id: string;
    etapaAnterior?: string;
    etapaNova: string;
    origem: string;
    createdAt: string;
    usuario?: { id: string; name: string } | null;
    ticket: { id: string; protocolo?: string; contactName?: string; contactPhone?: string; client?: { razaoSocial?: string } | null };
  }>;
  agentes: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    online: boolean;
    lastSeenAt?: string;
    emAtendimento: number;
    tickets: Array<{
      id: string;
      protocolo?: string;
      assunto?: string;
      contactName?: string;
      cliente?: string;
      etapa: string;
      prioridade: string;
      categoria?: string;
      dataAbertura: string;
      tempoDecorridoMin: number;
    }>;
  }>;
}

export interface AuditStats {
  periodo: { inicio: string; fim: string };
  totalAcoes: number;
  porAcao: Array<{ acao: string; total: number; percentual: number }>;
  porEntidade: Array<{ entidade: string; total: number; percentual: number }>;
  porUsuario: Array<{ usuarioId: string; nome: string; total: number }>;
  porDia: Array<{ data: string; total: number }>;
  topEntidades: Array<{ entidade: string; entidadeId: string; total: number }>;
}

export interface TicketPosition {
  ticketId: string;
  protocolo?: string;
  etapa: string;
  prioridade?: string;
  posicao: number;
  totalNaFila: number;
  tempoEstimadoMin: number;
  slaMinutos: number;
}

// ── WhatsApp Connections ───────────────────────────────────────────────
export interface WhatsAppConnection {
  id: string;
  nome: string;
  numero: string;
  slug: string;
  provider?: string;
  departamentoId?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  departamento?: {
    id: string;
    nome: string;
    slug: string;
    cor: string;
  };
  _count?: {
    tickets: number;
  };
}

export interface WhatsAppConnectionStatus {
  id: string;
  nome: string;
  numero: string;
  departamentoId?: string;
  connected: boolean;
  scanning: boolean;
  state: string;
  error: string | null;
  lastMessageAt: string | null;
  lastHeartbeat: number;
  qrCode: string | null;
}

// ── Multi-Channel ─────────────────────────────────────────────────────
export interface Channel {
  id: string;
  nome: string;
  tipo: string;
  slug: string;
  provider?: string;
  config?: string;
  departamentoId?: string;
  avatar?: string;
  cor?: string;
  metadata?: string;
  ativo: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  departamento?: {
    id: string;
    nome: string;
    slug: string;
    cor: string;
  };
  _count?: {
    tickets: number;
    channelMessages: number;
  };
  riskLogs?: ChannelRiskLog[];
}

export interface ChannelType {
  tipo: string;
  label: string;
  icon: string;
  color: string;
  providers: string[];
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  ticketId?: string;
  externalId?: string;
  fromMe: boolean;
  contactName?: string;
  contactId?: string;
  content?: string;
  mediaUrl?: string;
  mimeType?: string;
  status?: string;
  rawPayload?: string;
  createdAt: string;
}

export interface ChannelRiskLog {
  id: string;
  channelId: string;
  tipo: string;
  severidade: string;
  mensagem: string;
  resolvido: boolean;
  resolvidoEm?: string;
  createdAt: string;
}

export interface ChannelStats {
  totalTickets: number;
  openTickets: number;
  totalMessages: number;
  messagesLast24h: number;
}

// ── IA Ticket Types ────────────────────────────────────────────

export interface TicketAnalytics {
  ticketId: string;
  tempoTotalMin: number;
  tempoPrimeiraRespostaMin: number | null;
  tempoEmAtendimentoMin: number;
  tempoAguardandoClienteMin: number;
  tempoMedioRespostaMin: number;
  distribuicaoMensagens: {
    total: number;
    cliente: number;
    agente: number;
    bot: number;
  };
  resolvidoPorIa: boolean;
  iaMensagensEnviadas: number;
  classificacaoIa: {
    categoria: string;
    prioridade: string;
    confianca: number;
    metodo: string;
  } | null;
  resumoIa: string | null;
  notaEncerramentoIa: string | null;
  avaliacaoIa: {
    notaQualidade: number;
    pontosForts: string[];
    pontosMelhoria: string[];
    resumo: string;
  } | null;
}

export interface AiMetricas {
  periodo: { inicio: string; fim: string };
  totalChamados: number;
  chamadosIaResolveu: number;
  taxaResolucaoIa: number;
  tempoMedioResolucaoIaMin: number;
  tempoMedioResolucaoHumanoMin: number;
  totalCorrecoes: number;
  confiancaMediaClassificacao: number;
  distribuicaoClassificacao: Array<{ categoria: string; total: number }>;
}

export interface AIClassification {
  id: string;
  ticketId: string;
  categoria: string | null;
  prioridade: string | null;
  confianca: number | null;
  metodo: string;
  rawResponse: string | null;
  createdAt: string;
}

export interface AIEvaluation {
  id: string;
  ticketId: string;
  notaQualidade: number;
  pontosForts: string | null;
  pontosMelhoria: string | null;
  resumo: string | null;
  modeloUsado: string | null;
  createdAt: string;
}

export interface AICorrection {
  id: string;
  ticketId: string;
  mensagemOriginal: string;
  tipoErro: string;
  correcao: string;
  corrigidoPor?: { id: string; name: string } | null;
  treinada: boolean;
  createdAt: string;
}

// ── Audit Tables Types ─────────────────────────────────────────

export type TicketEventType =
  | 'created' | 'message_sent' | 'message_received'
  | 'stage_changed' | 'assignee_changed' | 'priority_changed'
  | 'sla_started' | 'sla_paused' | 'sla_resumed' | 'sla_breached' | 'sla_completed'
  | 'ai_classified' | 'ai_responded' | 'ai_evaluated'
  | 'note_added' | 'escalated' | 'merged' | 'reopened' | 'closed';

export interface TicketEvent {
  id: string;
  ticketId: string;
  tipo: TicketEventType;
  descricao?: string;
  dados?: string;
  usuarioId?: string;
  usuario?: { id: string; name: string; avatar?: string };
  isSystem: boolean;
  isAi: boolean;
  mensagemId?: string;
  metadata?: string;
  createdAt: string;
}

export interface TicketTimelineEntry {
  id: string;
  ticketId: string;
  etapa: string;
  dataEntrada: string;
  dataSaida?: string;
  duracaoMinutos?: number;
  duracaoBusinessMin?: number;
  responsavelAnteriorId?: string;
  responsavelAnterior?: { id: string; name: string };
  responsavelNovoId?: string;
  responsavelNovo?: { id: string; name: string };
  motivoMudanca?: string;
  isPaused: boolean;
  pausaTotalMinutos: number;
  createdAt: string;
}

export interface TicketMetrics {
  id: string;
  ticketId: string;
  tempoTotalMin: number;
  tempoPrimeiraRespostaMin?: number;
  tempoPrimeiraRespostaIaMin?: number;
  tempoPrimeiraRespostaHumMin?: number;
  tempoEmAtendimentoMin: number;
  tempoAguardandoClienteMin: number;
  tempoAguardandoTerceiroMin: number;
  tempoFilaMin: number;
  tempoResolucaoIaMin?: number;
  tempoResolucaoHumanoMin?: number;
  tempoLeadTimeMin: number;
  tempoUtilMin: number;
  tempoCorridoMin: number;
  tempoForaExpedienteMin: number;
  tempoParadoMin: number;
  totalMensagens: number;
  mensagensCliente: number;
  mensagensAgente: number;
  mensagensBot: number;
  totalReaberturas: number;
  totalEscalonamentos: number;
  slaPrazoMinutos?: number;
  slaConsumidoMinutos: number;
  slaRestanteMinutos: number;
  slaPercentualConsumido: number;
  slaStatus?: string;
  csatNota?: number;
  csatRespondido: boolean;
  resolvidoPorIa: boolean;
  iaConfiancaMedia?: number;
  iaTotalInteracoes: number;
  iaCustoTotalUsd: number;
  iaCustoTotalBrl: number;
  primeiraRespostaEm?: string;
  ultimoAtendimentoEm?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSlaLog {
  id: string;
  ticketId: string;
  acao: string;
  slaMinutos: number;
  percentual?: number;
  restantesMin?: number;
  motivo?: string;
  dados?: string;
  usuarioId?: string;
  usuario?: { id: string; name: string };
  isSystem: boolean;
  createdAt: string;
}

export interface TicketActivity {
  id: string;
  ticketId: string;
  usuarioId?: string;
  usuario?: { id: string; name: string; avatar?: string };
  tipo: string;
  descricao?: string;
  dados?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface TicketWaitTime {
  id: string;
  ticketId: string;
  etapa: string;
  dataEntrada: string;
  dataSaida?: string;
  duracaoMin?: number;
  motivo?: string;
  usuarioId?: string;
  usuario?: { id: string; name: string };
  createdAt: string;
}

export interface TicketAiLog {
  id: string;
  ticketId: string;
  tipo: string;
  modelo?: string;
  inputTokens?: number;
  outputTokens?: number;
  custoUsd?: number;
  custoBrl?: number;
  latenciaMs?: number;
  confianca?: number;
  resultado?: string;
  correcaoId?: string;
  erro?: string;
  duracaoProcessamentoMs?: number;
  createdAt: string;
}

export interface TicketPerformance {
  id: string;
  periodo: string;
  tipoPeriodo: string;
  usuarioId?: string;
  usuario?: { id: string; name: string };
  departamentoId?: string;
  ticketsRecebidos: number;
  ticketsResolvidos: number;
  ticketsEscalonados: number;
  ticketsReabertos: number;
  ticketsCancelados: number;
  mttrMin: number;
  mttaMin: number;
  mtfaMin: number;
  mtFilaMin: number;
  slaCompliancePct: number;
  slaViolados: number;
  slaNoPrazo: number;
  csatMedio?: number;
  csatTotalRespostas: number;
  fcrPct: number;
  iaResolveu: number;
  iaConfiancaMedia?: number;
  iaCustoTotalUsd: number;
  totalMensagensEnviadas: number;
  totalMensagensRecebidas: number;
  tempoAtivoMinutos: number;
  createdAt: string;
}

export interface TicketReplayData {
  events: TicketEvent[];
  timeline: TicketTimelineEntry[];
  metrics: TicketMetrics | null;
  slaLogs: TicketSlaLog[];
  activities: TicketActivity[];
  waitTimes: TicketWaitTime[];
  aiLogs: TicketAiLog[];
}
