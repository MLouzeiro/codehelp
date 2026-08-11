import { Router, Request, Response } from 'express';
import { baileysProviderService } from './baileys-provider.service';
import { authenticate, authorizeMaster } from '../../../shared/middleware/auth';

const router = Router();
router.use(authenticate);

// ── Baileys Provider Routes ────────────────────────────────────────────
// Lightweight, no Chrome/Puppeteer needed — WebSocket direct connection

// Get Baileys status (legacy single-connection)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const connected = baileysProviderService.isLegacyConnected();
    const qrCode = baileysProviderService.getLegacyQrCode();
    const error = baileysProviderService.getLegacyError();

    res.json({
      provider: 'baileys',
      connected,
      qrCode,
      error,
      configured: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Connect (legacy single-connection)
router.post('/connect', authorizeMaster, async (_req: Request, res: Response) => {
  try {
    if (baileysProviderService.isLegacyConnected()) {
      return res.json({ message: 'Baileys já conectado', connected: true });
    }

    // Start connection in background
    baileysProviderService.connectLegacy().catch(console.error);

    res.json({ 
      message: 'Conexão Baileys iniciada. Aguardando QR Code...',
      connected: false,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect (legacy single-connection)
router.post('/disconnect', authorizeMaster, async (_req: Request, res: Response) => {
  try {
    await baileysProviderService.disconnectLegacy();
    res.json({ message: 'Baileys desconectado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get QR Code (legacy)
router.get('/qrcode', async (_req: Request, res: Response) => {
  try {
    const qrCode = baileysProviderService.getLegacyQrCode();
    const connected = baileysProviderService.isLegacyConnected();

    if (connected) {
      return res.json({ qrCode: null, message: 'Já conectado', connected: true });
    }
    if (qrCode) {
      return res.json({ qrCode, message: 'Escaneie o QR Code', connected: false });
    }
    return res.json({ qrCode: null, message: 'QR Code ainda não gerado. Aguarde...', connected: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Multi-connection endpoints ────────────────────────────────────────

// Connect multi-connection (fire-and-forget — QR gera em background)
router.post('/multi/:connectionId/connect', authorizeMaster, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    // Start connection in background, return immediately
    baileysProviderService.connectMulti(connectionId).catch((err) => {
      console.error(`[Baileys] Erro na conexao multi ${connectionId}:`, err);
    });
    res.json({ message: 'Conexao Baileys iniciada. Aguardando QR Code...', connected: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect multi-connection
router.post('/multi/:connectionId/disconnect', authorizeMaster, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    await baileysProviderService.disconnectMulti(connectionId);
    res.json({ message: `Baileys ${connectionId} desconectado` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get multi-connection status
router.get('/multi/:connectionId/status', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const state = baileysProviderService.getMultiState(connectionId);
    const hasQr = !!state?.qrCode;
    if (hasQr) {
      console.log(`[Baileys Status] Poll de ${connectionId}: QR disponivel (${state!.qrCode!.length} chars)`);
    }
    res.json({
      connected: state?.connected || false,
      qrCode: state?.qrCode || null,
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
    console.log(`[Baileys Send] connectionId=${connectionId}, to=${to}, msgLen=${message?.length}`);
    const state = baileysProviderService.getMultiState(connectionId);
    console.log(`[Baileys Send] state: connected=${state?.connected}, hasSocket=${!!state?.socket}`);
    const result = await baileysProviderService.sendTextMulti(connectionId, to, message);
    console.log(`[Baileys Send] result:`, JSON.stringify(result));
    res.json(result);
  } catch (error: any) {
    console.error(`[Baileys Send] CATCH error:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
