import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  logTicketEvent,
  getTicketEvents,
  addTimelineEntry,
  closeTimelineEntry,
  getTicketTimeline,
  upsertTicketMetrics,
  getTicketMetrics,
  calculateAndStoreMetrics,
  logSlaEvent,
  getSlaLogs,
  logActivity,
  getTicketActivities,
  startWaitTime,
  endWaitTime,
  getTicketWaitTimes,
  logAiInteraction,
  getTicketAiLogs,
  getTicketReplayData,
  exportTicketData,
  getPerformanceReport,
  upsertPerformance,
} from './auditTicket.service';

// ══════════════════════════════════════════════════════════════════
// ── EVENTS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function createEvent(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { tipo, descricao, dados, mensagemId } = req.body;

    const event = await logTicketEvent({
      ticketId,
      tipo,
      descricao,
      dados,
      usuarioId: req.user?.id,
      mensagemId,
    });

    res.status(201).json(event);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao registrar evento' });
  }
}

export async function listEvents(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { tipo, limit, offset } = req.query;

    const events = await getTicketEvents(ticketId, {
      tipo: tipo as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(events);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar eventos' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── TIMELINE ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function addTimeline(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { etapa, dataEntrada, dataSaida, responsavelAnteriorId, responsavelNovoId, motivoMudanca } = req.body;

    const entry = await addTimelineEntry({
      ticketId,
      etapa,
      dataEntrada: new Date(dataEntrada),
      dataSaida: dataSaida ? new Date(dataSaida) : undefined,
      responsavelAnteriorId,
      responsavelNovoId,
      motivoMudanca,
    });

    res.status(201).json(entry);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao adicionar timeline' });
  }
}

export async function closeTimeline(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { etapa } = req.body;

    const entry = await closeTimelineEntry(ticketId, etapa);
    res.json(entry);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao fechar timeline' });
  }
}

export async function listTimeline(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const timeline = await getTicketTimeline(ticketId);
    res.json(timeline);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar timeline' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── METRICS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function getMetrics(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    let metrics = await getTicketMetrics(ticketId);

    // Se nao existir, calcular e salvar
    if (!metrics) {
      metrics = await calculateAndStoreMetrics(ticketId);
    }

    res.json(metrics);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao obter metricas' });
  }
}

export async function recalculateMetrics(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const metrics = await calculateAndStoreMetrics(ticketId);
    res.json(metrics);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao recalcular metricas' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── SLA LOGS ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function createSlaLog(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { acao, slaMinutos, percentual, restantesMin, motivo, dados } = req.body;

    const log = await logSlaEvent({
      ticketId,
      acao,
      slaMinutos,
      percentual,
      restantesMin,
      motivo,
      dados,
      usuarioId: req.user?.id,
    });

    res.status(201).json(log);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao registrar SLA' });
  }
}

export async function listSlaLogs(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const logs = await getSlaLogs(ticketId);
    res.json(logs);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar SLA logs' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── ACTIVITY ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function createActivity(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { tipo, descricao, dados } = req.body;

    const activity = await logActivity({
      ticketId,
      usuarioId: req.user?.id,
      tipo,
      descricao,
      dados,
      ip: req.ip || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });

    res.status(201).json(activity);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao registrar atividade' });
  }
}

export async function listActivities(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { tipo, limit } = req.query;

    const activities = await getTicketActivities(ticketId, {
      tipo: tipo as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(activities);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar atividades' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── WAIT TIMES ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function startWaiting(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { etapa, motivo } = req.body;

    const wait = await startWaitTime({
      ticketId,
      etapa,
      motivo,
      usuarioId: req.user?.id,
    });

    res.status(201).json(wait);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao iniciar espera' });
  }
}

export async function endWaiting(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { etapa } = req.body;

    const wait = await endWaitTime(ticketId, etapa);
    res.json(wait);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao finalizar espera' });
  }
}

export async function listWaitTimes(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const waits = await getTicketWaitTimes(ticketId);
    res.json(waits);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar tempos de espera' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── AI LOGS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function createAiLog(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { tipo, modelo, inputTokens, outputTokens, custoUsd, custoBrl, latenciaMs, confianca, resultado, erro, duracaoProcessamentoMs } = req.body;

    const log = await logAiInteraction({
      ticketId,
      tipo,
      modelo,
      inputTokens,
      outputTokens,
      custoUsd,
      custoBrl,
      latenciaMs,
      confianca,
      resultado,
      erro,
      duracaoProcessamentoMs,
    });

    res.status(201).json(log);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao registrar IA' });
  }
}

export async function listAiLogs(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const logs = await getTicketAiLogs(ticketId);
    res.json(logs);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar logs de IA' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── REPLAY / EXPORT ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function getReplay(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const data = await getTicketReplayData(ticketId);
    res.json(data);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao obter replay' });
  }
}

export async function exportData(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { format } = req.query;

    const data = await exportTicketData(ticketId, (format as 'json' | 'csv') || 'json');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ticket-${ticketId}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(data);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao exportar' });
  }
}

// ══════════════════════════════════════════════════════════════════
// ── PERFORMANCE ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

export async function getPerformance(req: AuthRequest, res: Response) {
  try {
    const { periodo, tipoPeriodo, usuarioId, departamentoId } = req.query;

    const report = await getPerformanceReport({
      periodo: periodo as string,
      tipoPeriodo: tipoPeriodo as string,
      usuarioId: usuarioId as string,
      departamentoId: departamentoId as string,
    });

    res.json(report);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao obter performance' });
  }
}
