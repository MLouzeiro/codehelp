import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import * as emailService from './email.service';

export async function sendEmail(req: AuthRequest, res: Response) {
  try {
    const { channelId, to, subject, text, html, ticketId, inReplyTo, references } = req.body;

    if (!channelId || !to || !subject) {
      return res.status(400).json({ error: 'channelId, to e subject sao obrigatorios' });
    }

    const result = await emailService.sendEmail({
      channelId,
      to,
      subject,
      text,
      html,
      ticketId,
      inReplyTo,
      references,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[Email] Erro ao enviar:', err.message);
    return res.status(500).json({ error: err.message || 'Erro ao enviar email' });
  }
}

export async function fetchEmails(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const { lastSync } = req.query;

    const lastSyncDate = lastSync ? new Date(lastSync as string) : undefined;
    const emails = await emailService.fetchEmails(channelId, lastSyncDate);

    return res.json({ emails, count: emails.length });
  } catch (err: any) {
    console.error('[Email] Erro ao buscar:', err.message);
    return res.status(500).json({ error: err.message || 'Erro ao buscar emails' });
  }
}

export async function testConnection(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const result = await emailService.testConnection(channelId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao testar conexao' });
  }
}

export async function getConfig(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const config = await emailService.getEmailConfig(channelId);
    if (!config) {
      return res.status(404).json({ error: 'Configuracao nao encontrada' });
    }

    // Return config without password
    const { password, ...safeConfig } = config;
    return res.json(safeConfig);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar configuracao' });
  }
}
