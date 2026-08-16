import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  auditarEncerramento,
  auditarLoteEncerramentos,
  resumoAuditoriaEncerramentos,
  listarTicketsEncerrados,
  exportarAuditoriaCsv,
  exportarAuditoriaExcel,
  FiltroAuditoria,
} from './closureAudit.service';

export function parseFiltro(req: AuthRequest): FiltroAuditoria {
  const { dataInicio, dataFim, assigneeId, clienteId, departamentoId, categoria, prioridade, status, limit } = req.query;
  let inicio: Date | undefined;
  let fim: Date | undefined;
  if (dataInicio) {
    inicio = new Date(dataInicio as string);
    if (isNaN(inicio.getTime())) throw new Error('dataInicio inválida');
  }
  if (dataFim) {
    fim = new Date(dataFim as string);
    if (isNaN(fim.getTime())) throw new Error('dataFim inválida');
  }
  let limite: number | undefined;
  if (limit !== undefined) {
    limite = Number(limit);
    if (!Number.isFinite(limite) || limite < 1 || limite > 1000) throw new Error('limit deve ser entre 1 e 1000');
  }
  return {
    dataInicio: inicio,
    dataFim: fim,
    assigneeId: assigneeId as string | undefined,
    clienteId: clienteId as string | undefined,
    departamentoId: departamentoId as string | undefined,
    categoria: categoria as string | undefined,
    prioridade: prioridade as string | undefined,
    status: status as string | undefined,
    limit: limite,
  };
}

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
    const tickets = await listarTicketsEncerrados(parseFiltro(req));
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar tickets encerrados' });
  }
}

export async function getAuditarLote(req: AuthRequest, res: Response) {
  try {
    const result = await auditarLoteEncerramentos(parseFiltro(req));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao auditar lote' });
  }
}

export async function getResumoAuditoria(req: AuthRequest, res: Response) {
  try {
    const result = await resumoAuditoriaEncerramentos(parseFiltro(req));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao gerar resumo' });
  }
}

export async function getExportarAuditoria(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltro(req);
    if (!filtro.limit) filtro.limit = 500;
    const { auditados } = await auditarLoteEncerramentos(filtro);
    const csv = exportarAuditoriaCsv(auditados);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-encerramento.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao exportar auditoria' });
  }
}

export async function getExportarAuditoriaExcel(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltro(req);
    if (!filtro.limit) filtro.limit = 500;
    const { auditados } = await auditarLoteEncerramentos(filtro);
    const resumo = await resumoAuditoriaEncerramentos(filtro);
    const buffer = await exportarAuditoriaExcel(auditados, resumo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-encerramento.xlsx"');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao exportar auditoria Excel' });
  }
}
