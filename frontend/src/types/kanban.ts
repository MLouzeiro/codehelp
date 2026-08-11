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
