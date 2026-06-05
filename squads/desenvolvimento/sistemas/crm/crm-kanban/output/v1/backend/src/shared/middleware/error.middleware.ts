import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Registro duplicado' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado' });
  }

  res.status(500).json({ error: 'Erro interno do servidor' });
}
