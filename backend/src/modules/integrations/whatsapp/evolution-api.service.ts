import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { processIncomingMessageHandler } from './whatsapp-message-handler';
import { normalizePhone } from './whatsapp-utils';

// ── Evolution API Integration Service ──────────────────────────────────
// Replaces whatsapp-web.js with Evolution API (Docker-based)

interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

interface EvolutionInstance {
  instanceName: string;
  instanceId: string;
  status: string;
  owner?: string;
}

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
    imageMessage?: {
      caption?: string;
      url?: string;
      mimeType?: string;
    };
    documentMessage?: {
      fileName?: string;
      url?: string;
      mimeType?: string;
    };
    audioMessage?: {
      url?: string;
      mimeType?: string;
    };
  };
  messageType?: string;
  messageTimestamp?: number;
}

class EvolutionAPIService {
  private config: EvolutionConfig;

  constructor() {
    this.config = {
      baseUrl: env.evolutionApiUrl || 'http://localhost:8080',
      apiKey: env.evolutionApiKey || 'your-api-key-here',
      instanceName: env.evolutionInstanceName || 'codehelp',
    };
  }

  // ── Instance Management ────────────────────────────────────────────

  async createInstance(instanceName?: string): Promise<EvolutionInstance> {
    const name = instanceName || this.config.instanceName;
    const response = await fetch(`${this.config.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.config.apiKey,
      },
      body: JSON.stringify({
        instanceName: name,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        reject_call: false,
        always_online: true,
        webhook: {
          enabled: true,
          url: `${env.backendUrl || 'http://localhost:3010'}/api/whatsapp/evolution/webhook`,
          events: [
            'messages.upsert',
            'connection.update',
            'instance.connections',
          ],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Evolution instance: ${error}`);
    }

