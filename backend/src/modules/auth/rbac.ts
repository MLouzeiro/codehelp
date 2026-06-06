export const ROLES = ['solicitante', 'agente', 'supervisor', 'admin'] as const;
export type Role = typeof ROLES[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  solicitante: 1,
  agente: 2,
  supervisor: 3,
  admin: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  solicitante: 'Solicitante',
  agente: 'Agente',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};

export const LEGACY_ROLE_MAP: Record<string, Role> = {
  tecnico: 'agente',
  gerente: 'supervisor',
  vendedor: 'agente',
  admin: 'admin',
  solicitante: 'solicitante',
  agente: 'agente',
  supervisor: 'supervisor',
};

export function normalizeRole(role: string | null | undefined): Role | null {
  if (!role) return null;
  const r = role.toLowerCase().trim();
  if (LEGACY_ROLE_MAP[r]) return LEGACY_ROLE_MAP[r];
  if ((ROLES as readonly string[]).includes(r)) return r as Role;
  return null;
}

export function isValidRole(role: string): boolean {
  return normalizeRole(role) !== null;
}

export function hasAtLeast(userRole: string | null | undefined, required: Role): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  return ROLE_HIERARCHY[normalized] >= ROLE_HIERARCHY[required];
}

export function isAdmin(userRole: string | null | undefined): boolean {
  return normalizeRole(userRole) === 'admin';
}

export function isSupervisorOrAbove(userRole: string | null | undefined): boolean {
  return hasAtLeast(userRole, 'supervisor');
}

export function isAgentOrAbove(userRole: string | null | undefined): boolean {
  return hasAtLeast(userRole, 'agente');
}

export function canManageTickets(userRole: string | null | undefined): boolean {
  return isAgentOrAbove(userRole);
}

export function canManageUsers(userRole: string | null | undefined): boolean {
  return isAdmin(userRole);
}

export function canViewDashboard(userRole: string | null | undefined): boolean {
  return isSupervisorOrAbove(userRole);
}

export function canEscalateTicket(userRole: string | null | undefined): boolean {
  return isAgentOrAbove(userRole);
}

export function canDeleteTicket(userRole: string | null | undefined): boolean {
  return isAdmin(userRole);
}

export function canEditKB(userRole: string | null | undefined): boolean {
  return isAgentOrAbove(userRole);
}

export function canPublishKB(userRole: string | null | undefined): boolean {
  return isSupervisorOrAbove(userRole);
}
