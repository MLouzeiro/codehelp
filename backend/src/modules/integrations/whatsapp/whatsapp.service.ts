import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { baileysProviderService } from './baileys-provider.service';

// ── WhatsApp Service ──────────────────────────────────────────────────
// Sends messages via Baileys (WebSocket, no Chrome needed).
// All bot/triage logic lives in whatsapp-message-handler.ts.

// Re-exports for compatibility
export type { WhatsAppConnection } from './types';

// ── Protocolo Lock ──────────────────────────────────────────────────────
let protocoloLockQueue: Array<{ resolve: () => void }> = [];

async function acquireProtocoloLock(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (protocoloLockQueue.length === 0) {
      protocoloLockQueue.push({ resolve });
      resolve();
    } else {
      protocoloLockQueue.push({ resolve });
    }
  });
}

function releaseProtocoloLock() {
  protocoloLockQueue.shift();
  if (protocoloLockQueue.length > 0) {
    protocoloLockQueue[0].resolve();
  }
}

async function withProtocoloLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquireProtocoloLock();
  try {
    return await fn();
  } finally {
    releaseProtocoloLock();
  }
}

// ── Protocolo Generation ────────────────────────────────────────────────
export async function generateProtocolo(): Promise<string> {
  return withProtocoloLock(async () => {
    const hoje = new Date();
    const data = hoje.toISOString().slice(0, 10).replace(/-/g, '');
    const prefixo = `TKT-${data}`;

    const ultimo = await prisma.ticket.findFirst({
      where: { protocolo: { startsWith: prefixo } },
      orderBy: { protocolo: 'desc' },
    });

    let seq = 1;
    if (ultimo?.protocolo) {
      const partes = ultimo.protocolo.split('-');
      seq = parseInt(partes[2] || '0', 10) + 1;
    }

    const proto = `${prefixo}-${String(seq).padStart(4, '0')}`;
    console.log(`[Protocolo] Gerado: ${proto}`);
    return proto;
  });
}

// ── Message Classification ──────────────────────────────────────────────
export const SUBJECTS = [
  { value: 'suporte_tecnico', label: 'Suporte Tecnico' },
  { value: 'duvida_faturamento', label: 'Duvida/Faturamento' },
  { value: 'solicitacao_mudanca', label: 'Solicitacao de Mudanca' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'reclamacao', label: 'Reclamacao' },
  { value: 'orcamento', label: 'Orcamento' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'outro', label: 'Outro' },
];

export function classifyMessage(text: string): string {
  const lower = text.toLowerCase();
  if (/(erro|bug|nao funciona|quebrou|falha|problema|travou|parou)/.test(lower)) return 'suporte_tecnico';
  if (/(boleto|fatura|nota|pagamento|cobranca|preco|valor|contrato|dinheiro|pix)/.test(lower)) return 'duvida_faturamento';
  if (/(quero|preciso|mudar|adicionar|novo|implementar|sugestao|melhoria|gostaria)/.test(lower)) return 'solicitacao_mudanca';
  if (/(como|ajuda|ensinar|aprender|duvida|funciona|tutorial|manual|orientacao)/.test(lower)) return 'treinamento';
  if (/(insatisfeito|pessimo|horivel|reclamacao|chateado|decepcao|ruim)/.test(lower)) return 'reclamacao';
  if (/(orcamento|quanto custa|preco|valor|quero contratar)/.test(lower)) return 'orcamento';
  if (/(agendar|visita|horario|quando|pode ir|vir aqui)/.test(lower)) return 'agendamento';
  return 'outro';
}

export function getSubjectLabel(value: string): string {
  return SUBJECTS.find((s) => s.value === value)?.label || value;
}

// ── Phone Number Utilities ──────────────────────────────────────────────
export function sanitizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 7) return `${phone}@s.whatsapp.net`;
  return `${digits}@s.whatsapp.net`;
}

// ── Send Protocol Reply ─────────────────────────────────────────────────
export async function sendProtocolReply(contactPhone: string, protocolo: string, tipo: 'abertura' | 'fechamento'): Promise<void> {
  const msg = tipo === 'abertura'
    ? `Ola!\n\nSeu chamado foi aberto com sucesso.\nProtocolo: *${protocolo}*\n\nEm breve nossa equipe entrara em contato.\n\nAtenciosamente,\nEquipe Codemed`
    : `Ola!\n\nSeu chamado foi finalizado.\nProtocolo: *${protocolo}*\n\nAgradecemos pelo contato!\n\nAtenciosamente,\nEquipe Codemed`;

  await sendWhatsAppMessage(contactPhone, msg);
}

// ── Send Message (unified provider) ─────────────────────────────────────
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  connectionId?: string,
  jid?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const phone = to.replace(/[^\d]/g, '');

  // Try specific Baileys connection
  if (connectionId) {
    const baileysState = baileysProviderService.getMultiState(connectionId);
    if (baileysState?.connected && baileysState.socket) {
      return baileysProviderService.sendTextMulti(connectionId, phone, message, jid);
    }
  }

  // Try Baileys legacy
  if (baileysProviderService.isLegacyConnected()) {
    return baileysProviderService.sendTextLegacy(phone, message, jid);
  }

  // Try any connected Baileys multi-connection
  const allBaileysStates = baileysProviderService.getAllMultiStates();
  for (const [connId, state] of allBaileysStates) {
    if (state.connected && state.socket) {
      const result = await baileysProviderService.sendTextMulti(connId, phone, message, jid);
      if (result.success) return result;
    }
  }

  return { success: false, error: 'Nenhum provider WhatsApp disponivel' };
}

