/**
 * Utilitários compartilhados dos providers WhatsApp (FASE 9 — deduplicação).
 * Extrai padrões idênticos repetidos entre providers sem alterar comportamento.
 */

/** Remove tudo que não é dígito do telefone. Equivalente a `phone.replace(/[^\d]/g, '')`. */
export function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/** Normaliza um JID/chatId: remove sufixo de grupo/provedor e extrai dígitos. */
export function phoneDigitsFromChat(chatId: string): string {
  return chatId.replace(/@[^:]+$/i, '').replace(/[^\d]/g, '');
}
