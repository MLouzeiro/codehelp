import { Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from './auth';
import { normalizeRole } from '../../modules/auth/rbac';

/**
 * Verifica se o usuario pode VISUALIZAR o ticket.
 *
 * Regras:
 * - admin/supervisor: sempre pode
 * - agente: pode se o ticket esta nos seus departamentos OU e atribuido a ele
 * - solicitante: pode apenas se criou o ticket
 */
export function podeVerTicket(usuario: AuthRequest['user'], ticket: { departamentoId: string | null; assigneeId: string | null; usuarioId: string | null }): boolean {
  if (!usuario) return false;
  const role = normalizeRole(usuario.role);

  // Admin e supervisor veem tudo
  if (role === 'admin' || role === 'supervisor') return true;

  // Agente: ve tickets dos seus departamentos ou atribuidos a ele
  if (role === 'agente') {
    const deptIds = usuario.departamentos.map((d) => d.id);
    if (ticket.assigneeId === usuario.id) return true;
    if (ticket.departamentoId && deptIds.includes(ticket.departamentoId)) return true;
    if (!ticket.departamentoId) return true; // Sem departamento = visivel para todos
    return false;
  }

  // Solicitante: ve apenas seus proprios tickets
  if (role === 'solicitante') {
    return ticket.usuarioId === usuario.id;
  }

  return false;
}

/**
 * Verifica se o usuario pode EDITAR o ticket (mover etapa, alterar campos).
 *
 * Regras:
 * - admin: sempre pode
 * - supervisor: pode se o ticket esta nos seus departamentos
 * - agente: pode se e atribuido a ele
 * - solicitante: nao pode
 */
export function podeEditarTicket(usuario: AuthRequest['user'], ticket: { departamentoId: string | null; assigneeId: string | null }): boolean {
  if (!usuario) return false;
  const role = normalizeRole(usuario.role);

  if (role === 'admin') return true;

  if (role === 'supervisor') {
    const deptIds = usuario.departamentos.map((d) => d.id);
    if (!ticket.departamentoId) return true;
    return deptIds.includes(ticket.departamentoId);
  }

  if (role === 'agente') {
    return ticket.assigneeId === usuario.id;
  }

  return false;
}

/**
 * Verifica se o usuario pode ATRIBUIR/TRANSFERIR o ticket.
 *
 * Regras:
 * - admin: sempre pode
 * - supervisor: pode se o ticket esta nos seus departamentos
 * - agente: pode apenas para si mesmo (assumir ticket da fila)
 * - solicitante: nao pode
 */
export function podeAtribuirTicket(usuario: AuthRequest['user'], ticket: { departamentoId: string | null; assigneeId: string | null }): boolean {
  if (!usuario) return false;
  const role = normalizeRole(usuario.role);

  if (role === 'admin') return true;

  if (role === 'supervisor') {
    const deptIds = usuario.departamentos.map((d) => d.id);
    if (!ticket.departamentoId) return true;
    return deptIds.includes(ticket.departamentoId);
  }

  if (role === 'agente') {
    // Agente so pode assumir para si (ticket na fila do seu departamento)
    const deptIds = usuario.departamentos.map((d) => d.id);
    if (ticket.assigneeId === usuario.id) return true;
    if (!ticket.departamentoId) return true;
    if (ticket.departamentoId && deptIds.includes(ticket.departamentoId)) return true;
    return false;
  }

  return false;
}

/**
 * Middleware Express: verifica se o usuario pode acessar o ticket da rota.
 * Busca o ticket pelo :id e anexa ao req.ticket.
 */
export function requireTicketAccess(action: 'view' | 'edit' | 'assign') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, departamentoId: true, assigneeId: true, usuarioId: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    let allowed = false;
    switch (action) {
      case 'view':
        allowed = podeVerTicket(req.user, ticket);
        break;
      case 'edit':
        allowed = podeEditarTicket(req.user, ticket);
        break;
      case 'assign':
        allowed = podeAtribuirTicket(req.user, ticket);
        break;
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Sem permissão para acessar este ticket' });
    }

    // Anexa ticket ao request para uso posterior
    (req as any).ticket = ticket;
    next();
  };
}
