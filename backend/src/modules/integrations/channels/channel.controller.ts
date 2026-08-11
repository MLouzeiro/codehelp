import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import * as channelService from './channel.service';

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listChannels(req: AuthRequest, res: Response) {
  try {
    const includeInativos = req.query.includeInativos === 'true';
    const tipo = req.query.tipo as string | undefined;
    const channels = await channelService.listChannels(includeInativos, tipo);
    return res.json(channels);
  } catch (err: any) {
    console.error('[Channel] Erro ao listar:', err?.message);
    return res.status(500).json({ error: 'Erro ao listar canais' });
  }
}

export async function getChannel(req: AuthRequest, res: Response) {
  try {
    const channel = await channelService.getChannelById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal nao encontrado' });
    return res.json(channel);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar canal' });
  }
}

export async function createChannel(req: AuthRequest, res: Response) {
  try {
    const channel = await channelService.createChannel(req.body);
    return res.status(201).json(channel);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao criar canal' });
  }
}

export async function updateChannel(req: AuthRequest, res: Response) {
  try {
    const channel = await channelService.updateChannel(req.params.id, req.body);
    if (!channel) return res.status(404).json({ error: 'Canal nao encontrado' });
    return res.json(channel);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar canal' });
  }
}

export async function toggleChannel(req: AuthRequest, res: Response) {
  try {
    const channel = await channelService.toggleChannel(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Canal nao encontrado' });
    return res.json(channel);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao alternar status do canal' });
  }
}

export async function deleteChannel(req: AuthRequest, res: Response) {
  try {
    const deleted = await channelService.deleteChannel(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Canal nao encontrado' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao excluir canal' });
  }
}

// ── STATS ─────────────────────────────────────────────────────────────

export async function getChannelStats(req: AuthRequest, res: Response) {
  try {
    const stats = await channelService.getChannelStats(req.params.id);
    if (!stats) return res.status(404).json({ error: 'Canal nao encontrado' });
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar estatisticas' });
  }
}

// ── TYPES ─────────────────────────────────────────────────────────────

export async function getChannelTypes(_req: AuthRequest, res: Response) {
  try {
    const types = await channelService.getAllChannelTypes();
    return res.json(types);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar tipos de canal' });
  }
}

// ── RISK LOGS ─────────────────────────────────────────────────────────

export async function getRiskLogs(req: AuthRequest, res: Response) {
  try {
    const logs = await channelService.getRiskLogs(req.params.id);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar logs de risco' });
  }
}

export async function createRiskLog(req: AuthRequest, res: Response) {
  try {
    const { tipo, mensagem, severidade } = req.body;
    if (!tipo || !mensagem) {
      return res.status(400).json({ error: 'tipo e mensagem sao obrigatorios' });
    }
    const log = await channelService.createRiskLog(req.params.id, tipo, mensagem, severidade);
    return res.status(201).json(log);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Erro ao criar log de risco' });
  }
}

export async function resolveRiskLog(req: AuthRequest, res: Response) {
  try {
    const log = await channelService.resolveRiskLog(req.params.logId);
    return res.json(log);
  } catch (err: any) {
    return res.status(400).json({ error: 'Erro ao resolver log de risco' });
  }
}

// ── BY DEPARTAMENTO ───────────────────────────────────────────────────

export async function getChannelsByDepartamento(req: AuthRequest, res: Response) {
  try {
    const channels = await channelService.getChannelsByDepartamento(req.params.departamentoId);
    return res.json(channels);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar canais do departamento' });
  }
}
