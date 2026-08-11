import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import * as channelMessageHandler from './channel-message.handler';

const router = Router();

router.use(authenticate);

// ── Messages ──────────────────────────────────────────────────────────
router.get('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { ticketId, limit, offset } = req.query;

    const result = await channelMessageHandler.getChannelMessages(
      channelId,
      ticketId as string,
      parseInt(limit as string) || 50,
      parseInt(offset as string) || 0
    );

    return res.json(result);
  } catch (err: any) {
    console.error('[ChannelMessage] Erro ao buscar mensagens:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

router.post('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { ticketId, content, mediaUrl } = req.body;

    if (!ticketId || !content) {
      return res.status(400).json({ error: 'ticketId e content sao obrigatorios' });
    }

    const result = await channelMessageHandler.sendMessage(channelId, ticketId, content, mediaUrl);
    return res.json(result);
  } catch (err: any) {
    console.error('[ChannelMessage] Erro ao enviar mensagem:', err.message);
    return res.status(500).json({ error: err.message || 'Erro ao enviar mensagem' });
  }
});

router.patch('/:channelId/messages/:messageId/status', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status e obrigatorio' });
    }

    const result = await channelMessageHandler.updateMessageStatus(messageId, status);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: 'Erro ao atualizar status' });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────
router.get('/:channelId/stats', async (req, res) => {
  try {
    const { channelId } = req.params;
    const stats = await channelMessageHandler.getChannelStats(channelId);
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar estatisticas' });
  }
});

export default router;
