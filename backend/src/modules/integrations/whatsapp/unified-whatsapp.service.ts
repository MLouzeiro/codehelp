import { evolutionApiService } from './evolution-api.service';
import { whatsappCloudAPIService } from './cloud-api.service';
import prisma from '../../../config/database';
import { env } from '../../../config/env';

// ── Unified WhatsApp Service ──────────────────────────────────────────
// Manages all WhatsApp backends:
// 1. Baileys (WebSocket, no Chrome needed — primary)
// 2. Evolution API (self-hosted Docker)
// 3. WhatsApp Cloud API (Meta Official)

export type WhatsAppProvider = 'baileys' | 'evolution' | 'cloud';

interface SendMessageOptions {
  to: string;
  message: string;
  provider?: WhatsAppProvider;
  instanceName?: string;
  connectionId?: string;
  ticketId?: string;
}

interface SendMessageResult {
  success: boolean;
  error?: string;
  messageId?: string;
  retries?: number;
}

interface WhatsAppStatus {
  provider: WhatsAppProvider;
  connected: boolean;
  enabled: boolean;
  error?: string;
}

const MAX_MESSAGE_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

// Transient errors that are worth retrying
const RETRYABLE_PATTERNS = [
  'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND',
  'socket hang up', 'network', 'timeout', 'fetch failed',
  '502', '503', '504', '429',
];

