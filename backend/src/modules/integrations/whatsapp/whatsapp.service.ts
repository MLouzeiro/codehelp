import { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import path from 'path';
import os from 'os';
import prisma from '../../../config/database';
import { env } from '../../../config/env';
import {
  ensureHelpdeskConfigs,
  getEtapaConfig,
  buildMessageVars,
  interpolate,
  sendStageAutoMessage,
} from '../../helpdesk/helpdesk.service';
import {
  iniciarOuResetarTriagem,
  cancelarTriagem,
  enviarMenuInicial,
  processarOpcaoMenu,
  reenviarMenuPorInvalido,
  detectarOpcaoMenu,
} from '../../helpdesk/triagem.service';
import {
  isHorarioAtendimento,
  getHorarioConfig,
} from '../../helpdesk/horario';
import { montarForaHorario } from '../../helpdesk/menu';

let whatsappClient: Client | null = null;
let qrCodeData: string | null = null;
let isConnected = false;
let connectionError: string | null = null;
let initializing = false;
let lastHeartbeat = Date.now();
let lastMessageAt: Date | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;

const SESSION_DIR = path.resolve(__dirname, '../../../../whatsapp-session');
const processingLocks = new Set<string>();
let protocoloLock: Promise<unknown> = Promise.resolve();

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function withProtocoloLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = protocoloLock.then(fn, fn);
  protocoloLock = next.catch(() => undefined);
  return next;
}

function clearReconnectTimer() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function scheduleReconnect(reason: string) {
  clearReconnectTimer();
  console.warn(`[WhatsApp] Reagendando reconexÃ£o em 15s â€” motivo: ${reason}`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initializeClient().catch((e) => console.error('[WhatsApp] Erro na reconexÃ£o:', e?.message || e));
  }, 15000);
}

function startHealthCheck() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(async () => {
    if (!whatsappClient) return;
    if (!isConnected) return;
    pingHeartbeat();
    try {
      const state = await whatsappClient.getState();
      if (state && (state === 'CONFLICT' || state === 'UNLAUNCHED' || state === 'UNPAIRED')) {
        console.warn(`[WhatsApp] Estado invÃ¡lido detectado: ${state} â€” reconectando`);
        connectionError = `Estado: ${state}`;
        isConnected = false;
        try { await whatsappClient.destroy(); } catch { }
        whatsappClient = null;
        scheduleReconnect(`state_${state}`);
      }
    } catch (err: any) {
      console.warn(`[WhatsApp] Erro no health check: ${err?.message || err}`);
    }
  }, 60000);
}

export function pingHeartbeat() {
  lastHeartbeat = Date.now();
}

export function getLastMessageAt() {
  return lastMessageAt;
}

export async function getWhatsAppState(): Promise<string | null> {
  if (!whatsappClient) return null;
  try {
    return await whatsappClient.getState();
  } catch {
    return null;
  }
}

export function getClient(): Client | null {
  return whatsappClient;
}

export function isClientConnected(): boolean {
  return isConnected;
}

export function getQrCodeData(): string | null {
  return qrCodeData;
}

export function getConnectionError(): string | null {
  return connectionError;
}

