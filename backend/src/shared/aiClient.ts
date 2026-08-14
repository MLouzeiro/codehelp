import { env } from '../config/env';

// ── Cliente compartilhado da API Claude (Anthropic) ────────────────────
// FASE 2 da refatoração: única implementação de chamada à API Anthropic.
// Antes existiam 8+ cópias (ai.service, aiAgentMonitor, aiTriage,
// aiValidation, aiTicket, analytics.controller, weeklyReport, ai-audit,
// ai-categorize). Todas agora usam este módulo.

export const AI_MODEL = 'claude-sonnet-4-20250514';

export function hasClaude(): boolean {
  return !!env.anthropicKey;
}

/**
 * Chama a API de mensagens da Anthropic com um prompt do usuário.
 * @param prompt Conteúdo da mensagem enviado ao modelo.
 * @param maxTokens Limite de tokens de resposta (padrão 1200).
 * @returns O texto da resposta ou string vazia se não houver conteúdo.
 */
export async function callClaude(prompt: string, maxTokens = 1200): Promise<string> {
  if (!hasClaude()) throw new Error('Chave Anthropic não configurada');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.content?.[0]?.text || '';
}
