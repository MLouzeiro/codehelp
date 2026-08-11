import { Router, Request, Response } from 'express';
import { whatsappWebJSProviderService } from './whatsapp-webjs.service';
import { authenticate, authorizeMaster } from '../../../shared/middleware/auth';

const router = Router();
router.use(authenticate);

// ── WhatsAppWebJS Provider Routes ────────────────────────────────────
// Provider opcional baseado em Puppeteer/Chrome

// Get WhatsAppWebJS status (legacy single-connection)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const allStates = whatsappWebJSProviderService.getAllMultiStates();
    let connected = false;
    let error: string | null = null;

    for (const [, state] of allStates) {
      if (state.connected) { connected = true; break; }
      if (state.error) { error = state.error; break; }
    }

    res.json({
      provider: 'whatsapp-webjs',
      connected,
      error,
      configured: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Multi-connection endpoints ────────────────────────────────────────

// Connect multi-connection
router.post('/multi/:connectionId/connect', authorizeMaster, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    whatsappWebJSProviderService.connectMulti(connectionId).catch((err) => {
      console.error(`[WhatsAppWebJS] Erro na conexao multi ${connectionId}:`, err);
    });
    res.json({ message: 'WhatsAppWebJS connection iniciada. Aguardando QR Code...', connected: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect multi-connection
router.post('/multi/:connectionId/disconnect', authorizeMaster, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    await whatsappWebJSProviderService.disconnectMulti(connectionId);
    res.json({ message: `WhatsAppWebJS ${connectionId} desconectado` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get multi-connection status
router.get('/multi/:connectionId/status', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const state = whatsappWebJSProviderService.getMultiState(connectionId);
    const hasQr = !!state?.qrCode;
    if (hasQr) {
      console.log(`[WhatsAppWebJS Status] Poll de ${connectionId}: QR disponivel`);
    }
    res.json({
      connected: state?.connected || false,
      qrCode: state?.qrCodeDataUrl || state?.qrCode || null,
      error: state?.error || null,
      reconnectAttempts: state?.reconnectAttempts || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send message via multi-connection
router.post('/multi/:connectionId/send', authorizeMaster, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { to, message } = req.body;
    const result = await whatsappWebJSProviderService.sendTextMulti(connectionId, to, message);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clean session
router.post('/multi/:connectionId/clean', authorizeMaster, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    whatsappWebJSProviderService.cleanSession(connectionId);
    res.json({ message: `Sessao WhatsAppWebJS ${connectionId} limpa` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