function isRetryableError(error: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return RETRYABLE_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class UnifiedWhatsAppService {
  private activeProvider: WhatsAppProvider;
  private providers: Map<WhatsAppProvider, boolean> = new Map();

  constructor() {
    // Determine which providers are configured
    this.providers.set('baileys', true); // Always available (primary)
    this.providers.set('evolution', !!env.evolutionApiUrl);
    this.providers.set('cloud', !!(env.whatsappCloudPhoneNumberId && env.whatsappCloudAccessToken));

    // Set default provider (prefer Baileys > Evolution > Cloud)
    if (this.providers.get('baileys')) {
      this.activeProvider = 'baileys';
    } else if (this.providers.get('evolution')) {
      this.activeProvider = 'evolution';
    } else {
      this.activeProvider = 'cloud';
    }

    console.log(`[WhatsApp] Providers available:`, {
      'baileys': this.providers.get('baileys'),
      'evolution': this.providers.get('evolution'),
      'cloud': this.providers.get('cloud'),
    });
    console.log(`[WhatsApp] Active provider: ${this.activeProvider}`);
  }

  // ── Provider Management ────────────────────────────────────────────

  setActiveProvider(provider: WhatsAppProvider): void {
    if (!this.providers.get(provider)) {
      throw new Error(`Provider ${provider} is not configured`);
    }
    this.activeProvider = provider;
    console.log(`[WhatsApp] Active provider changed to: ${provider}`);
  }

  getActiveProvider(): WhatsAppProvider {
    return this.activeProvider;
  }

  getAvailableProviders(): WhatsAppProvider[] {
    return Array.from(this.providers.entries())
      .filter(([_, enabled]) => enabled)
      .map(([provider]) => provider);
  }

  // ── Send Messages ──────────────────────────────────────────────────

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const { to, message, provider, instanceName, connectionId, ticketId } = options;
    const useProvider = provider || this.activeProvider;

    let lastError = '';
    for (let attempt = 0; attempt <= MAX_MESSAGE_RETRIES; attempt++) {
      try {
        let result: SendMessageResult;

        switch (useProvider) {
          case 'evolution':
            result = await evolutionApiService.sendMessage(to, message, instanceName);
            break;
          case 'cloud':
            result = await whatsappCloudAPIService.sendTextMessage(to, message);
            break;
          case 'baileys': {
            const { sendWhatsAppMessage } = await import('./whatsapp.service');
            result = await sendWhatsAppMessage(to, message, connectionId);
            break;
          }
          default:
            return { success: false, error: `Unknown provider: ${useProvider}` };
        }

        if (result.success) {
          if (attempt > 0) {
            console.log(`[WhatsApp] Mensagem enviada com sucesso após ${attempt} retry(s) → ${to}`);
          }
          // Record sent status in DB if ticketId provided
          if (ticketId && result.messageId) {
            await this.recordMessageStatus(ticketId, result.messageId, 'sent', to);
          }
          return { ...result, retries: attempt };
        }

        lastError = result.error || 'Unknown error';

        // Don't retry on permanent errors
        if (!isRetryableError(lastError)) {
          console.warn(`[WhatsApp] Erro permanente (não retryável): ${lastError} → ${to}`);
          return result;
        }

        // Retry with exponential backoff
        if (attempt < MAX_MESSAGE_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[WhatsApp] Tentativa ${attempt + 1}/${MAX_MESSAGE_RETRIES} falhou (${lastError}). Retry em ${delay / 1000}s → ${to}`);
          await sleep(delay);
        }
      } catch (err: any) {
        lastError = err.message || 'Unknown exception';
        if (attempt < MAX_MESSAGE_RETRIES && isRetryableError(lastError)) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[WhatsApp] Exceção tentativa ${attempt + 1}/${MAX_MESSAGE_RETRIES} (${lastError}). Retry em ${delay / 1000}s → ${to}`);
          await sleep(delay);
        } else {
          break;
        }
      }
    }

    console.error(`[WhatsApp] Falha após ${MAX_MESSAGE_RETRIES} retries: ${lastError} → ${to}`);
    return { success: false, error: lastError, retries: MAX_MESSAGE_RETRIES };
  }

  async sendMedia(
    to: string,
    mediaUrl: string,
    caption?: string,
    provider?: WhatsAppProvider,
  ): Promise<{ success: boolean; error?: string }> {
    const useProvider = provider || this.activeProvider;

    switch (useProvider) {
      case 'evolution':
        return evolutionApiService.sendMedia(to, mediaUrl, caption);

      case 'cloud':
        return whatsappCloudAPIService.sendImageMessage(to, mediaUrl, caption);

      case 'baileys':
        // Baileys doesn't have a direct sendMedia in unified service, use text
        return this.sendMessage({ to, message: caption || '(mídia)', provider: 'baileys' });

      default:
        return { success: false, error: `Unknown provider: ${useProvider}` };
    }
  }

  // ── Message Status Tracking ─────────────────────────────────────────

  async recordMessageStatus(
    ticketId: string,
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
    phone: string,
  ): Promise<void> {
    try {
      // Upsert message status in Message table
      await prisma.message.upsert({
        where: { id: messageId },
        update: { status },
        create: {
          id: messageId,
          ticketId,
          phone,
          fromMe: true,
          content: '',
          status,
          provider: 'baileys',
        },
      });
    } catch (err: any) {
      // Non-critical — don't crash on tracking failure
      console.warn(`[WhatsApp] Failed to record message status: ${err.message}`);
    }
  }

  async updateMessageStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
  ): Promise<void> {
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { status },
      });
    } catch {
      // Message might not exist yet — ignore
    }
  }

  // ── Connection Management ──────────────────────────────────────────

  async getStatus(): Promise<WhatsAppStatus[]> {
    const statuses: WhatsAppStatus[] = [];

    // Baileys status (primary provider)
    if (this.providers.get('baileys')) {
      const { isClientConnected, getConnectionError } = await import('./whatsapp.service');
      statuses.push({
        provider: 'baileys',
        connected: isClientConnected(),
        enabled: true,
        error: getConnectionError() || undefined,
      });
    }

    // Evolution API status
    if (this.providers.get('evolution')) {
      const connected = await evolutionApiService.checkHealth();
      statuses.push({
        provider: 'evolution',
        connected,
        enabled: true,
        error: connected ? undefined : 'Evolution API unreachable',
      });
    }

    // Cloud API status
    if (this.providers.get('cloud')) {
      const connected = await whatsappCloudAPIService.checkHealth();
      statuses.push({
        provider: 'cloud',
        connected,
        enabled: true,
        error: connected ? undefined : 'Cloud API not configured or unreachable',
      });
    }

    return statuses;
  }

  // ── Webhook Handling ───────────────────────────────────────────────

  async handleEvolutionWebhook(payload: any): Promise<void> {
    await evolutionApiService.handleWebhook(payload);
  }

  async handleCloudWebhook(body: any): Promise<void> {
    await whatsappCloudAPIService.handleWebhook(body);
  }

  verifyCloudWebhook(mode: string, token: string, challenge: string): string | null {
    return whatsappCloudAPIService.verifyWebhook(mode, token, challenge);
  }
}

export const unifiedWhatsAppService = new UnifiedWhatsAppService();
export { UnifiedWhatsAppService };