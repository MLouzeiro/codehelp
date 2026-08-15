import {
  LayoutDashboard, Stethoscope, Activity, ArrowUpDown, LineChart, BarChart3,
  Brain, Shield, Users, TrendingUp, FileText, Timer, BookOpen, Zap, MessageSquare,
  Bot, Settings, Kanban, Gauge, ChevronDown,
} from 'lucide-react';

export type Role = string;

export interface NavItem {
  path: string;
  label: string;
  icon: any;
  roles?: Role[];
  /** Sub-itens (nível 2). Se presente, o item vira um submenu expansível. */
  children?: NavItem[];
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
 * Configuração central de navegação (menu enxuto).
 * O Layout apenas renderiza esta estrutura. Todas as rotas são preservadas;
 * páginas que não aparecem diretamente seguem acessíveis via URL/links internos.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'visao-geral',
    label: 'Visão Geral',
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
    icon: LineChart,
    items: [
      {
        path: '/app/relatorios/executivo',
        label: 'Gestão & Indicadores',
        icon: BarChart3,
        roles: ['admin', 'gerente'],
        children: [
          { path: '/app/helpdesk/metrics', label: 'Métricas Operacionais', icon: Gauge, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/business-metrics', label: 'Métricas de Negócio', icon: BarChart3, roles: ['admin', 'gerente'] },
          { path: '/app/relatorios/executivo', label: 'Dashboard Executivo', icon: LineChart, roles: ['admin', 'gerente'] },
        ],
      },
      {
        path: '/app/helpdesk/auditoria-ia',
        label: 'Auditoria IA',
        icon: Brain,
        roles: ['admin', 'gerente'],
        children: [
          { path: '/app/helpdesk/auditoria-ia', label: 'Auditoria IA', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/auditoria-encerramento', label: 'Auditoria de Encerramento', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/auditoria-analista', label: 'Auditoria por Analista', icon: Brain, roles: ['admin', 'gerente'] },
        ],
      },
      {
        path: '/app/relatorios/gerencial',
        label: 'Relatórios',
        icon: FileText,
        roles: ['admin', 'gerente'],
        children: [
          { path: '/app/relatorios/gerencial', label: 'Relatório Gerencial', icon: FileText, roles: ['admin', 'gerente'] },
          { path: '/app/relatorios/analitico', label: 'Relatório Analítico', icon: BarChart3, roles: ['admin', 'gerente'] },
        ],
      },
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

/** Item visível se tiver role permitida e, quando tem sub-itens, ao menos um visível. */
export function itemVisible(userRole: string | undefined, item: NavItem): boolean {
  if (!userHasRole(userRole, item.roles)) return false;
  if (item.children && item.children.length > 0) {
    return item.children.some((c) => itemVisible(userRole, c));
  }
  return true;
}

export function filterGroupsByRole(userRole: string | undefined): NavGroup[] {
  return NAV_GROUPS.filter((group) => {
    if (group.roles && group.roles.length > 0 && !userHasRole(userRole, group.roles)) return false;
    const visibleItems = group.items.filter((item) => itemVisible(userRole, item));
    return visibleItems.length > 0;
  });
}

export { ChevronDown };