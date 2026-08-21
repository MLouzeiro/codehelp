import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getLogs, getLogsByEntidade, getAuditDashboardStats, LogFilters } from './audit.service';
import { getAuditStats } from './auditStats.service';
import { getSecurityIndicators, getAnomalias, getUserTimeline, getAuditExportFilters } from './audit-security.service';
import { getAuditAlerts, getAuditAlertStats, marcarAlertaAnalisado, arquivarAlerta } from './audit-alerts.service';
import prisma from '../../config/database';

export async function listAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { entidade, entidadeId, usuarioId, acao, modulo, origem, resultado, search, dataInicio, dataFim, limit, offset, severity, clienteId, fonte } = req.query;
    const result = await getLogs({
      entidade: entidade as string | undefined,
      entidadeId: entidadeId as string | undefined,
      usuarioId: usuarioId as string | undefined,
      acao: acao as string | undefined,
      modulo: modulo as string | undefined,
      origem: origem as string | undefined,
      resultado: resultado as string | undefined,
      search: search as string | undefined,
      severity: severity as string | undefined,
      clienteId: clienteId as string | undefined,
      fonte: fonte as string | undefined,
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

export async function getTaskAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { taskId } = req.params;
    const logs = await getLogsByEntidade('KanbanTask', taskId);
    return res.json({ logs });
  } catch (error) {
    console.error('Erro ao listar audit logs da tarefa:', error);
    return res.status(500).json({ error: 'Erro ao listar logs da tarefa' });
  }
}

export async function getOrderAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.params;
    const logs = await getLogsByEntidade('ServiceOrder', orderId);
    return res.json({ logs });
  } catch (error) {
    console.error('Erro ao listar audit logs da OS:', error);
    return res.status(500).json({ error: 'Erro ao listar logs da OS' });
  }
}

export async function getClientAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const logs = await getLogsByEntidade('Client', clientId);
    return res.json({ logs });
  } catch (error) {
    console.error('Erro ao listar audit logs do cliente:', error);
    return res.status(500).json({ error: 'Erro ao listar logs do cliente' });
  }
}

export async function getGlobalAudit(req: AuthRequest, res: Response) {
  try {
    const { modulo, origem, resultado, search, usuarioId, entidade, acao, dataInicio, dataFim, limit, offset, severity, clienteId, fonte } = req.query;
    const result = await getLogs({
      modulo: modulo as string | undefined,
      origem: origem as string | undefined,
      resultado: resultado as string | undefined,
      search: search as string | undefined,
      usuarioId: usuarioId as string | undefined,
      entidade: entidade as string | undefined,
      acao: acao as string | undefined,
      severity: severity as string | undefined,
      clienteId: clienteId as string | undefined,
      fonte: fonte as string | undefined,
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao buscar auditoria global:', error);
    return res.status(500).json({ error: 'Erro ao buscar auditoria global' });
  }
}

export async function getGlobalAuditStats(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const stats = await getAuditDashboardStats({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
    });
    return res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar dashboard de auditoria:', error);
    return res.status(500).json({ error: 'Erro ao buscar dashboard de auditoria' });
  }
}

export async function getAuditByUser(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    const { dataInicio, dataFim, modulo, limit, offset } = req.query;
    const result = await getUserTimeline(userId, {
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao buscar auditoria individual:', error);
    return res.status(500).json({ error: 'Erro ao buscar auditoria individual' });
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

export async function getSecurityHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, usuarioId } = req.query;
    const stats = await getSecurityIndicators({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      usuarioId: usuarioId as string | undefined,
    });
    return res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar indicadores de segurança:', error);
    return res.status(500).json({ error: 'Erro ao buscar segurança' });
  }
}

export async function getAnomaliasHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, usuarioId } = req.query;
    const anomalias = await getAnomalias({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      usuarioId: usuarioId as string | undefined,
    });
    return res.json({ anomalias });
  } catch (error) {
    console.error('Erro ao buscar anomalias:', error);
    return res.status(500).json({ error: 'Erro ao buscar anomalias' });
  }
}

