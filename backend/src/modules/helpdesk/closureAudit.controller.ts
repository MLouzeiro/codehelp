import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  auditarEncerramento,
  auditarLoteEncerramentos,
  resumoAuditoriaEncerramentos,
  listarTicketsEncerrados,
} from './closureAudit.service';

export async function getAuditarEncerramento(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const usarIa = req.query.ia !== 'false';
    const result = await auditarEncerramento(id, usarIa);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao auditar encerramento' });
  }
}

export async function getListarEncerrados(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, assigneeId, limit } = req.query;
    const tickets = await listarTicketsEncerrados({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      assigneeId: assigneeId as string | undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar tickets encerrados' });
  }
}

export async function getAuditarLote(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, limit } = req.query;
    const result = await auditarLoteEncerramentos({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao auditar lote' });
  }
}

export async function getResumoAuditoria(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, limit } = req.query;
    const result = await resumoAuditoriaEncerramentos({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao gerar resumo' });
  }
}
