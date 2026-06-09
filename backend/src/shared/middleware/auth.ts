import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import prisma from '../../config/database';
import { normalizeRole, hasAtLeast, Role } from '../../modules/auth/rbac';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    isMaster: boolean;
    departamentoId: string | null;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isMaster: true, active: true, departamentoId: true },
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    const userRoleNormalized = normalizeRole(req.user.role);
    if (!userRoleNormalized) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    const allowed = roles.some((r) => {
      const roleNorm = normalizeRole(r);
      if (roleNorm) return roleNorm === userRoleNormalized;
      return r === req.user!.role;
    });
    if (!allowed) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    next();
  };
}

export function authorizeMaster(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(403).json({ error: 'Acesso restrito a administrador master' });
  }
  if (req.user.isMaster || req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito a administrador master' });
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    const userRoleNormalized = normalizeRole(req.user.role);
    if (!userRoleNormalized) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    const allowed = roles.some((r) => hasAtLeast(userRoleNormalized, r));
    if (!allowed) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    next();
  };
}
