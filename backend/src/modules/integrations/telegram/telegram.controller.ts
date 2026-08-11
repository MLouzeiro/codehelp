import { Request, Response } from 'express';
import * as telegramService from './telegram.service';

export async function handleWebhook(req: Request, res: Response) {
  try {
    const { channelId } = req.params;
    await telegramService.handleWebhook(req.body, channelId);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram] Erro no webhook:', error.message);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const { channelId } = req.params;
    const result = await telegramService.testConnection(channelId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao testar conexao' });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const { channelId } = req.params;
    const { chatId, text, mediaUrl, mediaType, ticketId } = req.body;

    if (!chatId || (!text && !mediaUrl)) {
      return res.status(400).json({ error: 'chatId e text/mediaUrl sao obrigatorios' });
    }

    const result = await telegramService.sendTelegramMessage({
      channelId,
      chatId,
      text,
      mediaUrl,
      mediaType,
      ticketId,
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao enviar mensagem' });
  }
}

export async function setWebhook(req: Request, res: Response) {
  try {
    const { channelId } = req.params;
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl e obrigatorio' });
    }

    const result = await telegramService.setWebhook(channelId, webhookUrl);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao configurar webhook' });
  }
}

export async function deleteWebhook(req: Request, res: Response) {
  try {
    const { channelId } = req.params;
    const result = await telegramService.deleteWebhook(channelId);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao remover webhook' });
  }
}
