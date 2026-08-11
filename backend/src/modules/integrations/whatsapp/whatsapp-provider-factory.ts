import { baileysProviderService } from './baileys-provider.service';
import prisma from '../../../config/database';

// ── WhatsApp Provider Factory ─────────────────────────────────────────
// Routes connections to their designated provider.
// Currently only Baileys is supported (free WebSocket, no Chrome).

export type WhatsAppProviderType = 'baileys';

export interface WhatsAppProvider {
  connectMulti(connectionId: string): Promise<{ qrCode?: string; connected: boolean; error?: string }>;
  disconnectMulti(connectionId: string): Promise<void>;
  getMultiState(connectionId: string): any;
  getAllMultiStates(): Map<string, any>;
  sendTextMulti(connectionId: string, to: string, text: string): Promise<{ success: boolean; error?: string; messageId?: string }>;
  cleanSession(connectionId: string): void;
}

class WhatsAppProviderFactory {
  private providers: Map<WhatsAppProviderType, WhatsAppProvider> = new Map();

  constructor() {
    this.providers.set('baileys', baileysProviderService as any);
  }

  async getProviderForConnection(connectionId: string): Promise<WhatsAppProvider | null> {
    try {
      const connection = await prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { provider: true },
      });

      if (!connection) {
        console.error(`[WhatsAppFactory] Connection ${connectionId} not found`);
        return null;
      }

      return this.getProvider(connection.provider as WhatsAppProviderType);
    } catch (err: any) {
      console.error(`[WhatsAppFactory] Error getting provider for ${connectionId}:`, err?.message);
      return null;
    }
  }

  getProvider(type: string): WhatsAppProvider | null {
    if (type === 'baileys') return this.providers.get('baileys') || null;
    // Fallback to baileys for legacy 'whatsapp-webjs' entries
    console.warn(`[WhatsAppFactory] Provider "${type}" nao suportado, usando baileys`);
    return this.providers.get('baileys') || null;
  }

  async getProviderTypeForConnection(connectionId: string): Promise<WhatsAppProviderType | null> {
    try {
      const connection = await prisma.whatsAppConnection.findUnique({
        where: { id: connectionId },
        select: { provider: true },
      });

      if (!connection) return null;
      return 'baileys'; // Always use baileys
    } catch {
      return null;
    }
  }

  async connectConnection(connectionId: string): Promise<{ qrCode?: string; connected: boolean; error?: string }> {
    const provider = await this.getProviderForConnection(connectionId);
    if (!provider) {
      return { connected: false, error: 'Conexao nao encontrada' };
    }
    return provider.connectMulti(connectionId);
  }

  async disconnectConnection(connectionId: string): Promise<void> {
    const provider = await this.getProviderForConnection(connectionId);
    if (provider) {
      await provider.disconnectMulti(connectionId);
    }
  }

  async sendText(connectionId: string, to: string, text: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const provider = await this.getProviderForConnection(connectionId);
    if (!provider) {
      return { success: false, error: 'Provider nao encontrado para esta conexao' };
    }
    return provider.sendTextMulti(connectionId, to, text);
  }

  async getConnectionStatus(connectionId: string): Promise<{ connected: boolean; provider: string; qrCode?: string | null; error?: string | null }> {
    const providerType = await this.getProviderTypeForConnection(connectionId);
    if (!providerType) {
      return { connected: false, provider: 'unknown', error: 'Conexao nao encontrada' };
    }

    const provider = this.getProvider(providerType);
    if (!provider) {
      return { connected: false, provider: providerType, error: 'Provider nao disponivel' };
    }

    const state = provider.getMultiState(connectionId);
    return {
      connected: state?.connected || false,
      provider: providerType,
      qrCode: state?.qrCode || null,
      error: state?.error || null,
    };
  }

  async getAllConnectionsStatus(): Promise<Array<{ connectionId: string; nome: string; numero: string; connected: boolean; provider: string; qrCode?: string | null; error?: string | null }>> {
    try {
      const connections = await prisma.whatsAppConnection.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, numero: true, provider: true },
      });

      const results = [];
      for (const conn of connections) {
        const provider = this.getProvider('baileys');
        const state = provider?.getMultiState(conn.id);
        results.push({
          connectionId: conn.id,
          nome: conn.nome,
          numero: conn.numero,
          connected: state?.connected || false,
          provider: 'baileys',
          qrCode: state?.qrCode || null,
          error: state?.error || null,
        });
      }

      return results;
    } catch (err: any) {
      console.error('[WhatsAppFactory] Error getting all connections status:', err?.message);
      return [];
    }
  }

  async reconnectAllActive(): Promise<void> {
    console.log('[WhatsAppFactory] Reconectando todas as conexoes ativas...');
    await baileysProviderService.reconnectAllActive();
  }

  async disconnectAll(): Promise<void> {
    console.log('[WhatsAppFactory] Desconectando todas as conexoes...');
    const connections = await prisma.whatsAppConnection.findMany({
      where: { ativo: true },
      select: { id: true, provider: true },
    });

    for (const conn of connections) {
      await baileysProviderService.disconnectMulti(conn.id);
    }
  }
}

export const whatsappProviderFactory = new WhatsAppProviderFactory();
export { WhatsAppProviderFactory };
