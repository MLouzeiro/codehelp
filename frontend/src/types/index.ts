export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendedor' | 'gerente' | 'comercial' | 'tecnico';
  phone?: string;
  active?: boolean;
  online?: boolean;
  lastSeenAt?: string;
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
  etapa: EtapaSlug;
  prioridade: string;
  status: string;
  client?: { id: string; razaoSocial?: string; nomeFantasia?: string; telefone?: string } | null;
  assignee?: { id: string; name: string; email: string } | null;
  dataAbertura: string;
  dataInicioAtendimento?: string;
  dataFechamento?: string;
  updatedAt?: string;
  lastMessage?: { content?: string; fromMe?: boolean; createdAt?: string } | null;
  _count?: { messages: number; orders: number };
  emAtendimentoDesde?: string;
  tempoDecorridoMin?: number;
}

export type StatusSlug =
  | 'aberto'
  | 'em_andamento'
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
  }>;
}
