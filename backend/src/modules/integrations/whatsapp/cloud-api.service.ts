import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { processIncomingMessageHandler } from './whatsapp-message-handler';

// ── WhatsApp Cloud API Integration Service (Meta Official) ────────────
// Free tier: 1,000 conversations/month

interface CloudAPIConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  webhookVerifyToken: string;
}

interface CloudAPIResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

class WhatsAppCloudAPIService {
  private config: CloudAPIConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      phoneNumberId: env.whatsappCloudPhoneNumberId || '',
      accessToken: env.whatsappCloudAccessToken || '',
      apiVersion: env.whatsappCloudApiVersion || 'v19.0',
      webhookVerifyToken: env.whatsappCloudWebhookVerifyToken || 'codehelp-verify-token',
    };
    this.baseUrl = `https://graph.facebook.com/${this.config.apiVersion}`;
  }

  // ── Send Messages ──────────────────────────────────────────────────

  async sendTextMessage(to: string, text: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      return { success: false, error: 'WhatsApp Cloud API not configured' };
    }

    const phone = to.replace(/[^\d]/g, '');

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text },
          }),
        }
      );

      if (!response.ok) {
        const error: any = await response.json();
        return {
          success: false,
          error: error.error?.message || 'Failed to send message',
        };
      }

      const data = (await response.json()) as CloudAPIResponse;
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      return { success: false, error: 'WhatsApp Cloud API not configured' };
    }

    const phone = to.replace(/[^\d]/g, '');

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'image',
            image: {
              link: imageUrl,
              caption: caption || '',
            },
          }),
        }
      );

      if (!response.ok) {
        const error: any = await response.json();
        return { success: false, error: error.error?.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    fileName: string,
    caption?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      return { success: false, error: 'WhatsApp Cloud API not configured' };
    }

    const phone = to.replace(/[^\d]/g, '');

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'document',
            document: {
              link: documentUrl,
              filename: fileName,
              caption: caption || '',
            },
          }),
        }
      );

      if (!response.ok) {
        const error: any = await response.json();
        return { success: false, error: error.error?.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  // ── Webhook Handler ────────────────────────────────────────────────

  async handleWebhook(body: any): Promise<void> {
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const messages = change.value?.messages || [];
        for (const msg of messages) {
          await this.processIncomingMessage(msg, change.value?.metadata);
        }
      }
    }
  }

  private async processIncomingMessage(msg: any, metadata: any): Promise<void> {
    try {
      const phone = msg.from || '';
      if (!phone) return;

      const messageText = msg.text?.body || msg.image?.caption || msg.document?.caption || '';
      const contactName = msg.profile?.name || phone;
      const messageId = msg.id;

      // Extract media info
      let mediaUrl: string | null = null;
      let mimeType: string | null = null;

      if (msg.image) {
        mediaUrl = await this.downloadMedia(msg.image.id);
        mimeType = 'image/jpeg';
      } else if (msg.document) {
        mediaUrl = await this.downloadMedia(msg.document.id);
        mimeType = msg.document.mime_type || 'application/octet-stream';
      }

      // Use shared handler for bot/triage logic
      const sendFn = (to: string, message: string) => this.sendTextMessage(to, message);
      await processIncomingMessageHandler(
        {
          phone,
          text: messageText,
          contactName,
          mediaUrl,
          mimeType,
          provider: 'cloud',
        },
        sendFn,
      );

      // Send read receipt
      await this.markAsRead(messageId);

    } catch (error) {
      console.error('[WhatsApp Cloud API] Error processing message:', error);
    }
  }

  // ── Media Handling ─────────────────────────────────────────────────

  async downloadMedia(mediaId: string): Promise<string | null> {
    try {
      // Get media URL
      const urlResponse = await fetch(
        `${this.baseUrl}/${mediaId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (!urlResponse.ok) return null;
      const urlData: any = await urlResponse.json();

      // Download actual media
      const mediaResponse = await fetch(urlData.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
      });

      if (!mediaResponse.ok) return null;

      // Convert to base64
      const buffer = await mediaResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:${urlData.mime_type};base64,${base64}`;
    } catch (error) {
      console.error('[WhatsApp Cloud API] Error downloading media:', error);
      return null;
    }
  }

  // ── Message Status ─────────────────────────────────────────────────

  async markAsRead(messageId: string): Promise<void> {
    if (!this.config.phoneNumberId || !this.config.accessToken) return;

    try {
      await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          }),
        }
      );
    } catch (error) {
      console.error('[WhatsApp Cloud API] Error marking as read:', error);
    }
  }

  // ── Health Check ───────────────────────────────────────────────────

  async checkHealth(): Promise<boolean> {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async getPhoneNumberInfo(): Promise<any> {
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}

export const whatsappCloudAPIService = new WhatsAppCloudAPIService();
export { WhatsAppCloudAPIService };