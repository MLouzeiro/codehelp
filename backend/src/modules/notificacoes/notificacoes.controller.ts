import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  contarNaoLidas,
} from './notificacoes.service';

export async function getNotificacoes(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Nao autenticado' });
    const { apenasNaoLidas, limit, offset } = req.query;
    const result = await listarNotificacoes({
      destinatarioId: req.user.id,
      apenasNaoLidas: apenasNaoLidas === 'true',
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao listar notificacoes:', error);
    return res.status(500).json({ error: 'Erro ao listar notificacoes' });
  }
}

export async function getNaoLidasCount(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Nao autenticado' });
    const total = await contarNaoLidas(req.user.id);
    return res.json({ total });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao contar notificacoes' });
  }
}

export async function postMarcarLida(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Nao autenticado' });
    const { id } = req.params;
    await marcarComoLida(id, req.user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar como lida:', error);
    return res.status(500).json({ error: 'Erro ao marcar notificacao' });
  }
}

export async function postMarcarTodasLidas(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Nao autenticado' });
    const result = await marcarTodasComoLidas(req.user.id);
    return res.json({ success: true, atualizadas: result.count });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao marcar todas' });
  }
}
