import prisma from '../../../config/database';
import { sendWhatsAppMessage, sendWhatsAppListMessage } from './whatsapp.service';
import { normalizePhone } from './whatsapp-utils';

// ── WhatsAppMessageService ─────────────────────────────────────────────
// Camada de abstração para mensagens interativas.
// O provider específico (ex: Baileys) converte para o formato nativo da API.
// Quando o provider não suporta o componente, há fallback automático para texto.
//
//   Bot → WhatsAppMessageService → Provider (Baileys/Evolution/Cloud) → API WhatsApp

export interface InteractiveRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveSection {
  title: string;
  rows: InteractiveRow[];
}

export interface InteractiveListOptions {
  title: string;        // Texto do botão/header da lista
  description: string;  // Corpo da mensagem
  footer?: string;
  sections: InteractiveSection[];
  // Texto numerado customizado para o caminho de texto (Baileys/webjs/fallback).
  // Quando ausente, usa montarFallbackTexto (padrão genérico).
  fallbackTexto?: string;
  connectionId?: string;
  jid?: string;
}

export interface SendInteractiveResult {
  success: boolean;
  error?: string;
  messageId?: string;
  usedFallback: boolean;
}

// Determina o provider da conexão para decidir o tipo de envio.
// Sem connectionId assume Baileys (provider primário).
async function detectarProvider(connectionId?: string): Promise<string | null> {
  if (!connectionId) return null;
  try {
    const conn = await prisma.whatsAppConnection.findUnique({
      where: { id: connectionId },
      select: { provider: true },
    });
    return conn?.provider ?? null;
  } catch {
    return null;
  }
}

// Providers cujas listas interativas NÃO são entregues de forma confiável
// (Baileys: relayMessage resolve com success mas o WhatsApp não entrega — AGENTS.md).
// Para esses, enviar SEMPRE texto formatado numerado (entrega garantida).
const PROVIDERS_TEXTO_FORCADO = new Set(['baileys', 'whatsapp-webjs']);

// Envia uma LISTA interativa (single select) quando o provider suporta.
// Baileys/webjs → texto numerado SEMPRE (relayMessage não entrega listas).
// Evolution/Cloud → tenta lista interativa, com fallback explícito para texto.
// Fallback: mensagem de texto numerada — a lógica continua funcionando porque
// o cliente pode responder com o número da opção.
export async function enviarListaInterativa(to: string, opts: InteractiveListOptions): Promise<SendInteractiveResult> {
  const phone = normalizePhone(to);
  const provider = await detectarProvider(opts.connectionId);

  // Texto forçado para providers sem entrega confiável de listas.
  if (!provider || PROVIDERS_TEXTO_FORCADO.has(provider)) {
    const texto = opts.fallbackTexto ?? montarFallbackTexto(opts);
    const textResult = await sendWhatsAppMessage(phone, texto, opts.connectionId, opts.jid);
    console.log(
      `[WHATSAPP_INTERACTIVE] to=${phone} tipo=text motivo=provider_${provider || 'desconhecido'}_sem_lista ` +
      `success=${textResult.success} messageId=${textResult.messageId || ''}`,
    );
    return {
      success: textResult.success,
      messageId: textResult.messageId,
      error: textResult.error,
      usedFallback: true,
    };
  }

  const listResult = await sendWhatsAppListMessage(
    phone,
    opts.title,
    opts.description,
    opts.sections,
    opts.connectionId,
    opts.jid,
  );
  if (listResult.success) {
    console.log(
      `[WHATSAPP_INTERACTIVE] to=${phone} tipo=list success=true messageId=${listResult.messageId || ''}`,
    );
    return { success: true, messageId: listResult.messageId, usedFallback: false };
  }

  // Fallback explícito — nunca silencioso. Log para auditoria/debug.
  console.warn(
    `[WHATSAPP_INTERACTIVE] to=${phone} tipo=list success=false fallback=text motivo=${listResult.error || 'nao_suportado'}`,
  );
  const textoFallback = opts.fallbackTexto ?? montarFallbackTexto(opts);
  const textResult = await sendWhatsAppMessage(phone, textoFallback, opts.connectionId, opts.jid);
  if (textResult.success) {
    console.log(
      `[WHATSAPP_INTERACTIVE] to=${phone} tipo=text fallback=text success=true messageId=${textResult.messageId || ''}`,
    );
    return { success: true, messageId: textResult.messageId, usedFallback: true };
  }
  return {
    success: false,
    error: textResult.error || listResult.error || 'Nenhum provider WhatsApp disponivel',
    usedFallback: true,
  };
}

// Monta o texto de fallback numerado (número global por linha de todas as seções).
export function montarFallbackTexto(opts: InteractiveListOptions): string {
  const linhas: string[] = [opts.description];
  let idx = 1;
  for (const section of opts.sections) {
    const rows = section.rows
      .map((r) => `${idx++} - ${r.title}${r.description ? ` (${r.description})` : ''}`)
      .join('\n');
    linhas.push(section.title ? `*${section.title}*\n${rows}` : rows);
  }
  linhas.push('Responda com o *número* da opção desejada.');
  return linhas.join('\n\n');
}

// Envia texto simples via a mesma camada unificada.
export async function enviarTextoSimples(
  to: string,
  message: string,
  connectionId?: string,
  jid?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendWhatsAppMessage(to, message, connectionId, jid);
}