    const data: any = await response.json();
    return {
      instanceName: name,
      instanceId: data.instance?.instanceId || '',
      status: 'connecting',
    };
  }

  async connectInstance(instanceName: string): Promise<{ qrcode?: string; status: string }> {
    const response = await fetch(`${this.config.baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.config.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to connect Evolution instance: ${error}`);
    }

    const data: any = await response.json();
    return {
      qrcode: data.base64,
      status: data.state || 'connecting',
    };
  }

  async disconnectInstance(instanceName: string): Promise<void> {
    await fetch(`${this.config.baseUrl}/instance/disconnect/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': this.config.apiKey,
      },
    });
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await fetch(`${this.config.baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': this.config.apiKey,
      },
    });
  }

  async getConnectionState(instanceName: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.config.apiKey,
      },
    });

    if (!response.ok) return 'disconnected';
    const data: any = await response.json();
    return data.state || 'disconnected';
  }

  // ── Message Handling ───────────────────────────────────────────────

  async sendMessage(
    to: string,
    message: string,
    instanceName?: string,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const instance = instanceName || this.config.instanceName;
    const phone = normalizePhone(to);

    try {
      const response = await fetch(`${this.config.baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.config.apiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data: any = await response.json();
      return { success: true, messageId: data.key?.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendMedia(
    to: string,
    mediaUrl: string,
    caption?: string,
    instanceName?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const instance = instanceName || this.config.instanceName;
    const phone = normalizePhone(to);

    try {
      const response = await fetch(`${this.config.baseUrl}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.config.apiKey,
        },
        body: JSON.stringify({
          number: phone,
          mediatype: 'image',
          media: mediaUrl,
          caption: caption || '',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ── Webhook Handler ────────────────────────────────────────────────

  async handleWebhook(payload: any): Promise<void> {
    const { event, instance, data } = payload;

    if (event === 'messages.upsert') {
      const messages = Array.isArray(data) ? data : [data];
      for (const msg of messages) {
        await this.processIncomingMessage(msg, instance);
      }
    }

    if (event === 'connection.update' || event === 'instance.connection' || event === 'instance.connections') {
      const state = data?.state || data?.status || 'unknown';
      await this.updateInstanceConnection(instance, state);
    }
  }

  private async processIncomingMessage(msg: EvolutionMessage, instanceName: string): Promise<void> {
    try {
      // Ignore messages from self
      if (msg.key?.fromMe) return;

      const remoteJid = msg.key?.remoteJid || '';

      // Filtrar status/stories do WhatsApp
      if (remoteJid === 'status@broadcast') return;

      // Filtrar mensagens de grupos
      if (remoteJid.endsWith('@g.us')) return;

      const phone = remoteJid.replace(/@c\.us$/i, '');
      if (!phone) return;

      const messageBody = (msg.message || {}) as any;
      const interactiveId =
        messageBody.buttonsResponseMessage?.selectedButtonId ||
        messageBody.listResponseMessage?.singleSelectReply?.selectedRowId ||
        messageBody.templateButtonReplyMessage?.selectedId ||
        '';
      const messageText = interactiveId
        || msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || '';
      const contactName = msg.pushName || phone;

      // Extract media info
      let mediaUrl: string | null = null;
      let mimeType: string | null = null;

      if (msg.messageType === 'imageMessage' && msg.message?.imageMessage) {
        mediaUrl = msg.message.imageMessage.url || null;
        mimeType = msg.message.imageMessage.mimeType || 'image/jpeg';
      } else if (msg.messageType === 'documentMessage' && msg.message?.documentMessage) {
        mediaUrl = msg.message.documentMessage.url || null;
        mimeType = msg.message.documentMessage.mimeType || 'application/octet-stream';
      } else if (msg.messageType === 'audioMessage' && msg.message?.audioMessage) {
        mediaUrl = msg.message.audioMessage.url || null;
        mimeType = msg.message.audioMessage.mimeType || 'audio/ogg';
      }

      // Use shared handler for bot/triage logic
      const sendFn = (to: string, message: string) => this.sendMessage(to, message, instanceName);
      await processIncomingMessageHandler(
        {
          phone,
          text: messageText,
          contactName,
          mediaUrl,
          mimeType,
          connectionId: instanceName,
          provider: 'evolution',
          jid: remoteJid || undefined,
          interactiveId: interactiveId || undefined,
          messageId: msg.key?.id,
        },
        sendFn,
      );

    } catch (error) {
      console.error('[Evolution API] Error processing message:', error);
    }
  }

  private async updateInstanceConnection(instanceName: string, state: string): Promise<void> {
    console.log(`[Evolution API] Instance ${instanceName} connection state: ${state}`);
  }

  // ── Helper Methods ─────────────────────────────────────────────────

  async listInstances(): Promise<EvolutionInstance[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.config.apiKey,
        },
      });

      if (!response.ok) {
        console.warn(`[Evolution API] listInstances failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data: any = await response.json();

      // Evolution API v2+ returns { instance: [...] } or a flat array
      const rawInstances = data.instance || data.instances || (Array.isArray(data) ? data : []);

      return rawInstances.map((inst: any) => ({
        instanceName: inst.instanceName || inst.name || '',
        instanceId: inst.instanceId || inst.id || '',
        // Normalize status: v2 returns { state: "open" }, v1 returns string
        status: typeof inst.status === 'object'
          ? (inst.status?.state || inst.state || 'unknown')
          : (inst.status || inst.state || 'unknown'),
        owner: inst.owner,
      }));
    } catch (err: any) {
      console.error('[Evolution API] listInstances error:', err?.message || err);
      return [];
    }
  }

  async getQRCode(instanceName: string): Promise<string | null> {
    const response = await fetch(`${this.config.baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': this.config.apiKey,
      },
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    return data.base64 || null;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Evolution API v2+ does NOT have GET / — use fetchInstances as health check
      const response = await fetch(`${this.config.baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'apikey': this.config.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const evolutionApiService = new EvolutionAPIService();
export { EvolutionAPIService };