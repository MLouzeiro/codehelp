import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../../../config/database';
import { processIncomingMessageHandler } from './whatsapp-message-handler';
import { normalizePhone } from './whatsapp-utils';

// ── WhatsApp Web.js Provider (Puppeteer-based) ─────────────────────────
// Provider opcional baseado em Puppeteer/Chrome
// Risco: pode dar ban por violar termos de uso do WhatsApp

const SESSION_BASE_DIR = path.resolve(process.env.WHATSAPP_SESSION_PATH || './whatsapp-session', 'whatsapp-webjs');
const MAX_RECONNECT = 10;

// Chrome/DevTools has a path length limit. Long clientIds cause "Execution context was destroyed".
// We hash long IDs to short stable strings (16 chars max).
function shortSessionId(connectionId: string): string {
  if (connectionId.length <= 16) return connectionId;
  const hash = crypto.createHash('md5').update(connectionId).digest('hex').slice(0, 16);
  return `wa-${hash}`;
}

interface WhatsAppWebJSConnectionState {
  client: Client | null;
  connected: boolean;
  qrCode: string | null;
  qrCodeDataUrl: string | null;
  error: string | null;
  reconnectAttempts: number;
  lastMessageAt: Date | null;
  sessionId: string;
}

class WhatsAppWebJSProviderService {
  private connections: Map<string, WhatsAppWebJSConnectionState> = new Map();

  // ── Auto-reconnect all active WhatsAppWebJS connections on startup ─
  async reconnectAllActive(): Promise<void> {
    try {
      const activeConnections = await prisma.whatsAppConnection.findMany({
        where: { ativo: true, provider: 'whatsapp-webjs' },
        select: { id: true, nome: true },
      });

      if (activeConnections.length === 0) {
        console.log('[WhatsAppWebJS] Nenhuma conexao WhatsAppWebJS ativa para reconectar no startup');
        return;
      }

      console.log(`[WhatsAppWebJS] Reconectando ${activeConnections.length} conexao(oes) WhatsAppWebJS ativa(s) no startup...`);

      for (const conn of activeConnections) {
        const shortId = shortSessionId(conn.id);
        const sessionDir = path.join(SESSION_BASE_DIR, `session-${shortId}`);
        if (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0) {
          console.log(`[WhatsAppWebJS] Reconectando "${conn.nome}" (${conn.id})...`);
          this.connectMulti(conn.id).catch((err) => {
            console.error(`[WhatsAppWebJS] Falha ao reconectar "${conn.nome}":`, err?.message || err);
          });
        } else {
          console.log(`[WhatsAppWebJS] Pulando "${conn.nome}" — sem sessao salva`);
        }
      }
    } catch (err: any) {
      console.error('[WhatsAppWebJS] Erro ao listar conexoes para reconexao:', err?.message || err);
    }
  }

  // ── Multi-connection API ──────────────────────────────────────────

  async connectMulti(connectionId: string): Promise<{ qrCode?: string; connected: boolean; error?: string }> {
    let state = this.connections.get(connectionId);
    if (!state) {
      state = {
        client: null,
        connected: false,
        qrCode: null,
        qrCodeDataUrl: null,
        error: null,
        reconnectAttempts: 0,
        lastMessageAt: null,
        sessionId: connectionId,
      };
      this.connections.set(connectionId, state);
    }

    // Clean up existing client if any
    if (state.client) {
      try { await state.client.destroy(); } catch {}
      state.client = null;
      state.connected = false;
    }

    if (state.connected && state.client) {
      return { connected: true };
    }

    // CRITICAL: Disconnect Baileys first — WhatsApp only allows ONE web session per number
    try {
      const { baileysProviderService } = await import('./baileys-provider.service');
      const baileysState = baileysProviderService.getMultiState(connectionId);
      if (baileysState?.connected) {
        console.log(`[WhatsAppWebJS ${connectionId}] Desconectando Baileys antes de conectar WhatsAppWebJS...`);
        await baileysProviderService.disconnectMulti(connectionId);
        await new Promise(r => setTimeout(r, 2000)); // Wait for cleanup
      }
    } catch (err: any) {
      console.log(`[WhatsAppWebJS ${connectionId}] Aviso ao desconectar Baileys:`, err?.message);
    }

    return new Promise((resolve) => {
      this.connectSession(connectionId, state!, (qr) => {
        resolve({ qrCode: qr, connected: false });
      }, () => {
        resolve({ connected: true });
      }, (error) => {
        resolve({ connected: false, error });
      });
    });
  }

