import { Request, Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import * as facebookService from './facebook.service';

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { channelId, recipientId, text, mediaUrl, mediaType, ticketId } = req.body;

    if (!channelId || !recipientId) {
      return res.status(400).json({ error: 'channelId e recipientId sao obrigatorios' });
    }

    const result = await facebookService.sendFacebookMessage({
      channelId,
      recipientId,
      text,
      mediaUrl,
      mediaType,
      ticketId,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[Facebook] Erro ao enviar:', err.message);
    return res.status(500).json({ error: err.message || 'Erro ao enviar mensagem' });
  }
}

export async function verifyWebhook(req: Request, res: Response) {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = await facebookService.verifyWebhook(mode, token, challenge);
    if (result) {
      return res.status(200).send(result);
    }
    return res.status(403).json({ error: 'Verificacao falhou' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao verificar webhook' });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const channelId = (req.params as any).channelId;
    await facebookService.handleWebhook(req.body, channelId);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[Facebook] Erro no webhook:', err.message);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}

export async function testConnection(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const result = await facebookService.testConnection(channelId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao testar conexao' });
  }
}

export async function getPageInfo(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const info = await facebookService.getPageInfo(channelId);
    if (!info) {
      return res.status(404).json({ error: 'Informacoes da pagina nao encontradas' });
    }
    return res.json(info);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar informacoes da pagina' });
  }
}
