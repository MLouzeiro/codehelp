import prisma from '../../config/database';

export const ROLES_VALIDAS = ['admin', 'gerente', 'tecnico', 'comercial', 'vendedor'] as const;
export type Role = typeof ROLES_VALIDAS[number];

export const ACTION_LABELS: Record<string, string> = {
  read: 'Ler',
  create: 'Criar',
  update: 'Editar',
  delete: 'Excluir',
  manage: 'Gerenciar tudo',
  sign: 'Assinar',
  move: 'Mover',
  assign: 'Atribuir',
  resolve: 'Resolver',
  publish: 'Publicar',
  export: 'Exportar',
};

export const RESOURCES_CATALOG: Array<{ key: string; label: string; actions: string[] }> = [
  { key: 'client', label: 'Clientes', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'colaborador', label: 'Colaboradores', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'opportunity', label: 'Oportunidades (Pipeline)', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'order', label: 'Ordens de Servico', actions: ['read', 'create', 'update', 'delete', 'sign'] },
  { key: 'ticket', label: 'Tickets / Helpdesk', actions: ['read', 'create', 'update', 'move', 'assign', 'resolve'] },
  { key: 'helpdesk_stage', label: 'Etapas do Helpdesk', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'kb', label: 'Base de Conhecimento', actions: ['read', 'create', 'update', 'delete', 'publish'] },
  { key: 'automation', label: 'Automacoes', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'robot', label: 'Robos', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'alert', label: 'Alertas', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'user', label: 'Usuarios', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'permission', label: 'Permissoes', actions: ['read', 'update'] },
  { key: 'report', label: 'Relatorios', actions: ['read', 'export'] },
  { key: 'dashboard', label: 'Dashboards', actions: ['read'] },
  { key: 'audit', label: 'Auditoria', actions: ['read'] },
];

const ALL_RESOURCES: string[] = RESOURCES_CATALOG.map((r) => r.key);
const ALL_ACTIONS: string[] = Array.from(new Set(RESOURCES_CATALOG.flatMap((r) => r.actions)));

function allActions(resource: string): string[] {
  const r = RESOURCES_CATALOG.find((x) => x.key === resource);
  return r ? r.actions : [];
}

const DEFAULTS: Record<Role, Record<string, string[]>> = {
  admin: buildAll(),
  gerente: {
    client: ['read', 'create', 'update', 'delete'],
    colaborador: ['read', 'create', 'update', 'delete'],
    opportunity: ['read', 'create', 'update', 'delete'],
    order: ['read', 'create', 'update', 'delete'],
    ticket: ['read', 'create', 'update', 'move', 'assign', 'resolve'],
    helpdesk_stage: ['read'],
    kb: ['read', 'create', 'update', 'delete', 'publish'],
    automation: ['read', 'create', 'update', 'delete'],
    robot: ['read', 'create', 'update', 'delete'],
    alert: ['read', 'create', 'update', 'delete'],
    user: ['read'],
    permission: ['read'],
    report: ['read', 'export'],
    dashboard: ['read'],
    audit: ['read'],
  },
  tecnico: {
    client: ['read', 'update'],
    colaborador: ['read'],
    opportunity: ['read'],
    order: ['read', 'create', 'update'],
    ticket: ['read', 'create', 'update', 'move', 'assign', 'resolve'],
    helpdesk_stage: ['read'],
    kb: ['read', 'create', 'update'],
    automation: ['read'],
    robot: ['read', 'update'],
    alert: ['read'],
    report: ['read'],
    dashboard: ['read'],
  },
  comercial: {
    client: ['read', 'create', 'update'],
    colaborador: ['read'],
    opportunity: ['read', 'create', 'update'],
    order: ['read'],
    ticket: ['read'],
    helpdesk_stage: ['read'],
    kb: ['read'],
    report: ['read'],
    dashboard: ['read'],
  },
  vendedor: {
    client: ['read'],
    colaborador: ['read'],
    order: ['read'],
    ticket: ['read'],
    report: ['read'],
    dashboard: ['read'],
  },
};

function buildAll(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of RESOURCES_CATALOG) out[r.key] = [...r.actions];
  return out;
}