  async disconnectMulti(connectionId: string): Promise<void> {
    const state = this.connections.get(connectionId);
    if (state?.client) {
      try { await state.client.destroy(); } catch {}
      state.client = null;
    }
    if (state) {
      state.connected = false;
      state.qrCode = null;
      state.qrCodeDataUrl = null;
      state.error = null;
      state.reconnectAttempts = 0;
    }
  }

  getMultiState(connectionId: string): WhatsAppWebJSConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  getAllMultiStates(): Map<string, WhatsAppWebJSConnectionState> {
    return this.connections;
  }

  cleanSession(connectionId: string): void {
    const shortId = shortSessionId(connectionId);
    const sessionDir = path.join(SESSION_BASE_DIR, `session-${shortId}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[WhatsAppWebJS] Session cleaned for ${connectionId}`);
      }
    } catch (err: any) {
      console.error(`[WhatsAppWebJS] Error cleaning session for ${connectionId}:`, err?.message);
    }
  }

  async sendTextMulti(connectionId: string, to: string, text: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const state = this.connections.get(connectionId);
    if (!state?.client || !state.connected) {
      console.error(`[WhatsAppWebJS] Tentativa de envio para ${connectionId} mas nao conectado (client: ${!!state?.client}, connected: ${state?.connected})`);
      return { success: false, error: `WhatsAppWebJS connection ${connectionId} não conectado` };
    }
    console.log(`[WhatsAppWebJS] Enviando mensagem para ${to} via ${connectionId}`);
    return this.sendText(state.client, to, text);
  }

  // ── Core connection logic ─────────────────────────────────────────

  private async connectSession(
    sessionId: string,
    state: WhatsAppWebJSConnectionState,
    onQr?: (qr: string) => void,
    onConnected?: () => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    // Chrome DevTools path length limit: use short stable ID for LocalAuth
    const shortId = shortSessionId(sessionId);

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: shortId,
        dataPath: SESSION_BASE_DIR,
      }),
      puppeteer: {
        headless: 'shell' as any,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      },
    });

    state.client = client;

    client.on('qr', async (qr) => {
      state.qrCode = qr;
      state.error = null;
      try {
        state.qrCodeDataUrl = await qrcode.toDataURL(qr, { width: 256 });
      } catch {}
      console.log(`[WhatsAppWebJS ${sessionId}] QR Code gerado. Enviando para frontend...`);
      onQr?.(qr);
    });

    client.on('ready', () => {
      state.connected = true;
      state.qrCode = null;
      state.qrCodeDataUrl = null;
      state.error = null;
      state.reconnectAttempts = 0;
      console.log(`[WhatsAppWebJS ${sessionId}] Conectado com sucesso!`);
      onConnected?.();
    });

    client.on('disconnected', (reason) => {
      console.log(`[WhatsAppWebJS ${sessionId}] Desconectado: ${reason}`);
      state.connected = false;
      state.qrCode = null;
      state.qrCodeDataUrl = null;

      const reasonStr = String(reason);
      if (reasonStr === 'LOGGED_OUT') {
        state.error = 'Deslogado do WhatsApp. Escaneie novamente.';
        this.cleanSession(sessionId);
        onError?.(state.error);
      } else if (state.reconnectAttempts < MAX_RECONNECT) {
        state.reconnectAttempts++;
        const delay = Math.min(5000 * Math.pow(2, state.reconnectAttempts - 1), 60000);
        console.log(`[WhatsAppWebJS ${sessionId}] Reconectando em ${delay / 1000}s (tentativa ${state.reconnectAttempts})`);
        setTimeout(() => {
          this.connectSession(sessionId, state, onQr, onConnected, onError);
        }, delay);
      } else {
        state.error = `Falha apos ${MAX_RECONNECT} tentativas. Tente novamente.`;
        onError?.(state.error);
      }
    });

    client.on('message', async (msg) => {
      try {
        await this.processIncomingMessage(msg, sessionId, client);
      } catch (err) {
        console.error(`[WhatsAppWebJS ${sessionId}] Erro processando mensagem:`, err);
      }
    });

    try {
      await client.initialize();
    } catch (err: any) {
      const errMsg = err?.message || 'Erro ao inicializar WhatsAppWebJS';
      console.error(`[WhatsAppWebJS ${sessionId}] Erro ao inicializar:`, errMsg);
      
      // Clean up on error
      try { await client.destroy(); } catch {}
      state.client = null;
      
      // Handle specific Puppeteer errors
      if (errMsg.includes('Execution context was destroyed') || errMsg.includes('Protocol error') || errMsg.includes('browser is already running')) {
        console.log(`[WhatsAppWebJS ${sessionId}] Erro de Puppeteer detectado. Tentando reiniciar em 5s...`);
        state.reconnectAttempts++;
        if (state.reconnectAttempts < 3) {
          setTimeout(() => {
            this.connectSession(sessionId, state, onQr, onConnected, onError);
          }, 5000);
          return;
        }
      }
      
      state.error = errMsg;
      state.connected = false;
      onError?.(state.error || 'Erro desconhecido');
    }
  }

  // ── Message processing ────────────────────────────────────────────

  private async processIncomingMessage(
    msg: any,
    sessionId: string,
    client: Client,
  ): Promise<void> {
    if (!msg.body) return;
    if (msg.fromMe) return;
    if (msg.isStatus) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const phone = msg.author || msg.from;
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      console.warn(`[WhatsAppWebJS ${sessionId}] Mensagem ignorada — telefone "${phoneDigits}" invalido`);
      return;
    }

    const contact = await msg.getContact();
    const contactName = contact.pushname || contact.name || phoneDigits;

    let mediaUrl: string | null = null;
    let mimeType: string | null = null;

    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          mimeType = media.mimetype;
          mediaUrl = `data:${media.mimetype};base64,${media.data}`;
        }
      } catch {}
    }

    const sendFn = async (to: string, message: string) => {
      try {
        const chatId = normalizePhone(to) + '@c.us';
        await client.sendMessage(chatId, message);
        return { success: true };
      } catch (err: any) {
        console.error(`[WhatsAppWebJS] Erro ao enviar:`, err?.message);
        return { success: false, error: err?.message };
      }
    };

    await processIncomingMessageHandler(
      {
        phone: phoneDigits,
        text: msg.body,
        contactName,
        mediaUrl,
        mimeType,
        connectionId: sessionId,
        provider: 'whatsapp-webjs',
      },
      sendFn,
    );
  }

  // ── Send text message ─────────────────────────────────────────────

  private async sendText(
    client: Client,
    to: string,
    text: string,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const phone = normalizePhone(to);
      if (phone.length < 10 || phone.length > 15) {
        return { success: false, error: `Telefone invalido: "${phone}" (${phone.length} digitos).` };
      }
      const chatId = `${phone}@c.us`;
      const result = await client.sendMessage(chatId, text);
      return {
        success: true,
        messageId: result.id?.id || undefined,
      };
    } catch (error: any) {
      console.error('[WhatsAppWebJS] Erro ao enviar mensagem:', error);
      return { success: false, error: error.message };
    }
  }

  // ── Send media message ────────────────────────────────────────────

  async sendMedia(
    client: Client,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const phone = normalizePhone(to);
      const chatId = `${phone}@c.us`;

      if (mediaUrl.startsWith('data:')) {
        const matches = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const media = new MessageMedia(mimeType, base64Data, 'arquivo');
          await client.sendMessage(chatId, media, { caption: caption || '' });
          return { success: true };
        }
      }

      // If it's a URL, fetch and create media
      const response = await fetch(mediaUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const media = new MessageMedia(contentType, buffer.toString('base64'), 'arquivo');
      await client.sendMessage(chatId, media, { caption: caption || '' });
      return { success: true };
    } catch (error: any) {
      console.error('[WhatsAppWebJS] Erro ao enviar midia:', error);
      return { success: false, error: error.message };
    }
  }
}

export const whatsappWebJSProviderService = new WhatsAppWebJSProviderService();
export { WhatsAppWebJSProviderService };
