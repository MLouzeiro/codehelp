import {
  LayoutDashboard, Stethoscope, Activity, ArrowUpDown, LineChart, BarChart3,
  Brain, Shield, Users, TrendingUp, FileText, Timer, BookOpen, Zap, MessageSquare,
  Bot, Settings, Kanban, Gauge, ChevronDown, Ban, Archive, FileSearch, GitBranch,
  RotateCcw,
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
      { path: '/app/helpdesk/operacao', label: 'Central de Operação', icon: Activity, roles: ['admin', 'gerente', 'supervisor'] },
    ],
  },
  {
    key: 'gestao',
    label: 'Gestão',
    icon: LineChart,
    roles: ['admin', 'gerente'],
    items: [
      {
        path: '/app/relatorios/executivo',
        label: 'Gestão & Indicadores',
        icon: BarChart3,
        roles: ['admin', 'gerente'],
        children: [
          { path: '/app/helpdesk/metrics', label: 'Métricas Operacionais', icon: Gauge, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/indicadores', label: 'Indicadores de Atendimento', icon: Timer, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/business-metrics', label: 'Métricas de Negócio', icon: BarChart3, roles: ['admin', 'gerente'] },
          { path: '/app/relatorios/executivo', label: 'Dashboard Executivo', icon: LineChart, roles: ['admin', 'gerente'] },
          { path: '/app/relatorios/ia', label: 'Dashboard IA', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/qualidade', label: 'Qualidade Operacional', icon: RotateCcw, roles: ['admin', 'gerente'] },
        ],
      },
      {
        path: '/app/helpdesk/auditoria-ia',
        label: 'Auditoria & Decisão',
        icon: FileSearch,
        roles: ['admin', 'gerente'],
        children: [
          { path: '/app/helpdesk/auditoria-ia', label: 'Auditoria IA', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/auditoria-encerramento', label: 'Auditoria de Encerramento', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/auditoria-analista', label: 'Auditoria por Analista', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/auditoria-profissional', label: 'Auditoria de Atendimentos', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/auditoria-geral', label: 'Auditoria Geral', icon: FileSearch, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/tomada-decisao', label: 'Tomada de Decisão', icon: Brain, roles: ['admin', 'gerente'] },
          { path: '/app/helpdesk/decisao-audit', label: 'Auditoria Decisões', icon: Brain, roles: ['admin', 'gerente', 'supervisor'] },
          { path: '/app/auditoria/sistema', label: 'Auditoria do Sistema', icon: FileSearch, roles: ['admin', 'gerente'] },
        ],
      },
    ],
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    icon: FileText,
    roles: ['admin', 'gerente'],
    items: [
      { path: '/app/relatorios/gerencial', label: 'Relatório Gerencial', icon: FileText, roles: ['admin', 'gerente'] },
      { path: '/app/relatorios/analitico', label: 'Relatório Analítico', icon: BarChart3, roles: ['admin', 'gerente'] },
      { path: '/app/orders/relatorio', label: 'Relatório de OS', icon: FileText, roles: ['admin', 'gerente'] },
    ],
  },
  {
    key: 'aprovacoes',
    label: 'Aprovações',
    icon: Shield,
    roles: ['admin', 'gerente'],
    items: [
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
      { path: '/app/kanban/dashboard', label: 'Dashboard de Tarefas', icon: Gauge, roles: ['admin', 'gerente'] },
      { path: '/app/kanban/arquivadas', label: 'Tarefas Arquivadas', icon: Archive, roles: ['admin', 'gerente'] },
      { path: '/app/kb', label: 'Base de Conhecimento', icon: BookOpen, roles: ['admin', 'gerente', 'tecnico', 'vendedor'] },
      { path: '/app/automations', label: 'Automações', icon: Zap, roles: ['admin', 'gerente', 'supervisor'] },
      { path: '/app/automations/flow-builder', label: 'Construtor de Fluxos', icon: GitBranch, roles: ['admin', 'gerente', 'supervisor'] },
    ],
  },
  {
    key: 'integracoes',
    label: 'Integrações',
    icon: MessageSquare,
    items: [
      { path: '/app/whatsapp', label: 'WhatsApp', icon: MessageSquare },
      { path: '/app/integracoes', label: 'Integrações Externas', icon: Settings, roles: ['admin', 'gerente'] },
      { path: '/app/whatsapp/ignorados', label: 'Contatos Ignorados', icon: Ban, roles: ['admin', 'gerente'] },
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
      { path: '/app/glossario', label: 'Glossário de Métricas', icon: BookOpen },
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

export interface ActiveMatch {
  group: NavGroup;
  item: NavItem;
  parent?: NavItem;
  depth: number;
}

/** Rota é ativa se for exatamente igual ao path ou uma subrota (path + '/'). */
export function matchRoute(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/');
}

/**
 * Encontra o item de navegação ativo para a rota atual usando o match MAIS
 * específico (maior profundidade e maior path), evitando falsos positivos
 * como "/app/helpdesk" marcar "/app/helpdesk/auditoria-analista".
 */
export function findActiveItem(pathname: string, userRole?: string): ActiveMatch | null {
  let best: ActiveMatch | null = null;

  for (const group of NAV_GROUPS) {
    if (group.roles && group.roles.length > 0 && !userHasRole(userRole, group.roles)) continue;
    const walk = (items: NavItem[], depth: number, parent?: NavItem) => {
      for (const item of items) {
        if (!itemVisible(userRole, item)) continue;
        if (matchRoute(pathname, item.path)) {
          const better = !best
            || depth > best.depth
            || (depth === best.depth && item.path.length >= best.item.path.length);
          if (better) {
            best = { group, item, parent, depth };
          }
        }
        if (item.children) walk(item.children, depth + 1, item);
      }
    };
    walk(group.items, 0);
  }

  return best;
}

export { ChevronDown };