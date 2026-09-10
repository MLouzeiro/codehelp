import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import {
  buildOperationalSnapshot,
  getAnalystTimeline,
  getAnalystDailySummary,
  startPause,
  endPause,
} from './operacao.service';
import { operationalBus, OperationalEvent } from './eventBus';

export async function getSnapshotHandler(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const snapshot = await buildOperationalSnapshot(req.user.organizationId);
    res.json(snapshot);
  } catch (err: any) {
    console.error('[Operacao] Erro ao buscar snapshot:', err?.message || err);
    res.status(500).json({ error: 'Erro ao buscar snapshot operacional' });
  }
}

export async function getAnalystTimelineHandler(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const { id } = req.params;
    const timeline = await getAnalystTimeline(id, req.user.organizationId);
    res.json(timeline);
  } catch (err: any) {
    console.error('[Operacao] Erro ao buscar timeline:', err?.message || err);
    res.status(500).json({ error: 'Erro ao buscar timeline do analista' });
  }
}

export async function getAnalystSummaryHandler(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const { id } = req.params;
    const summary = await getAnalystDailySummary(id, req.user.organizationId);
    if (!summary) return res.status(404).json({ error: 'Analista não encontrado' });
    res.json(summary);
  } catch (err: any) {
    console.error('[Operacao] Erro ao buscar resumo:', err?.message || err);
    res.status(500).json({ error: 'Erro ao buscar resumo do analista' });
  }
}

export async function startPauseHandler(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const { reason } = req.body || {};
    startPause(req.user.id, reason);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Operacao] Erro ao iniciar pausa:', err?.message || err);
    res.status(500).json({ error: 'Erro ao iniciar pausa' });
  }
}

export async function endPauseHandler(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    endPause(req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Operacao] Erro ao finalizar pausa:', err?.message || err);
    res.status(500).json({ error: 'Erro ao finalizar pausa' });
  }
}

export function sseHandler(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 15000);

  const unsubscribe = operationalBus.subscribeToOrganization(
    req.user.organizationId || 'default',
    (event: OperationalEvent) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        // client disconnected
      }
    }
  );

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}
