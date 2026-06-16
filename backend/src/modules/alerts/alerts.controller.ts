import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { sendWeeklyAlert } from './alerts.service';
import {
  getAlertConfigs,
  saveAlertConfigs,
  getAlertasNaoLidos,
  getResumoAlertas,
} from './alerts.service';

export async function listRecipients(req: AuthRequest, res: Response) {
  try {
    const recipients = await prisma.alertRecipient.findMany({ orderBy: { nome: 'asc' } });
    return res.json(recipients);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar destinatários' });
  }
}

export async function addRecipient(req: AuthRequest, res: Response) {
  try {
    const { nome, whatsapp, cargo, ativo } = req.body;
    if (!nome || !whatsapp) return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios' });
    const recipient = await prisma.alertRecipient.create({
      data: { nome, whatsapp, cargo, ativo: ativo !== undefined ? ativo : true },
    });
    return res.status(201).json(recipient);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao adicionar destinatário' });
  }
}

export async function updateRecipient(req: AuthRequest, res: Response) {
  try {
    const recipient = await prisma.alertRecipient.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return res.json(recipient);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar destinatário' });
  }
}

export async function deleteRecipient(req: AuthRequest, res: Response) {
  try {
    await prisma.alertRecipient.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar destinatário' });
  }
}

export async function listHistory(req: AuthRequest, res: Response) {
  try {
    const history = await prisma.alertHistory.findMany({
      orderBy: { enviadoEm: 'desc' },
      take: 50,
    });
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar histórico' });
  }
}

export async function triggerNow(req: AuthRequest, res: Response) {
  try {
    await sendWeeklyAlert();
    return res.json({ message: 'Alerta semanal disparado com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao disparar alerta' });
  }
}

export async function getConfigHandler(req: AuthRequest, res: Response) {
  try {
    const configs = await getAlertConfigs(req.user!.id);
    res.json(configs);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao carregar configurações' });
  }
}

export async function saveConfigHandler(req: AuthRequest, res: Response) {
  try {
    const { configs } = req.body;
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'configs deve ser um array' });
    }
    await saveAlertConfigs(req.user!.id, configs);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Alerts] Erro ao salvar config:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar configurações' });
  }
}

export async function getNaoLidosHandler(req: AuthRequest, res: Response) {
  try {
    const count = await getAlertasNaoLidos(req.user!.id);
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao contar alertas' });
  }
}

export async function getResumoHandler(req: AuthRequest, res: Response) {
  try {
    const resumo = await getResumoAlertas(req.user!.id);
    res.json(resumo);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao gerar resumo' });
  }
}
