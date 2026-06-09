import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { listFilas, createFila, updateFila, toggleFila } from './filas.service';
import prisma from '../../config/database';

function handleError(res: Response, error: any) {
  if (error?.code === 'VALIDATION') {
    return res.status(400).json({ error: error.message, field: error.field });
  }
  if (error?.code === 'P2002') {
    return res.status(400).json({ error: 'Já existe um registro com estes dados' });
  }
  console.error('[Filas] Erro:', error);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

export async function getFilasList(req: AuthRequest, res: Response) {
  try {
    const { departamentoId } = req.query;
    const filas = await listFilas(departamentoId as string | undefined);
    return res.json(filas);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postFila(req: AuthRequest, res: Response) {
  try {
    const fila = await createFila(req.body);

    await prisma.auditLog.create({
      data: {
        usuarioId: req.user!.id,
        acao: 'criar_fila',
        entidade: 'fila',
        entidadeId: fila.id,
        detalhes: JSON.stringify({ nome: fila.nome, departamentoId: fila.departamentoId }),
        ip: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    return res.status(201).json(fila);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function putFila(req: AuthRequest, res: Response) {
  try {
    const fila = await updateFila(req.params.id, req.body);
    if (!fila) return res.status(404).json({ error: 'Fila não encontrada' });

    await prisma.auditLog.create({
      data: {
        usuarioId: req.user!.id,
        acao: 'editar_fila',
        entidade: 'fila',
        entidadeId: fila.id,
        detalhes: JSON.stringify(req.body),
        ip: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    return res.json(fila);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function toggleFilaHandler(req: AuthRequest, res: Response) {
  try {
    const fila = await toggleFila(req.params.id);
    if (!fila) return res.status(404).json({ error: 'Fila não encontrada' });

    await prisma.auditLog.create({
      data: {
        usuarioId: req.user!.id,
        acao: fila.ativo ? 'reativar_fila' : 'desativar_fila',
        entidade: 'fila',
        entidadeId: fila.id,
        detalhes: JSON.stringify({ ativo: fila.ativo }),
        ip: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    return res.json(fila);
  } catch (error) {
    return handleError(res, error);
  }
}