export async function sendWhatsAppListMessage(
  to: string,
  buttonText: string,
  bodyText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
  connectionId?: string,
  jid?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const phone = to.replace(/[^\d]/g, '');

  if (connectionId) {
    const baileysState = baileysProviderService.getMultiState(connectionId);
    if (baileysState?.connected && baileysState.socket) {
      return baileysProviderService.sendListMessageMulti(connectionId, phone, buttonText, bodyText, sections, jid);
    }
  }

  if (baileysProviderService.isLegacyConnected()) {
    return baileysProviderService.sendListMessageLegacy(phone, buttonText, bodyText, sections, jid);
  }

  const allBaileysStates = baileysProviderService.getAllMultiStates();
  for (const [connId, state] of allBaileysStates) {
    if (state.connected && state.socket) {
      const result = await baileysProviderService.sendListMessageMulti(connId, phone, buttonText, bodyText, sections, jid);
      if (result.success) return result;
    }
  }

  return { success: false, error: 'Nenhum provider WhatsApp disponivel' };
}

// ── Status Functions (compatibility) ──────────────────────────────────
export function isClientConnected(): boolean {
  if (baileysProviderService.isLegacyConnected()) return true;
  const allBaileys = baileysProviderService.getAllMultiStates();
  for (const [, state] of allBaileys) {
    if (state.connected) return true;
  }
  return false;
}

export function getQrCodeData(): string | null {
  return baileysProviderService.getLegacyQrCode();
}

export function getConnectionError(): string | null {
  return baileysProviderService.getLegacyError();
}

export function getLastMessageAt(): Date | null {
  const legacy = baileysProviderService.getLegacySocket();
  if (legacy) return new Date();
  return null;
}

export function pingHeartbeat(): void {
  // No-op for Baileys (WebSocket handles this)
}

export async function getWhatsAppState(): Promise<string | null> {
  if (baileysProviderService.isLegacyConnected()) return 'connected';

  try {
    const activeConnections = await prisma.whatsAppConnection.findMany({
      where: { ativo: true },
      select: { id: true },
    });

    for (const conn of activeConnections) {
      const state = baileysProviderService.getMultiState(conn.id);
      if (state?.connected) return 'connected';
    }
  } catch {}

  return 'disconnected';
}

export function getClient(): any {
  return baileysProviderService.getLegacySocket();
}

// ── Legacy functions (kept for compatibility) ───────────────────────────
export async function initializeClient(): Promise<void> {
  if (!baileysProviderService.isLegacyConnected()) {
    await baileysProviderService.connectLegacy();
  }
}

export async function disconnectClient(): Promise<void> {
  await baileysProviderService.disconnectLegacy();
}

export async function clearSession(): Promise<void> {
  await disconnectClient();
  const fs = await import('fs');
  const path = await import('path');
  const sessionPath = path.resolve(env.whatsappSessionPath || './whatsapp-session', 'baileys', 'legacy');
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log('[WhatsApp] Sessao removida:', sessionPath);
    }
  } catch (e) {
    console.warn('[WhatsApp] Erro ao remover sessao:', e);
  }
}

export async function getChatsList(): Promise<any[]> {
  return [];
}

// ── Multi-connection status ─────────────────────────────────────────────
export const whatsappConnectionManager = {
  getConnectionRuntime: (id: string) => {
    const state = baileysProviderService.getMultiState(id);
    if (!state) return null;
    return {
      id,
      connected: state.connected,
      qrCode: state.qrCode,
      error: state.error,
      client: state.socket,
    };
  },
  getClient: (id: string) => {
    const state = baileysProviderService.getMultiState(id);
    return state?.socket || null;
  },
  getAllConnectionsStatus: () => {
    const allStates = baileysProviderService.getAllMultiStates();
    return Array.from(allStates.entries()).map(([id, state]) => ({
      id,
      connected: state.connected,
      scanning: !!state.qrCode,
      state: state.connected ? 'CONNECTED' : 'DISCONNECTED',
      error: state.error,
      qrCode: state.qrCode,
      lastMessageAt: state.lastMessageAt,
      lastHeartbeat: Date.now(),
    }));
  },
  disconnectConnection: async (id: string) => {
    await baileysProviderService.disconnectMulti(id);
  },
  getConnectionStatus: async (id: string) => {
    const state = baileysProviderService.getMultiState(id);
    if (!state) throw new Error(`Connection ${id} not found`);
    return {
      id,
      connected: state.connected,
      scanning: !!state.qrCode,
      state: state.connected ? 'CONNECTED' : 'DISCONNECTED',
      error: state.error,
      qrCode: state.qrCode,
      lastMessageAt: state.lastMessageAt,
      lastHeartbeat: Date.now(),
    };
  },
};
