export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendedor';
  phone?: string;
  active: boolean;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  sellerId: string;
  seller?: { id: string; name: string };
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
  assignee?: { id: string; name: string };
  createdAt: string;
}

export interface KanbanColumn {
  title: string;
  items: Task[];
}

export interface KanbanBoard {
  [key: string]: KanbanColumn;
}

export interface KpiData {
  cards: {
    totalClients: number;
    tasksPendentes: number;
    tasksConcluidas: number;
  };
  charts: {
    tasksByStatus: { status: string; _count: number }[];
    tasksPerDay: { date: string; total: number; concluidas: number }[];
  };
}
