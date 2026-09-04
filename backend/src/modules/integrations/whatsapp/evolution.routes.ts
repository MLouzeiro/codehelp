import { Router, Request, Response } from 'express';
import { evolutionApiService } from './evolution-api.service';
import { unifiedWhatsAppService } from './unified-whatsapp.service';
import { env } from '../../../config/env';

const router = Router();

// ── Evolution API Routes ──────────────────────────────────────────────

// Get Evolution API status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const healthy = await evolutionApiService.checkHealth();
    const instances = await evolutionApiService.listInstances();

    res.json({
      healthy,
      instances,
      configured: !!env.evolutionApiUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new instance
router.post('/instance/create', async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.body;
    const instance = await evolutionApiService.createInstance(instanceName);
    res.json(instance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Connect instance (get QR code)
router.get('/instance/connect/:instanceName', async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const result = await evolutionApiService.connectInstance(instanceName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect instance
router.delete('/instance/disconnect/:instanceName', async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    await evolutionApiService.disconnectInstance(instanceName);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete instance
router.delete('/instance/delete/:instanceName', async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    await evolutionApiService.deleteInstance(instanceName);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get connection state
router.get('/instance/state/:instanceName', async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const state = await evolutionApiService.getConnectionState(instanceName);
    res.json({ state });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send message via Evolution API
router.post('/message/send', async (req: Request, res: Response) => {
  try {
    const { to, message, instanceName } = req.body;
    const result = await evolutionApiService.sendMessage(to, message, instanceName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook receiver for Evolution API — com validacao de secret
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookSecret = env.evolutionWebhookSecret;
    if (webhookSecret) {
      const reqSecret = (req.query.apikey as string) || (req.headers['x-evolution-api-key'] as string) || '';
      if (reqSecret !== webhookSecret) {
        console.warn('[Evolution Webhook] Secret invalido — requisicao rejeitada');
        return res.sendStatus(403);
      }
    }
    await unifiedWhatsAppService.handleEvolutionWebhook(req.body);
    res.sendStatus(200);
  } catch (error: any) {
    console.error('[Evolution Webhook] Error:', error);
    res.sendStatus(200); // Always return 200 for webhooks
  }
});

export default router;