export async function initializeClient(): Promise<void> {
  if (whatsappClient || initializing) return;
  initializing = true;
  clearReconnectTimer();

  whatsappClient = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR, clientId: 'codemed-hub' }),
    puppeteer: {
      headless: true,
      executablePath: env.whatsappChromePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    },
  });

  whatsappClient.on('qr', (qr) => {
    qrCodeData = qr;
    connectionError = null;
    qrcode.generate(qr, { small: true });
    console.log('[WhatsApp] QR Code gerado. Escaneie com o celular.');
  });

  whatsappClient.on('authenticated', () => {
    console.log('[WhatsApp] Autenticado com sucesso');
    connectionError = null;
  });

  whatsappClient.on('auth_failure', (msg) => {
    isConnected = false;
    connectionError = `Falha de autenticaÃ§Ã£o: ${msg}`;
    console.error('[WhatsApp] Falha de autenticaÃ§Ã£o:', msg);
    scheduleReconnect('auth_failure');
  });

  whatsappClient.on('ready', () => {
    isConnected = true;
    qrCodeData = null;
    connectionError = null;
    lastHeartbeat = Date.now();
    startHealthCheck();
    console.log('[WhatsApp] Cliente pronto e conectado!');
  });

  whatsappClient.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Carregando ${percent}% â€” ${message}`);
    lastHeartbeat = Date.now();
  });

  whatsappClient.on('change_state', (state) => {
    console.log('[WhatsApp] Estado alterado:', state);
    lastHeartbeat = Date.now();
    if (state === 'CONFLICT' || state === 'UNLAUNCHED' || state === 'UNPAIRED') {
      isConnected = false;
      connectionError = `Estado: ${state}`;
      scheduleReconnect(`state_${state}`);
    }
  });

  whatsappClient.on('disconnected', (reason) => {
    isConnected = false;
    connectionError = `Desconectado: ${reason}`;
    console.log('[WhatsApp] Desconectado:', reason);
    if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null; }
    scheduleReconnect(`disconnected_${reason}`);
  });

  whatsappClient.on('message', async (message: any) => {
    try {
      pingHeartbeat();
      lastMessageAt = new Date();
      if (message.fromMe) return;
      await handleIncomingMessage(message);
    } catch (err) {
      console.error('[WhatsApp] Erro no message:', err);
    }
  });

  try {
    connectionError = null;
    await whatsappClient.initialize();
    console.log('[WhatsApp] InicializaÃ§Ã£o concluÃ­da');
  } catch (error: any) {
    connectionError = error?.message || 'Erro ao inicializar WhatsApp';
    console.error('[WhatsApp] Falha na inicializaÃ§Ã£o:', error?.message || error);
    whatsappClient = null;
    scheduleReconnect('initialize_failed');
  } finally {
    initializing = false;
  }
}

async function handleIncomingMessage(message: any) {
  try {
    if (!message || !message.from) return;
    const fromMe = !!message.fromMe;
    if (fromMe) return;
    let contact: any = null;
    try { contact = await message.getContact(); } catch { /* fallback abaixo */ }
    const chatId = sanitizePhoneNumber(message.from);
    const phoneDigits = chatId.replace(/[^\d]/g, '');
    const phoneLookup = phoneDigits.slice(-11);
    lastMessageAt = new Date();

    while (processingLocks.has(chatId)) await sleep(50);
    processingLocks.add(chatId);

    try {
      const horarioCfg = await getHorarioConfig();
      const horarioOk = isHorarioAtendimento(horarioCfg);

      let ticket = await prisma.ticket.findFirst({
        where: {
          OR: [
            { contactPhone: chatId },
            { contactPhone: { contains: phoneLookup } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      if (ticket) {
        if (ticket.status === 'fechado') {
          ticket = await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'em_andamento', etapa: 'fila', dataFechamento: null },
          });
          await prisma.ticketStageEvent.create({
            data: {
              ticketId: ticket.id,
              etapaAnterior: 'concluido',
              etapaNova: 'fila',
              origem: 'automatico',
            },
          });
          sendStageAutoMessage(ticket.id, 'fila').catch((e) =>
            console.warn('Failed to send fila auto message:', e)
          );
        }
      } else {
        if (!horarioOk) {
          const contactName = (contact?.pushname || contact?.name || chatId) as string;
          const msg = await montarForaHorario(contactName);
          const phone = chatId.replace(/@c\.us$/i, '');
          await sendWhatsAppMessage(phone, msg);
          return;
        }

        let client = phoneLookup
          ? await prisma.client.findFirst({
              where: { telefone: { contains: phoneLookup } },
            })
          : null;

        const contactName = (contact?.pushname || contact?.name || chatId) as string;

        await ensureHelpdeskConfigs();

        const created = await prisma.ticket.create({
          data: {
            contactName,
            contactPhone: chatId,
            status: 'aberto',
            etapa: 'triagem',
            canal: 'whatsapp',
            clientId: client?.id,
          },
        });
        ticket = created;

        await prisma.ticketStageEvent.create({
          data: {
            ticketId: created.id,
            etapaAnterior: 'novo',
            etapaNova: 'triagem',
            origem: 'automatico',
          },
        });
      }

      let mediaUrl: string | null = null;
      if (message.hasMedia) {
        try {
          const media = await message.getMedia();
          mediaUrl = media.data;
        } catch {
          console.warn('Failed to download media for message');
        }
      }

      await prisma.message.create({
        data: {
          ticketId: ticket!.id,
          fromMe: false,
          content: message.body || (mediaUrl ? '(mídia)' : ''),
          mediaUrl,
        },
      });

      if (ticket!.etapa === 'triagem' && !ticket!.protocolo) {
        const opcao = detectarOpcaoMenu(message.body || '');
        if (opcao) {
          processarOpcaoMenu(ticket!.id, opcao, message.body || '').catch((e) =>
            console.error('[WhatsApp] Erro ao processar opcao do menu:', e?.message || e)
          );
        } else {
          const temAlgumaMsgDoBot = await prisma.message.count({
            where: { ticketId: ticket!.id, fromMe: true },
          });
          if (temAlgumaMsgDoBot === 0) {
            enviarMenuInicial(ticket!.id).catch((e) =>
              console.error('[WhatsApp] Erro ao enviar menu inicial:', e?.message || e)
            );
          } else {
            reenviarMenuPorInvalido(ticket!.id).catch((e) =>
              console.error('[WhatsApp] Erro ao reenviar menu:', e?.message || e)
            );
          }
          iniciarOuResetarTriagem(ticket!.id).catch((e) =>
            console.error('[WhatsApp] Erro ao iniciar triagem:', e?.message || e)
          );
        }
      }
    } finally {
      processingLocks.delete(chatId);
    }
  } catch (error) {
    console.error('[WhatsApp] Erro ao processar mensagem recebida:', error);
  }
}

async function createTicketWithUniqueProtocolo(
  ticketData: Record<string, any>,
  maxRetries = 5
): Promise<any> {
  return withProtocoloLock(async () => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const protocolo = await generateProtocolo();
      try {
        return await prisma.ticket.create({ data: { ...ticketData, protocolo } });
      } catch (err: any) {
        const target = err?.meta?.target;
        const isProtocoloConflict =
          err?.code === 'P2002' &&
          (Array.isArray(target) ? target.includes('protocolo') : target === 'protocolo');
        if (isProtocoloConflict && attempt < maxRetries - 1) continue;
        throw err;
      }
    }
    throw new Error('Não foi possível gerar protocolo único após múltiplas tentativas');
  });
}

export async function disconnectClient(): Promise<void> {
  clearReconnectTimer();
  if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null; }
  if (whatsappClient) {
    try {
      await whatsappClient.logout();
    } catch (e) {
      console.warn('[WhatsApp] Erro no logout:', e);
    }
    try {
      await whatsappClient.destroy();
    } catch (e) {
      console.warn('[WhatsApp] Erro no destroy:', e);
    }
    whatsappClient = null;
    isConnected = false;
    qrCodeData = null;
    connectionError = null;
  }
}

export const SUBJECTS = [
  { value: 'suporte_tecnico', label: 'Suporte TÃ©cnico' },
  { value: 'duvida_faturamento', label: 'DÃºvida/Faturamento' },
  { value: 'solicitacao_mudanca', label: 'SolicitaÃ§Ã£o de MudanÃ§a' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'reclamacao', label: 'ReclamaÃ§Ã£o' },
  { value: 'orcamento', label: 'OrÃ§amento' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'outro', label: 'Outro' },
];

export function classifyMessage(text: string): string {
  const lower = text.toLowerCase();
  if (/(erro|bug|nÃ£o funciona|quebrou|falha|problema|travou|parou)/.test(lower)) return 'suporte_tecnico';
  if (/(boleto|fatura|nota|pagamento|cobranÃ§a|preÃ§o|valor|contrato|dinheiro|pix)/.test(lower)) return 'duvida_faturamento';
  if (/(quero|preciso|mudar|adicionar|novo|implementar|sugestÃ£o|melhoria|gostaria)/.test(lower)) return 'solicitacao_mudanca';
  if (/(como|ajuda|ensinar|aprender|dÃºvida|funciona|tutorial|manual|orientaÃ§Ã£o)/.test(lower)) return 'treinamento';
  if (/(insatisfeito|pÃ©ssimo|horrÃ­vel|reclamaÃ§Ã£o|chateado|decepÃ§Ã£o|ruim)/.test(lower)) return 'reclamacao';
  if (/(orÃ§amento|quanto custa|preÃ§o|valor|quero contratar)/.test(lower)) return 'orcamento';
  if (/(agendar|visita|horÃ¡rio|quando|pode ir|vir aqui)/.test(lower)) return 'agendamento';
  return 'outro';
}

export function getSubjectLabel(value: string): string {
  return SUBJECTS.find((s) => s.value === value)?.label || value;
}

export async function sendProtocolReply(contactPhone: string, protocolo: string, tipo: 'abertura' | 'fechamento'): Promise<void> {
  const msg = tipo === 'abertura'
    ? `OlÃ¡! ðŸ‘‹\n\nSeu chamado foi aberto com sucesso.\nðŸ“‹ Protocolo: *${protocolo}*\n\nEm breve nossa equipe entrarÃ¡ em contato.\n\nAtenciosamente,\nEquipe Codemed`
    : `OlÃ¡! ðŸ‘‹\n\nSeu chamado foi finalizado.\nðŸ“‹ Protocolo: *${protocolo}*\n\nAgradecemos pelo contato!\n\nAtenciosamente,\nEquipe Codemed`;

  await sendWhatsAppMessage(contactPhone, msg);
}

export function sanitizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 7) return `${phone}@c.us`;
  return `${digits}@c.us`;
}

export async function generateProtocolo(): Promise<string> {
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

  return `${prefixo}-${String(seq).padStart(4, '0')}`;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!whatsappClient || !isConnected) {
    return { success: false, error: 'WhatsApp nÃ£o conectado' };
  }
  const digits = to.replace(/[^\d]/g, '').slice(-13);
  const formattedNumber = `${digits}@c.us`;

  try {
    let chat: any;

    try {
      const chats = await whatsappClient.getChats();
      chat = chats.find((c: any) => {
        const num = c.id?.user?.replace(/[^\d]/g, '') || '';
        return num.includes(digits) || digits.includes(num);
      });
    } catch { /* ignore */ }

    if (chat) {
      await chat.sendMessage(message);
      console.log(`Message sent via chat to ${chat.id._serialized}`);
      return { success: true };
    }

    try {
      await whatsappClient.sendMessage(formattedNumber, message);
      console.log(`Message sent to ${formattedNumber}`);
      return { success: true };
    } catch (err1: any) {
      if (err1?.message?.includes('LID') || err1?.message?.includes('No LID')) {
        const numberId = await whatsappClient.getNumberId(digits);
        if (numberId?._serialized) {
          await whatsappClient.sendMessage(numberId._serialized, message);
          console.log(`Message sent via getNumberId to ${numberId._serialized}`);
          return { success: true };
        }
        return { success: false, error: `Contato nÃ£o encontrado no WhatsApp. Envie uma mensagem para este nÃºmero pelo celular primeiro.` };
      }
      throw err1;
    }
  } catch (error: any) {
    console.warn(`Failed to send to ${digits}:`, error?.message);
    return { success: false, error: `Falha ao enviar: ${error?.message || 'erro desconhecido'}` };
  }
}

export async function getChatsList() {
  if (!whatsappClient || !isConnected) return [];
  const chats = await whatsappClient.getChats();
  return chats.map((chat) => ({
    id: chat.id._serialized,
    name: chat.name,
    unreadCount: chat.unreadCount,
    timestamp: chat.timestamp,
  }));
}
