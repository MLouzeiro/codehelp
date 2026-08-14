// ─── User & Auth ────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendedor' | 'gerente' | 'comercial' | 'tecnico' | 'solicitante' | 'agente' | 'supervisor';
  isMaster?: boolean;
  phone?: string;
  active?: boolean;
  online?: boolean;
  lastSeenAt?: string;
  avatar?: string;
  departamentos?: Departamento[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  sessionToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ─── CRM ────────────────────────────────────────────────
export interface CrmClient {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpjCpf?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
  status?: string;
  origem?: string;
  tipoContrato?: string;
  valorMensalidade?: number;
  diaVencimento?: number;
  dataInicioContrato?: string;
  dataFimContrato?: string;
  responsavelTecnico?: string;
  sellerId?: string;
  seller?: User;
  createdAt: string;
  updatedAt: string;
  _count?: { tickets: number; opportunities: number; contacts: number; serviceOrders: number };
  tickets?: HelpdeskTicket[];
  opportunities?: Opportunity[];
  contacts?: Contact[];
  serviceOrders?: ServiceOrder[];
  colaboradores?: Colaborador[];
}

export interface Contact {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  cargo?: string;
  principal?: boolean;
  clientId?: string;
}

export interface Colaborador {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  principal?: boolean;
}

// ─── Pipeline ───────────────────────────────────────────
export interface Opportunity {
  id: string;
  titulo: string;
  valor?: number;
  etapa: string;
  probability?: number;
  expectedCloseDate?: string;
  notes?: string;
  clientId?: string;
  client?: CrmClient;
  assigneeId?: string;
  assignee?: User;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  slug: string;
  title: string;
  color: string;
  items: Opportunity[];
  total: number;
}

// ─── Helpdesk ───────────────────────────────────────────
export type EtapaSlug = 'fila' | 'triagem' | 'em_atendimento' | 'aguardando_cliente' | 'aguardando_os' | 'concluido';

export type StatusSlug = 'aberto' | 'em_atendimento' | 'pendente' | 'escalonado' | 'resolvido' | 'fechado' | 'cancelado';

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
  nivelSuporteId?: string;
  nivel?: NivelSuporte;
  dataAbertura: string;
  dataInicioAtendimento?: string;
  dataFechamento?: string;
  updatedAt?: string;
  lastMessage?: { content?: string; fromMe?: boolean; createdAt?: string } | null;
  _count?: { messages: number; orders: number };
  emAtendimentoDesde?: string;
  tempoDecorridoMin?: number;
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

export interface TicketDetail {
  ticket: HelpdeskTicket & {
    messages: TicketMessage[];
    orders: ServiceOrder[];
  };
  history: TicketHistory[];
}

export interface TicketMessage {
  id: string;
  content: string;
  fromMe: boolean;
  senderName?: string;
  senderId?: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface TicketHistory {
  id: string;
  action: string;
  from?: string;
  to?: string;
  userId?: string;
  usuario?: { id: string; name: string };
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  mimetype: string;
  size: number;
}

// ─── Departamentos, Filas, Niveis ──────────────────────
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
}

// ─── Orders / OS ───────────────────────────────────────
export interface ServiceOrder {
  id: string;
  numeroOs: string;
  clientId: string;
  client?: CrmClient;
  tipoServico: string;
  descricaoServico?: string;
  sistemasEnvolvidos: string[];
  equipamentos?: string;
  tecnicoResponsavelId: string;
  tecnicoResponsavel?: { id: string; name: string; email?: string };
  valorServico?: number;
  dataEmissao: string;
  dataPrevistaEntrega?: string;
  status: string;
  ticketId?: string;
  ticket?: HelpdeskTicket;
  criadoPor?: { name: string };
  observacoes?: string;
  horasDev?: number;
  horasSuporte?: number;
  implantacaoConcluida?: boolean;
  precoImplantacao?: number;
  tipoImplantacao?: string;
  dataInicioImplantacao?: string;
  dataFimImplantacao?: string;
  signature?: OrderSignature;
  attachments?: OrderAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderSignature {
  id: string;
  serviceOrderId: string;
  assinanteNome: string;
  assinanteCpf?: string;
  assinanteCargo?: string;
  assinaturaBase64?: string;
  token: string;
  expiresAt: string;
  signedAt?: string;
  pdfPath?: string;
  ipAssinatura?: string;
  empresaAssinatura?: string;
  createdAt: string;
}

export interface OrderAttachment {
  id: string;
  serviceOrderId: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  createdAt: string;
}

export type OrderStatus = 'rascunho' | 'aguardando_assinatura' | 'assinada' | 'em_execucao' | 'concluida' | 'cancelada';

// ─── Notifications ─────────────────────────────────────
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

// ─── Approvals ─────────────────────────────────────────
export interface Aprovacao {
  id: string;
  ticketId: string;
  tipo: string;
  motivo: string;
  observacao?: string;
  status: string;
  valorAprovado?: number;
  dataSolicitacao: string;
  dataDecisao?: string;
  solicitadoPor: { id: string; name: string; email: string };
  aprovadoPor?: { id: string; name: string; email: string };
  ticket: { id: string; protocolo?: string; assunto?: string; status: string };
}

// ─── Dashboard ─────────────────────────────────────────
export interface DashboardKpis {
  totalTickets: number;
  ticketsAbertos: number;
  ticketsEmAtendimento: number;
  ticketsResolvidos: number;
  slaVencidos: number;
  clientesOnline: number;
  csatMedio: number;
  tempoMedioResposta: number;
}

export interface DashboardMetrics {
  periodo: { inicio: string; fim: string };
  backlog: {
    total: number;
    porEtapa: Record<string, number>;
    porPrioridade: Record<string, number>;
    porFila: Record<string, number>;
  };
  mttr: { mediaMinutos: number; medianaMinutos: number; p95Minutos: number };
  mtfa: { mediaMinutos: number };
  sla: { compliancePercentual: number; violados: number; noPrazo: number; total: number };
  fcr: { percentual: number; primeiraResolucao: number; escalonados: number };
  csat: { mediaNotas: number; totalRespostas: number; percentualResposta: number };
  porAgente: Array<{
    usuarioId: string; nome: string; ticketsAtendidos: number;
    mttrMedioMin: number; csatMedio: number | null;
  }>;
  porCategoria: Array<{ categoria: string; total: number; percentual: number }>;
}

// ─── Knowledge Base ────────────────────────────────────
export interface KBArticle {
  id: string;
  slug: string;
  titulo: string;
  conteudo: string;
  resumo?: string | null;
  tags: string;
  publicado: boolean;
  visualizacoes: number;
  util: number;
  inutil: number;
  createdAt: string;
}

// ─── Permissions ───────────────────────────────────────
export type PermissionMap = Record<string, Record<string, boolean>>;

// ─── Ticket Position (queue) ───────────────────────────
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