export function isValidRole(role: string): role is Role {
  return (ROLES_VALIDAS as readonly string[]).includes(role);
}

export function isValidResource(resource: string): boolean {
  return ALL_RESOURCES.includes(resource);
}

export function isValidAction(resource: string, action: string): boolean {
  return allActions(resource).includes(action);
}

export function getDefaultPermissions(role: Role): Record<string, string[]> {
  return DEFAULTS[role] || {};
}

export function getResourceCatalog() {
  return RESOURCES_CATALOG;
}

export type PermissionMap = Record<string, Record<string, boolean>>;

function applyOverride(defaults: Record<string, string[]>, overrides: Array<{ resource: string; action: string; granted: boolean }>): PermissionMap {
  const out: PermissionMap = {};
  for (const r of RESOURCES_CATALOG) {
    out[r.key] = {};
    const defaultActions = defaults[r.key] || [];
    for (const a of r.actions) {
      out[r.key][a] = defaultActions.includes(a);
    }
  }
  for (const o of overrides) {
    if (!out[o.resource]) out[o.resource] = {};
    out[o.resource][o.action] = o.granted;
  }
  return out;
}

export async function getRolePermissions(role: string): Promise<PermissionMap> {
  if (!isValidRole(role)) throw badRequest('Role invalida.', 'role');
  const defaults = getDefaultPermissions(role as Role);
  const overrides = await prisma.rolePermission.findMany({ where: { role } });
  return applyOverride(defaults, overrides);
}

export async function getAllPermissions(): Promise<Record<string, PermissionMap>> {
  const out: Record<string, PermissionMap> = {};
  for (const role of ROLES_VALIDAS) {
    out[role] = await getRolePermissions(role);
  }
  return out;
}

export async function getRoleOverrides(role: string) {
  if (!isValidRole(role)) throw badRequest('Role invalida.', 'role');
  return prisma.rolePermission.findMany({
    where: { role },
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
  });
}

export async function setPermission(role: string, resource: string, action: string, granted: boolean) {
  if (!isValidRole(role)) throw badRequest('Role invalida.', 'role');
  if (!isValidResource(resource)) throw badRequest('Resource invalido.', 'resource');
  if (!isValidAction(resource, action)) throw badRequest(`Action '${action}' invalida para o resource '${resource}'.`, 'action');
  return prisma.rolePermission.upsert({
    where: { role_resource_action: { role, resource, action } },
    update: { granted, updatedAt: new Date() },
    create: { role, resource, action, granted },
  });
}

export async function removePermission(role: string, resource: string, action: string) {
  if (!isValidRole(role)) throw badRequest('Role invalida.', 'role');
  await prisma.rolePermission.deleteMany({ where: { role, resource, action } });
}

export async function bulkUpdatePermissions(role: string, permissions: Array<{ resource: string; action: string; granted: boolean }>) {
  if (!isValidRole(role)) throw badRequest('Role invalida.', 'role');
  for (const p of permissions) {
    if (!isValidResource(p.resource)) throw badRequest(`Resource invalido: ${p.resource}`, 'resource');
    if (!isValidAction(p.resource, p.action)) throw badRequest(`Action invalida: ${p.resource}:${p.action}`, 'action');
  }
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ role, resource: p.resource, action: p.action, granted: p.granted })),
    }),
  ]);
  return prisma.rolePermission.findMany({ where: { role } });
}

export async function resetRoleToDefault(role: string) {
  if (!isValidRole(role)) throw badRequest('Role invalida.', 'role');
  await prisma.rolePermission.deleteMany({ where: { role } });
  return getRolePermissions(role);
}

export async function checkPermission(role: string, resource: string, action: string): Promise<boolean> {
  if (!isValidRole(role)) return false;
  if (!isValidResource(resource)) return false;
  const override = await prisma.rolePermission.findUnique({
    where: { role_resource_action: { role, resource, action } },
  });
  if (override) return override.granted;
  const defaults = getDefaultPermissions(role as Role);
  const defaultActions = defaults[resource] || [];
  return defaultActions.includes(action);
}

function badRequest(msg: string, field?: string): Error {
  return Object.assign(new Error(msg), { code: 'VALIDATION', field });
}
