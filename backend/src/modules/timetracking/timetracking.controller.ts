import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as svc from './timetracking.service';

// ── Timer operations ─────────────────────────────────────────────────

export async function startTimer(req: AuthRequest, res: Response) {
  try {
    const entry = await svc.startTimer({
      usuarioId: req.user!.id,
      ...req.body,
    });
    return res.json(entry);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao iniciar timer' });
  }
}

export async function stopTimer(req: AuthRequest, res: Response) {
  try {
    const entry = await svc.stopTimer(req.params.id);

    // Auto-sync order hours if linked
    if (entry.orderId) {
      await svc.syncOrderHours(entry.orderId);
    }

    return res.json(entry);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao parar timer' });
  }
}

export async function getRunningTimer(req: AuthRequest, res: Response) {
  try {
    const entry = await svc.getRunningTimer(req.user!.id);
    return res.json(entry || null);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar timer ativo' });
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────

export async function createEntry(req: AuthRequest, res: Response) {
  try {
    const entry = await svc.createManualEntry({
      usuarioId: req.user!.id,
      ...req.body,
    });

    if (entry.orderId) {
      await svc.syncOrderHours(entry.orderId);
    }

    return res.status(201).json(entry);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao criar entrada' });
  }
}

export async function updateEntry(req: AuthRequest, res: Response) {
  try {
    const entry = await svc.updateEntry(req.params.id, req.body);

    if (entry.orderId) {
      await svc.syncOrderHours(entry.orderId);
    }

    return res.json(entry);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar entrada' });
  }
}

export async function deleteEntry(req: AuthRequest, res: Response) {
  try {
    await svc.deleteEntry(req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao deletar entrada' });
  }
}

export async function listEntries(req: AuthRequest, res: Response) {
  try {
    const {
      usuarioId, ticketId, orderId, tipo,
      billable, from, to, running,
    } = req.query as Record<string, string>;

    const entries = await svc.listEntries({
      usuarioId,
      ticketId,
      orderId,
      tipo,
      billable: billable !== undefined ? billable === 'true' : undefined,
      from,
      to,
      running: running === 'true',
    });

    return res.json(entries);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar entradas' });
  }
}

// ── Summary ──────────────────────────────────────────────────────────

export async function getSummary(req: AuthRequest, res: Response) {
  try {
    const { usuarioId, from, to } = req.query as Record<string, string>;
    const summary = await svc.getSummary({ usuarioId, from, to });
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao gerar resumo' });
  }
}

// ── Sync order hours ─────────────────────────────────────────────────

export async function syncOrderHours(req: AuthRequest, res: Response) {
  try {
    await svc.syncOrderHours(req.params.orderId);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao sincronizar horas da OS' });
  }
}

// ── Consumo por cliente ──────────────────────────────────────────────

export async function getConsumptionByClient(req: AuthRequest, res: Response) {
  try {
    const { clienteId, from, to } = req.query as Record<string, string>;
    const result = await svc.getConsumptionByClient({ clienteId, from, to });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao gerar consumo por cliente' });
  }
}

// ── Blocos de tempo de um ticket ─────────────────────────────────────

export async function getTicketTimeBlocks(req: AuthRequest, res: Response) {
  try {
    const blocks = await svc.getTicketTimeBlocks(req.params.ticketId);
    return res.json(blocks);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar blocos de tempo' });
  }
}
