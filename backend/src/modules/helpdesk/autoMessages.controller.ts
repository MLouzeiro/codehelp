import { Request, Response } from 'express';
import { listAutoMessages, updateAutoMessage, resetAutoMessage } from './autoMessages.service';

interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export async function listAutoMessagesHandler(req: AuthRequest, res: Response) {
  try {
    const messages = await listAutoMessages();
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar mensagens' });
  }
}

export async function updateAutoMessageHandler(req: AuthRequest, res: Response) {
  try {
    const { slug } = req.params;
    const { mensagem } = req.body;
    if (!mensagem) return res.status(400).json({ error: 'mensagem é obrigatória' });
    await updateAutoMessage(slug, mensagem);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao atualizar mensagem' });
  }
}

export async function resetAutoMessageHandler(req: AuthRequest, res: Response) {
  try {
    const { slug } = req.params;
    await resetAutoMessage(slug);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao resetar mensagem' });
  }
}
