import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getLogs, getLogsByEntidade } from './audit.service';
import { getAuditStats } from './auditStats.service';

export async function listAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { entidade, entidadeId, usuarioId, acao, dataInicio, dataFim, limit, offset } = req.query;
    const result = await getLogs({
      entidade: entidade as string | undefined,
      entidadeId: entidadeId as string | undefined,
      usuarioId: usuarioId as string | undefined,
      acao: acao as string | undefined,
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao listar audit logs:', error);
    return res.status(500).json({ error: 'Erro ao listar logs' });
  }
}

export async function getTicketAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const logs = await getLogsByEntidade('Ticket', ticketId);
    return res.json({ logs });
  } catch (error) {
    console.error('Erro ao listar audit logs do ticket:', error);
    return res.status(500).json({ error: 'Erro ao listar logs do ticket' });
  }
}

export async function getAuditStatsHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const stats = await getAuditStats(
      dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim ? new Date(dataFim as string) : undefined
    );
    return res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar stats de auditoria:', error);
    return res.status(500).json({ error: 'Erro ao buscar stats' });
  }
}
