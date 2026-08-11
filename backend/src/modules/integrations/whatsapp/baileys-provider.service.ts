import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  downloadMediaMessage,
  getContentType,
  jidNormalizedUser,
  jidDecode,
  isJidGroup,
  isJidBroadcast,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { env } from '../../../config/env';
import { processIncomingMessageHandler } from './whatsapp-message-handler';

const SESSION_BASE_DIR = path.resolve(env.whatsappSessionPath || './whatsapp-session', 'baileys');
const MAX_RECONNECT = 10;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;
const PERIODIC_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const logger = pino({ level: 'silent' });

interface ConnectionState {
  socket: WASocket | null;
  connected: boolean;
  connecting: boolean;
  qrCode: string | null;
  error: string | null;
  reconnectAttempts: number;
  lastMessageAt: Date | null;
  manualDisconnect: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  periodicRetryTimer: ReturnType<typeof setInterval> | null;
  sessionId: string;
  onQr?: (qr: string) => void;
  onConnected?: () => void;
  onError?: (error: string) => void;
}

function createEmptyState(sessionId: string): ConnectionState {
  return {
    socket: null,
    connected: false,
    connecting: false,
    qrCode: null,
    error: null,
    reconnectAttempts: 0,
    lastMessageAt: null,
    manualDisconnect: false,
    heartbeatTimer: null,
    periodicRetryTimer: null,
    sessionId,
  };
}

class BaileysProviderService {
  private connections: Map<string, ConnectionState> = new Map();
  private legacyState: ConnectionState = createEmptyState('legacy');

  // ── Public: Reconnect all active connections on startup ─────────────
  async reconnectAllActive(): Promise<void> {
    const { default: prisma } = await import('../../../config/database');
    const active = await prisma.whatsAppConnection.findMany({
      where: { ativo: true, provider: 'baileys' },
      select: { id: true, nome: true },
    });

    if (active.length === 0) {
      console.log('[Baileys] Nenhuma conexao ativa para reconectar');
      return;
    }

    console.log(`[Baileys] Reconectando ${active.length} conexao(oes)...`);
    for (const conn of active) {
      const sessionDir = path.join(SESSION_BASE_DIR, conn.id);
      if (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0) {
        console.log(`[Baileys] Reconectando "${conn.nome}" (${conn.id})...`);
        this.connectMulti(conn.id).catch((err) =>
          console.error(`[Baileys] Falha ao reconectar "${conn.nome}":`, err?.message)
        );
      }
    }
  }

  // ── Public: Multi-connection API ────────────────────────────────────
  async connectMulti(connectionId: string): Promise<{ qrCode?: string; connected: boolean; error?: string }> {
    let state = this.connections.get(connectionId);
    if (!state) {
      state = createEmptyState(connectionId);
      this.connections.set(connectionId, state);
    }

    if (state.connected && state.socket) {
      return { connected: true };
    }

    state.manualDisconnect = false;

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
    if (state) {
      this.stopHeartbeat(state);
      this.stopPeriodicRetry(state);
    }
    if (state?.socket) {
      try { state.socket.end(undefined); } catch {}
      state.socket = null;
    }
    if (state) {
      state.connected = false;
      state.qrCode = null;
      state.error = null;
      state.reconnectAttempts = 0;
      state.manualDisconnect = true;
    }
  }

