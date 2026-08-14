import {
  LayoutDashboard, Stethoscope, Activity, ArrowUpDown, LineChart, BarChart3,
  Brain, Shield, Users, TrendingUp, FileText, Timer, BookOpen, Zap, MessageSquare,
  Bot, Settings, Kanban, FolderKanban, ChartNoAxesCombined, Gauge, ChevronDown,
} from 'lucide-react';

export type Role = string;

export interface NavItem {
  path: string;
  label: string;
  icon: any;
  roles?: Role[];
}

export interface NavGroup {
  key: string;
  label: string;
  icon: any;
  /** Roles que permitem ver o grupo como um todo (se vazio, segue os itens). */
  roles?: Role[];
  items: NavItem[];
}

/**
 * Configuração central de navegação (FASE menu — enxugamento).
 * O Layout apenas renderiza esta estrutura. Todas as rotas são preservadas.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { path: '/app/dashboard', label: 'Dashboard', icon: Gauge },
    ],
  },
  {
    key: 'atendimento',
    label: 'Atendimento',
    icon: Stethoscope,
    items: [
      { path: '/app/helpdesk', label: 'Chamados', icon: Stethoscope },
      { path: '/app/helpdesk/painel', label: 'Atendimento ao Vivo', icon: Activity, roles: ['admin', 'gerente'] },
      { path: '/app/helpdesk/board', label: 'Quadro de Atendimento', icon: ArrowUpDown, roles: ['admin', 'gerente'] },
    ],
  },
  {
    key: 'gestao',
    label: 'Gestão',
    icon: ChartNoAxesCombined,
    items: [
      { path: '/app/helpdesk/metrics', label: 'Indicadores', icon: LineChart, roles: ['admin', 'gerente'] },
      { path: '/app/helpdesk/business-metrics', label: 'Métricas de Negócio', icon: BarChart3, roles: ['admin', 'gerente'] },
      { path: '/app/relatorios/gerencial', label: 'Relatório Gerencial', icon: BarChart3, roles: ['admin', 'gerente'] },
      { path: '/app/relatorios/executivo', label: 'Dashboard Executivo', icon: FolderKanban, roles: ['admin', 'gerente'] },
      { path: '/app/helpdesk/auditoria-ia', label: 'Auditoria IA', icon: Brain, roles: ['admin', 'gerente'] },
      { path: '/app/helpdesk/auditoria-encerramento', label: 'Auditoria de Encerramento', icon: Brain, roles: ['admin', 'gerente'] },
      { path: '/app/helpdesk/auditoria-analista', label: 'Auditoria por Analista', icon: Brain, roles: ['admin', 'gerente'] },
      { path: '/app/helpdesk/aprovacoes', label: 'Aprovações', icon: Shield, roles: ['admin', 'gerente'] },
    ],
  },
  {
    key: 'clientes',
    label: 'Clientes',
    icon: Users,
    items: [
      { path: '/app/crm', label: 'Clientes', icon: Users },
      { path: '/app/crm/pipeline', label: 'Negócios', icon: TrendingUp },
      { path: '/app/orders', label: 'Ordens de Serviço', icon: FileText },
    ],
  },
  {
    key: 'operacao',
    label: 'Operação',
    icon: Zap,
    items: [
      { path: '/app/timetracking', label: 'Tempo & Produtividade', icon: Timer },
      { path: '/app/kanban', label: 'Tarefas Internas', icon: Kanban },
      { path: '/app/kb', label: 'Base de Conhecimento', icon: BookOpen, roles: ['admin', 'gerente', 'tecnico', 'vendedor'] },
      { path: '/app/automations', label: 'Automações', icon: Zap, roles: ['admin', 'gerente', 'supervisor'] },
    ],
  },
  {
    key: 'integracoes',
    label: 'Integrações',
    icon: MessageSquare,
    items: [
      { path: '/app/whatsapp', label: 'WhatsApp', icon: MessageSquare },
      { path: '/app/robos', label: 'Chatbots', icon: Bot },
    ],
  },
  {
    key: 'administracao',
    label: 'Administração',
    icon: Settings,
    roles: ['admin', 'gerente'],
    items: [
      { path: '/app/settings', label: 'Configurações', icon: Settings },
    ],
  },
];

export function userHasRole(userRole: string | undefined, roles?: Role[]): boolean {
  if (!roles || roles.length === 0) return true;
  return !!userRole && roles.includes(userRole);
}

export function filterGroupsByRole(userRole: string | undefined): NavGroup[] {
  return NAV_GROUPS.filter((group) => {
    if (group.roles && group.roles.length > 0 && !userHasRole(userRole, group.roles)) return false;
    const visibleItems = group.items.filter((item) => userHasRole(userRole, item.roles));
    return visibleItems.length > 0;
  });
}

export { ChevronDown };
