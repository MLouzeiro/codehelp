import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { whatsappCloudAPIService } from './cloud-api.service';
import { unifiedWhatsAppService } from './unified-whatsapp.service';
import { env } from '../../../config/env';

function verifyCloudWebhookSignature(req: Request): boolean {
  const appSecret = env.whatsappCloudAppSecret;
  if (!appSecret) {
    console.warn('[Cloud Webhook] WHATSAPP_CLOUD_APP_SECRET nao configurado — webhook sem validacao HMAC');
    return true; // fallback: aceitar se secret nao configurado (dev)
  }
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const router = Router();

// ── WhatsApp Cloud API Routes ─────────────────────────────────────────

// Get Cloud API status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const healthy = await whatsappCloudAPIService.checkHealth();
    const phoneInfo = await whatsappCloudAPIService.getPhoneNumberInfo();

    res.json({
      healthy,
      configured: !!(env.whatsappCloudPhoneNumberId && env.whatsappCloudAccessToken),
      phoneNumber: phoneInfo,
    });
  } catch (error: any) {
    console.error('[Cloud API] Status error:', error?.message);
    res.status(500).json({ error: 'Erro ao verificar status do Cloud API' });
  }
});

// Send message via Cloud API
router.post('/message/send', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;
    const result = await whatsappCloudAPIService.sendTextMessage(to, message);
    res.json(result);
  } catch (error: any) {
    console.error('[Cloud API] Send error:', error?.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem via Cloud API' });
  }
});

// Send image via Cloud API
router.post('/message/send-image', async (req: Request, res: Response) => {
  try {
    const { to, imageUrl, caption } = req.body;
    const result = await whatsappCloudAPIService.sendImageMessage(to, imageUrl, caption);
    res.json(result);
  } catch (error: any) {
    console.error('[Cloud API] Send image error:', error?.message);
    res.status(500).json({ error: 'Erro ao enviar imagem via Cloud API' });
  }
});

// Send document via Cloud API
router.post('/message/send-document', async (req: Request, res: Response) => {
  try {
    const { to, documentUrl, fileName, caption } = req.body;
    const result = await whatsappCloudAPIService.sendDocumentMessage(to, documentUrl, fileName, caption);
    res.json(result);
  } catch (error: any) {
    console.error('[Cloud API] Send document error:', error?.message);
    res.status(500).json({ error: 'Erro ao enviar documento via Cloud API' });
  }
});

// Webhook verification (GET)
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const result = unifiedWhatsAppService.verifyCloudWebhook(mode, token, challenge);
  if (result) {
    res.send(result);
  } else {
    res.sendStatus(403);
  }
});

// Webhook receiver (POST) — com validacao HMAC-SHA256
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    if (!verifyCloudWebhookSignature(req)) {
      console.warn('[Cloud Webhook] Assinatura HMAC invalida — requisicao rejeitada');
      return res.sendStatus(403);
    }
    await unifiedWhatsAppService.handleCloudWebhook(req.body);
    res.sendStatus(200);
  } catch (error: any) {
    console.error('[Cloud Webhook] Error:', error);
    res.sendStatus(200); // Always return 200 for webhooks
  }
});

export default router;