  getMultiState(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  getAllMultiStates(): Map<string, ConnectionState> {
    return this.connections;
  }

  cleanSession(connectionId: string): void {
    const sessionDir = path.join(SESSION_BASE_DIR, connectionId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[Baileys] Sessao removida: ${connectionId}`);
      }
    } catch (err: any) {
      console.error(`[Baileys] Erro ao remover sessao:`, err?.message);
    }
  }

  // ── Private: Heartbeat to detect zombie connections ─────────────────
  private startHeartbeat(sessionId: string, state: ConnectionState): void {
    this.stopHeartbeat(state);
    state.heartbeatTimer = setInterval(async () => {
      if (!state.connected || !state.socket) {
        console.log(`[Baileys ${sessionId}] Heartbeat: conexao indisponivel, parando`);
        this.stopHeartbeat(state);
        return;
      }
      const lastMsg = state.lastMessageAt?.getTime() || 0;
      const now = Date.now();
      const elapsed = lastMsg > 0 ? Math.round((now - lastMsg) / 1000) : -1;
      const wsState = (state.socket as any)?.ws?.readyState;

      // Se nao ha mensagensregistradas ou ha actividaderecente,so ping
      if (elapsed < 0 || elapsed < HEARTBEAT_TIMEOUT_MS) {
        try {
          const ws = (state.socket as any)?.ws;
          if (ws?.readyState === 1 && typeof ws.ping === 'function') {
            ws.ping();
          }
        } catch {}
        return;
      }

      // Se WS nao esta OPEN, reconectar imediatamente
      if (wsState !== 1) {
        console.warn(`[Baileys ${sessionId}] Heartbeat: WebSocket state=${wsState} (nao OPEN), reconectando...`);
        state.connected = false;
        try { state.socket?.end(undefined); } catch {}
        state.socket = null;
        this.stopHeartbeat(state);
        state.reconnectAttempts = 0;
        this.connectSession(sessionId, state, state.onQr, state.onConnected, state.onError);
        return;
      }

      // Se ultima mensagemha muito tempo (5 min) mesmo com WS OPEN, forcar reconexao
      const SILENT_THRESHOLD_MS = 5 * 60 * 1000;
      if (elapsed * 1000 > SILENT_THRESHOLD_MS) {
        console.warn(`[Baileys ${sessionId}] Heartbeat: sem atividade por ${elapsed}s com WS OPEN, reconectando...`);
        state.connected = false;
        try { state.socket?.end(undefined); } catch {}
        state.socket = null;
        this.stopHeartbeat(state);
        state.reconnectAttempts = 0;
        this.connectSession(sessionId, state, state.onQr, state.onConnected, state.onError);
        return;
      }

      // Ping normal
      try {
        const ws = (state.socket as any)?.ws;
        if (ws?.readyState === 1 && typeof ws.ping === 'function') {
          ws.ping();
        }
      } catch {}
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(state: ConnectionState): void {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  // ── Private: Periodic retry after reconnect exhaustion ──────────────
  private startPeriodicRetry(state: ConnectionState): void {
    this.stopPeriodicRetry(state);
    console.log(`[Baileys ${state.sessionId}] Periodic retry: tentando reconectar a cada ${PERIODIC_RETRY_INTERVAL_MS / 1000}s`);
    state.periodicRetryTimer = setInterval(async () => {
      if (state.connected || state.manualDisconnect) {
        this.stopPeriodicRetry(state);
        return;
      }
      console.log(`[Baileys ${state.sessionId}] Periodic retry: tentando reconectar...`);
      state.reconnectAttempts = 0;
      state.error = null;
      try {
        await this.connectSession(state.sessionId, state, state.onQr, state.onConnected, state.onError);
      } catch (err: any) {
        console.error(`[Baileys ${state.sessionId}] Periodic retry: falha —`, err?.message || err);
      }
    }, PERIODIC_RETRY_INTERVAL_MS);
  }

  private stopPeriodicRetry(state: ConnectionState): void {
    if (state.periodicRetryTimer) {
      clearInterval(state.periodicRetryTimer);
      state.periodicRetryTimer = null;
    }
  }

  async sendTextMulti(connectionId: string, to: string, text: string, jid?: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const state = this.connections.get(connectionId);
    if (!state?.socket || !state.connected) {
      return { success: false, error: `Conexao ${connectionId} nao conectada` };
    }
    return this.sendText(state.socket, to, text, jid);
  }

  // ── Public: Legacy single-connection API ────────────────────────────
  async connectLegacy(): Promise<void> {
    if (this.legacyState.socket && this.legacyState.connected) return;
    this.legacyState.manualDisconnect = false;
    await this.connectSession('legacy', this.legacyState);
  }

  async disconnectLegacy(): Promise<void> {
    if (this.legacyState.socket) {
      try { this.legacyState.socket.end(undefined); } catch {}
      this.legacyState.socket = null;
    }
    this.legacyState.connected = false;
    this.legacyState.qrCode = null;
    this.legacyState.error = null;
    this.legacyState.reconnectAttempts = 0;
    this.legacyState.manualDisconnect = true;
    this.stopHeartbeat(this.legacyState);
    this.stopPeriodicRetry(this.legacyState);
  }

  isLegacyConnected(): boolean {
    return this.legacyState.connected;
  }

  getLegacyQrCode(): string | null {
    return this.legacyState.qrCode;
  }

  getLegacyError(): string | null {
    return this.legacyState.error;
  }

  getLegacySocket(): WASocket | null {
    return this.legacyState.socket;
  }

  async sendTextLegacy(to: string, text: string, jid?: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.legacyState.socket || !this.legacyState.connected) {
      return { success: false, error: 'Baileys nao conectado' };
    }
    return this.sendText(this.legacyState.socket, to, text, jid);
  }

  // ── Private: Core connection logic ──────────────────────────────────
  private async connectSession(
    sessionId: string,
    state: ConnectionState,
    onQr?: (qr: string) => void,
    onConnected?: () => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    state.onQr = onQr;
    state.onConnected = onConnected;
    state.onError = onError;

    const sessionDir = path.join(SESSION_BASE_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      logger,
      browser: ['CodeHelp', 'Chrome', '4.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      qrTimeout: 120_000,
      connectTimeoutMs: 60_000,
      markOnlineOnConnect: true,
    });

    state.socket = socket;

    // Save credentials when updated
    socket.ev.on('creds.update', saveCreds);

    // Handle connection state changes
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state.qrCode = qr;
        state.error = null;
        console.log(`[Baileys ${sessionId}] QR Code gerado (${qr.length} chars)`);
        onQr?.(qr);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired;

        console.log(`[Baileys ${sessionId}] Conexao fechada. Status: ${statusCode}`);
        this.stopHeartbeat(state);

        if (state.manualDisconnect) {
          console.log(`[Baileys ${sessionId}] Desconectado manualmente`);
          state.connected = false;
          state.qrCode = null;
          this.stopHeartbeat(state);
          return;
        }

        state.connected = false;
        state.qrCode = null;

        if (isLoggedOut) {
          state.error = 'Deslogado do WhatsApp. Escaneie novamente.';
          try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
          onError?.(state.error);
        } else if (statusCode === 408) {
          state.error = 'QR Code expirado. Clique em "Conectar" novamente.';
          state.reconnectAttempts = 0;
          onError?.(state.error);
        } else if (isRestartRequired) {
          state.reconnectAttempts++;
          console.log(`[Baileys ${sessionId}] Restart solicitado. Reconectando...`);
          setTimeout(() => this.connectSession(sessionId, state, onQr, onConnected, onError), 2000);
        } else if (state.reconnectAttempts < MAX_RECONNECT) {
          state.reconnectAttempts++;
          const delay = Math.min(5000 * Math.pow(2, state.reconnectAttempts - 1), 60000);
          console.log(`[Baileys ${sessionId}] Reconectando em ${delay / 1000}s (tentativa ${state.reconnectAttempts}/${MAX_RECONNECT})`);
          setTimeout(() => this.connectSession(sessionId, state, onQr, onConnected, onError), delay);
        } else {
          state.error = `Falha apos ${MAX_RECONNECT} tentativas. Tentando reconexao periodica a cada ${PERIODIC_RETRY_INTERVAL_MS / 60000}min...`;
          console.warn(`[Baileys ${sessionId}] ${state.error}`);
          onError?.(state.error);
          this.startPeriodicRetry(state);
        }
      }

      if (connection === 'open') {
        state.connected = true;
        state.qrCode = null;
        state.error = null;
        state.reconnectAttempts = 0;
        state.lastMessageAt = new Date();
        this.stopPeriodicRetry(state);
        console.log(`[Baileys ${sessionId}] Conectado com sucesso!`);
        this.startHeartbeat(sessionId, state);
        onConnected?.();
      }
    });

    // Handle incoming messages
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log(`[Baileys ${sessionId}] messages.upsert: type=${type}, count=${messages.length}`);
      if (type !== 'notify') {
        console.log(`[Baileys ${sessionId}] type="${type}" ignorado (so notify)`);
        return;
      }

      const st = this.connections.get(sessionId) || (sessionId === 'legacy' ? this.legacyState : undefined);
      if (st) st.lastMessageAt = new Date();

      for (const msg of messages) {
        try {
          const fromMe = msg.key?.fromMe;
          const remoteJid = msg.key?.remoteJid;
          const hasMsg = !!msg.message;
          console.log(`[Baileys ${sessionId}] Msg recebida: fromMe=${fromMe}, jid=${remoteJid}, hasMsg=${hasMsg}, pushName=${msg.pushName}`);
          await this.processIncomingMessage(msg, sessionId);
        } catch (err) {
          console.error(`[Baileys ${sessionId}] Erro processando mensagem:`, err);
        }
      }
    });

    // Handle message status updates
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        try {
          const messageId = update.key?.id;
          const status = update.update?.status;
          if (!messageId || status === undefined || status === null) continue;

          let dbStatus: string;
          if (status >= 4) dbStatus = 'read';
          else if (status === 3) dbStatus = 'delivered';
          else if (status === 2) dbStatus = 'sent';
          else continue;

          const { default: prisma } = await import('../../../config/database');
          await prisma.message.updateMany({
            where: { id: messageId },
            data: { status: dbStatus },
          });
        } catch {}
      }
    });
  }

  // ── Private: Process incoming message ───────────────────────────────
  private async processIncomingMessage(
    msg: proto.IWebMessageInfo,
    sessionId: string,
  ): Promise<void> {
    const remoteJid = msg.key?.remoteJid;
    if (!msg.message) {
      console.log(`[Baileys ${sessionId}] Ignorado: msg.message null`);
      return;
    }
    if (!remoteJid) {
      console.log(`[Baileys ${sessionId}] Ignorado: remoteJid null`);
      return;
    }
    if (msg.key?.fromMe) {
      console.log(`[Baileys ${sessionId}] Ignorado: fromMe=true`);
      return;
    }
    if (isJidGroup(remoteJid)) {
      console.log(`[Baileys ${sessionId}] Ignorado: grupo`);
      return;
    }
    if (isJidBroadcast(remoteJid) || remoteJid === 'status@broadcast') {
      console.log(`[Baileys ${sessionId}] Ignorado: broadcast/status`);
      return;
    }

    const decoded = jidDecode(remoteJid);

    // Handle LID JIDs (Linked Device IDs) — newer WhatsApp behavior
    if (decoded?.server === 'lid' && decoded.user) {
      const phone = decoded.user;
      console.log(`[Baileys ${sessionId}] LID: ${phone}`);

      if (phone.length < 10 || phone.length > 15) {
        console.log(`[Baileys ${sessionId}] Ignorado: phone "${phone}" invalido (${phone.length} digitos)`);
        return;
      }

      const contentType = getContentType(msg.message);
      let messageText = '';
      let mediaUrl: string | null = null;
      let mimeType: string | null = null;

      if (contentType === 'conversation') {
        messageText = msg.message.conversation || '';
      } else if (contentType === 'extendedTextMessage') {
        messageText = msg.message.extendedTextMessage?.text || '';
      } else if (contentType === 'imageMessage') {
        messageText = msg.message.imageMessage?.caption || '';
        mimeType = msg.message.imageMessage?.mimetype || 'image/jpeg';
        try {
          const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
          mediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch {}
      } else if (contentType === 'documentMessage') {
        messageText = msg.message.documentMessage?.caption || '';
        mimeType = msg.message.documentMessage?.mimetype || 'application/octet-stream';
        try {
          const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
          mediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch {}
      } else if (contentType === 'audioMessage') {
        mimeType = msg.message.audioMessage?.mimetype || 'audio/ogg';
        try {
          const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
          mediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch {}
      } else if (contentType === 'buttonsResponseMessage') {
        messageText = msg.message.buttonsResponseMessage?.selectedButtonId || '';
      } else if (contentType === 'listResponseMessage') {
        messageText = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
      }

      const contactName = msg.pushName || phone;

      // SendFn for LID: reply directly to the LID JID
      const sendFn = async (to: string, message: string) => {
        const connState = this.connections.get(sessionId);
        const sock = connState?.socket;
        if (!sock) return { success: false, error: 'Socket nao disponivel' };
        try {
          const result = await sock.sendMessage(remoteJid, { text: message });
          return { success: true, messageId: result?.key?.id || undefined };
        } catch (err: any) {
          return { success: false, error: err?.message };
        }
      };

      console.log(`[Baileys ${sessionId}] LID msg de ${phone} — processando...`);
      await processIncomingMessageHandler(
        {
          phone,
          text: messageText,
          contactName,
          mediaUrl,
          mimeType,
          connectionId: sessionId,
          provider: 'baileys',
          jid: remoteJid || undefined,
        },
        sendFn,
      );
      return;
    }

    // Standard phone-based JID (@s.whatsapp.net)
    if (!decoded || decoded.server !== 's.whatsapp.net' || !decoded.user) {
      console.log(`[Baileys ${sessionId}] Ignorado: server=${decoded?.server}`);
      return;
    }

    const phone = decoded.user;
    if (phone.length < 10 || phone.length > 15) {
      console.log(`[Baileys ${sessionId}] Ignorado: phone "${phone}" invalido (${phone.length} digitos)`);
      return;
    }

    console.log(`[Baileys ${sessionId}] Msg de ${phone} — processando...`);

    const contentType = getContentType(msg.message);
    let messageText = '';
    let mediaUrl: string | null = null;
    let mimeType: string | null = null;

    if (contentType === 'conversation') {
      messageText = msg.message.conversation || '';
    } else if (contentType === 'extendedTextMessage') {
      messageText = msg.message.extendedTextMessage?.text || '';
    } else if (contentType === 'imageMessage') {
      messageText = msg.message.imageMessage?.caption || '';
      mimeType = msg.message.imageMessage?.mimetype || 'image/jpeg';
      try {
        const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
        mediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch {}
    } else if (contentType === 'documentMessage') {
      messageText = msg.message.documentMessage?.caption || '';
      mimeType = msg.message.documentMessage?.mimetype || 'application/octet-stream';
      try {
        const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
        mediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch {}
    } else if (contentType === 'audioMessage') {
      mimeType = msg.message.audioMessage?.mimetype || 'audio/ogg';
      try {
        const buffer = await downloadMediaMessage(msg as any, 'buffer', {});
        mediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch {}
    } else if (contentType === 'buttonsResponseMessage') {
      messageText = msg.message.buttonsResponseMessage?.selectedButtonId || '';
    } else if (contentType === 'listResponseMessage') {
      messageText = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
    }

    const contactName = msg.pushName || phone;

    // Update lastMessageAt
    const state = this.connections.get(sessionId) || (sessionId === 'legacy' ? this.legacyState : undefined);
    if (state) state.lastMessageAt = new Date();

    // Use shared handler for bot/triage logic
    console.log(`[Baileys ${sessionId}] Bot reply para ${phone}`);
    const sendFn = async (to: string, message: string) => {
      const socket = state?.socket;
      if (!socket) return { success: false, error: 'Socket nao disponivel' };
      return this.sendText(socket, to, message);
    };

    await processIncomingMessageHandler(
      {
        phone,
        text: messageText,
        contactName,
        mediaUrl,
        mimeType,
        connectionId: sessionId,
        provider: 'baileys',
        jid: remoteJid || undefined,
      },
      sendFn,
    );
  }

  // ── Private: Send text message ──────────────────────────────────────
  private async sendText(
    socket: WASocket,
    to: string,
    text: string,
    jid?: string,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      // Use provided JID directly (e.g., LID JIDs like 123@lid)
      if (jid && jid.includes('@')) {
        const result = await socket.sendMessage(jid, { text });
        return { success: true, messageId: result?.key?.id || undefined };
      }
      const phone = to.replace(/[^\d]/g, '');
      if (phone.length < 10 || phone.length > 15) {
        return { success: false, error: `Telefone invalido: "${phone}" (${phone.length} digitos)` };
      }
      const targetJid = jidNormalizedUser(`${phone}@s.whatsapp.net`);
      const result = await socket.sendMessage(targetJid, { text });
      return { success: true, messageId: result?.key?.id || undefined };
    } catch (error: any) {
      console.error('[Baileys] Erro ao enviar:', error?.message);
      return { success: false, error: error.message };
    }
  }
}

export const baileysProviderService = new BaileysProviderService();
export { BaileysProviderService };
