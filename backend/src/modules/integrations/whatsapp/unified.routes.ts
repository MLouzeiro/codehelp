import { Router, Request, Response } from 'express';
import { unifiedWhatsAppService, WhatsAppProvider } from './unified-whatsapp.service';
import prisma from '../../../config/database';

const router = Router();

// ── Unified WhatsApp Routes ───────────────────────────────────────────

// Get all providers status
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const statuses = await unifiedWhatsAppService.getStatus();
    const available = unifiedWhatsAppService.getAvailableProviders();
    const active = unifiedWhatsAppService.getActiveProvider();

    res.json({
      active,
      available,
      providers: statuses,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Switch active provider
router.post('/providers/switch', (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    unifiedWhatsAppService.setActiveProvider(provider as WhatsAppProvider);
    res.json({ success: true, active: provider });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Send message (uses active provider)
router.post('/message/send', async (req: Request, res: Response) => {
  try {
    const { to, message, provider, instanceName, connectionId, ticketId } = req.body;
    const result = await unifiedWhatsAppService.sendMessage({
      to,
      message,
      provider: provider as WhatsAppProvider | undefined,
      instanceName,
      connectionId,
    });

    // Record message in DB if ticketId provided
    if (result.success && ticketId) {
      await prisma.message.create({
        data: {
          ticketId,
          fromMe: true,
          content: message,
          source: 'agent',
        },
      });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send media (uses active provider)
router.post('/message/send-media', async (req: Request, res: Response) => {
  try {
    const { to, mediaUrl, caption, provider } = req.body;
    const result = await unifiedWhatsAppService.sendMedia(
      to,
      mediaUrl,
      caption,
      provider as WhatsAppProvider | undefined,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;