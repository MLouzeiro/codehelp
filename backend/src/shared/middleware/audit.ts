import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../../config/database';

export function auditLog(acao: string, entidade: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400) {
        prisma.auditLog.create({
          data: {
            usuarioId: req.user?.id,
            acao,
            entidade,
            entidadeId: req.params?.id || body?.id,
            detalhes: JSON.stringify({ method: req.method, path: req.path }),
            ip: req.ip,
          },
        }).catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
}