export async function getAlertsHandler(req: AuthRequest, res: Response) {
  try {
    const { tipo, severidade, status, dataInicio, dataFim, limit, offset } = req.query;
    const result = await getAuditAlerts({
      tipo: tipo as string | undefined,
      severidade: severidade as string | undefined,
      status: status as string | undefined,
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    return res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
}

export async function getAlertStatsHandler(req: AuthRequest, res: Response) {
  try {
    const stats = await getAuditAlertStats();
    return res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar stats de alertas:', error);
    return res.status(500).json({ error: 'Erro ao buscar stats de alertas' });
  }
}

export async function marcarAlertaHandler(req: AuthRequest, res: Response) {
  try {
    const { alertId } = req.params;
    const { justificativa } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });
    const alerta = await marcarAlertaAnalisado(alertId, userId, justificativa);
    return res.json(alerta);
  } catch (error) {
    console.error('Erro ao marcar alerta:', error);
    return res.status(500).json({ error: 'Erro ao marcar alerta' });
  }
}

export async function arquivarAlertaHandler(req: AuthRequest, res: Response) {
  try {
    const { alertId } = req.params;
    const alerta = await arquivarAlerta(alertId);
    return res.json(alerta);
  } catch (error) {
    console.error('Erro ao arquivar alerta:', error);
    return res.status(500).json({ error: 'Erro ao arquivar alerta' });
  }
}

export async function getExportFiltersHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim, usuarioId } = req.query;
    const filters = await getAuditExportFilters({
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      usuarioId: usuarioId as string | undefined,
    });
    return res.json(filters);
  } catch (error) {
    console.error('Erro ao buscar filtros de exportação:', error);
    return res.status(500).json({ error: 'Erro ao buscar filtros' });
  }
}

export async function exportAuditCsvHandler(req: AuthRequest, res: Response) {
  try {
    const { entidade, entidadeId, usuarioId, acao, modulo, origem, resultado, search, dataInicio, dataFim, severity, clienteId, fonte } = req.query;
    const result = await getLogs({
      entidade: entidade as string | undefined,
      entidadeId: entidadeId as string | undefined,
      usuarioId: usuarioId as string | undefined,
      acao: acao as string | undefined,
      modulo: modulo as string | undefined,
      origem: origem as string | undefined,
      resultado: resultado as string | undefined,
      search: search as string | undefined,
      severity: severity as string | undefined,
      clienteId: clienteId as string | undefined,
      fonte: fonte as string | undefined,
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: 10000,
    });

    const header = 'Data;Hora;Usuario;Acao;Entidade;Entidade ID;Modulo;Severidade;Origem;Fonte;IP;Sucesso;Detalhes';
    const rows = result.logs.map((l) => {
      const d = new Date(l.createdAt);
      return [
        d.toLocaleDateString('pt-BR'),
        d.toLocaleTimeString('pt-BR'),
        `"${l.usuario?.name || 'Sistema'}"`,
        l.acao,
        l.entidade,
        l.entidadeId || '',
        l.modulo || '',
        l.severity || '',
        l.origem || '',
        l.fonte || '',
        l.ip || '',
        l.success === null ? '' : l.success ? 'Sim' : 'Não',
        `"${(l.detalhes || '').replace(/"/g, '""')}"`,
      ].join(';');
    }).join('\r\n');

    const csv = '\uFEFF' + [header, ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=auditoria.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    return res.status(500).json({ error: 'Erro ao exportar' });
  }
}

export async function getViolationStatsHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const where: any = {};
    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) where.createdAt.gte = new Date(dataInicio as string);
      if (dataFim) where.createdAt.lte = new Date(dataFim as string);
    }

    const [violacoesSLA, reaberturas, encerramentosSemResolucao, retrabalho] = await Promise.all([
      prisma.auditLog.count({ where: { ...where, acao: 'sla_violado' } }),
      prisma.auditLog.count({ where: { ...where, acao: 'reabrir' } }),
      prisma.auditLog.count({ where: { ...where, acao: 'encerrar_sem_resolucao' } }),
      prisma.auditLog.count({ where: { ...where, acao: 'retrabalho' } }),
    ]);

    return res.json({ violacoesSLA, reaberturas, encerramentosSemResolucao, retrabalho });
  } catch (error) {
    console.error('Erro ao buscar violações:', error);
    return res.status(500).json({ error: 'Erro ao buscar violações' });
  }
}
