export interface KanbanBoard {
  id: string;
  nome: string;
  descricao?: string | null;
  icone?: string | null;
  cor?: string | null;
  criadorId?: string | null;
  criador?: { id: string; name: string } | null;
  ativo: boolean;
  ordem: number;
  templateId?: string | null;
  columns: KanbanColumn[];
  tags?: KanbanTag[];
  columnCount?: number;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  boardId: string;
  nome: string;
  cor?: string | null;
  icone?: string | null;
  ordem: number;
  wipLimit?: number | null;
  hidden: boolean;
  tasks: KanbanTask[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanTask {
  id: string;
  numero: number;
  titulo: string;
  descricao?: string | null;
  columnId: string;
  boardId: string;
  responsavelId?: string | null;
  responsavel?: { id: string; name: string; email?: string } | null;
  clientId?: string | null;
  client?: { id: string; razaoSocial: string; nomeFantasia?: string | null } | null;
  ticketId?: string | null;
  ticket?: { id: string; protocolo?: string | null; assunto?: string | null; status?: string; etapa?: string } | null;
  orderId?: string | null;
  order?: { id: string; numeroOs: string; status: string; tipoServico: string } | null;
  departamentoId?: string | null;
  departamento?: { id: string; nome: string; slug?: string } | null;
  equipeId?: string | null;
  equipe?: { id: string; nome: string } | null;
  tipoTarefa?: string | null;
  statusPrazo?: string | null;
  prioridade: string;
  categoria?: string | null;
  classificacao?: string | null;
  dataInicio?: string | null;
  prazoEntrega?: string | null;
  dataConclusao?: string | null;
  estimativaHoras?: number | null;
  horasTrabalhadas?: number | null;
  ordem: number;
  ativo: boolean;
  arquivado?: boolean;
  arquivadoEm?: string | null;
  arquivadoPorId?: string | null;
  arquivadoPor?: { id: string; name: string } | null;
  restauradoEm?: string | null;
  reabertoEm?: string | null;
  reabertoMotivo?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deleteReason?: string | null;
  tags?: KanbanTaskTag[];
  subtasks?: KanbanSubtask[];
  attachments?: KanbanAttachment[];
  activities?: { createdAt: string }[];
  lastActivityAt?: string | null;
  _count?: { subtasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface KanbanTaskDetail extends KanbanTask {
  activities?: KanbanActivity[];
  attachments?: KanbanAttachment[];
  column?: KanbanColumn;
  stageTimes?: KanbanStageTime[];
  prazo?: PrazoInfo | null;
  timeSummary?: TaskTimeSummary | null;
}

export interface PrazoInfo {
  status: 'no_prazo' | 'proxima' | 'atencao' | 'atrasada' | 'concluida';
  restanteMs: number;
  excedidoMs: number;
  restanteLabel: string;
  excedidoLabel: string;
  percentualConsumido: number;
}

export interface KanbanStageTime {
  id: string;
  taskId: string;
  columnId?: string | null;
  columnNome: string;
  dataEntrada: string;
  dataSaida?: string | null;
  duracaoMin?: number | null;
  usuarioId?: string | null;
}

export interface TaskTimeSummary {
  totalMin: number;
  pausasMin: number;
  totalHoras: number;
  porTipo: Record<string, number>;
  porEtapa: { id: string; etapa: string; dataEntrada: string; dataSaida?: string | null; duracaoMin: number; emAndamento: boolean }[];
  blocos: { id: string; tipo: string; usuario?: { id: string; name: string } | null; observacao?: string | null; createdAt: string }[];
  desenvolvimentoMin: number;
  implantacaoMin: number;
  atendimentoMin: number;
  outroMin: number;
}

export interface TaskAlert {
  id: string;
  taskId: string;
  tipo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
  task?: { id: string; numero: number; titulo: string };
}

export interface Team {
  id: string;
  nome: string;
  descricao?: string | null;
  departamentoId?: string | null;
  departamento?: { id: string; nome: string } | null;
  liderId?: string | null;
  lider?: { id: string; name: string; email?: string } | null;
  ativo: boolean;
  membros: { id: string; userId: string; user: { id: string; name: string; email?: string; role?: string } }[];
  _count?: { membros: number; kanbanTasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface KanbanSubtask {
  id: string;
  taskId: string;
  titulo: string;
  concluida: boolean;
  ordem: number;
  responsavelId?: string | null;
  responsavel?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanTag {
  id: string;
  nome: string;
  cor: string;
  boardId?: string | null;
  createdAt?: string;
}

export interface KanbanTaskTag {
  id: string;
  taskId: string;
  tagId: string;
  tag: KanbanTag;
}

export interface KanbanActivity {
  id: string;
  taskId: string;
  usuarioId?: string | null;
  usuario?: { id: string; name: string; email?: string } | null;
  tipo: string;
  descricao: string;
  deColuna?: string | null;
  paraColuna?: string | null;
  dados?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  origem?: string | null;
  motivo?: string | null;
  metadata?: string | null;
  visivelCliente: boolean;
  createdAt: string;
}

export interface KanbanAttachment {
  id: string;
  taskId: string;
  nomeArquivo: string;
  url: string;
  tipoMime?: string | null;
  tamanho?: number | null;
  privado: boolean;
  usuarioId?: string | null;
  usuario?: { id: string; name: string } | null;
  createdAt: string;
}

export interface KanbanTemplate {
  id: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  icone?: string | null;
  colunas: string;
  tagsPadrao?: string | null;
  publico: boolean;
  criadorId?: string | null;
  createdAt: string;
}

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export const PRIORIDADES: { value: Prioridade; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: '#6b7280' },
  { value: 'media', label: 'Média', color: '#3b82f6' },
  { value: 'alta', label: 'Alta', color: '#f59e0b' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
];

export const CATEGORIAS = [
  'Outros', 'Suporte', 'Desenvolvimento', 'Marketing', 'Financeiro',
  'Comercial', 'Infraestrutura', 'RH', 'Administrativo',
];

export interface AuditLog {
  id: string;
  usuarioId?: string | null;
  usuario?: { id: string; name: string; email?: string; role?: string } | null;
  modulo?: string | null;
  entidade: string;
  entidadeId?: string | null;
  acao: string;
  descricao?: string | null;
  detalhes?: string | null;
  valorAnterior?: string | null;
  novoValor?: string | null;
  motivo?: string | null;
  origem?: string | null;
  resultado?: string | null;
  metadata?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  severity?: string | null;
  clienteId?: string | null;
  success?: boolean | null;
  errorMessage?: string | null;
  requestId?: string | null;
  fonte?: string | null;
  entidadeRelacionada?: string | null;
  entidadeRelacionadaId?: string | null;
  createdAt: string;
}

export interface TaskDashboardData {
  totalTarefas: number;
  concluidas: number;
  atrasadas: number;
  emAndamento: number;
  semPrazo: number;
  comPrazoProximo: number;
  taxaConclusao: number;
  estimadoHoras: number;
  trabalhadoHoras: number;
  porPrioridade: { prioridade: string; total: number }[];
  porStatusPrazo: { status: string; total: number }[];
  porTipo: { tipo: string; total: number }[];
  porResponsavel: { usuario: string; total: number; horas: number; estimativa: number }[];
  porEquipe: { equipe: string; total: number; horas: number }[];
  porCliente: { cliente: string; total: number; horas: number }[];
  porTicket: { ticket: string; total: number; horas: number }[];
}

export interface AuditDashboardStats {
  totalEventos: number;
  totalAnterior: number;
  deltaTotal: number;
  eventosHoje: number;
  eventos7dias: number;
  eventos30dias: number;
  acoesCriticas: number;
  usuariosMaisAtivos: { usuario: string; total: number }[];
  topAcoes: { acao: string; total: number }[];
  falhasAuth: number;
  deltaFalhasAuth: number;
  tentativasBloqueadas: number;
  deltaBloqueadas: number;
  logins: number;
  deltaLogins: number;
  alteracoesPermissao: number;
  deltaPermissoes: number;
  exclusoes: number;
  deltaExclusoes: number;
  acoesApi: number;
  deltaApi: number;
  acoesAutomaticas: number;
  acoesIa: number;
  eventosSuspeitos: number;
  eventosCriticos: number;
  eventosMedios: number;
  eventosBaixa: number;
  acoesViaApi: number;
}

export interface AuditSecurityStats {
  tentativasLogin: number;
  deltaTentativas: number;
  loginsSucesso: number;
  deltaSucesso: number;
  loginsRecusados: number;
  deltaRecusados: number;
  falhasConsecutivas: number;
  acessoNegadoModulos: number;
  acessoNegadoRegistros: number;
  alteracoesSenha: number;
  alteracoesPermissoes: number;
  deltaPermissoes: number;
  criacaoUsuarios: number;
  exclusaoUsuarios: number;
  usuariosDesativados: number;
  sessoesEncerradas: number;
  tentativasBloqueadas: number;
  deltaBloqueadas: number;
  eventosCriticos: number;
  deltaCriticos: number;
  acoesApi: number;
  ipsMultiplos: number;
}

export interface AuditAlert {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  severidade: string;
  modulo?: string | null;
  usuarioId?: string | null;
  clienteId?: string | null;
  entidade?: string | null;
  entidadeId?: string | null;
  metadata?: string | null;
  status: string;
  analisadoPor?: string | null;
  analisadoEm?: string | null;
  justificativa?: string | null;
  arquivadoEm?: string | null;
  createdAt: string;
}

export interface AuditAnomalia {
  tipo: string;
  titulo: string;
  descricao: string;
  severidade: string;
  usuarioId?: string;
  dataHora: string;
  modulo?: string;
  motivo: string;
  acaoRecomendada: string;
}

export const STATUS_PRAZO_LABEL: Record<string, { label: string; cor: string; emoji: string }> = {
  no_prazo: { label: 'No prazo', cor: '#22c55e', emoji: '🟢' },
  proxima: { label: 'Próxima', cor: '#eab308', emoji: '🟡' },
  atencao: { label: 'Atenção', cor: '#f97316', emoji: '🟠' },
  atrasada: { label: 'Atrasada', cor: '#ef4444', emoji: '🔴' },
  concluida: { label: 'Concluída', cor: '#3b82f6', emoji: '⚫' },
};

export const TIPOS_TAREFA = [
  { value: 'dev', label: 'Desenvolvimento', icon: '💻' },
  { value: 'implantacao', label: 'Implantação', icon: '🚀' },
  { value: 'atendimento', label: 'Atendimento', icon: '🎧' },
  { value: 'outro', label: 'Outro', icon: '📋' },
];
