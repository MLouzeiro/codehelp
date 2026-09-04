import { env } from '../config/env';

// ── Cliente compartilhado da API Claude (Anthropic) ────────────────────
// FASE 2 da refatoração: única implementação de chamada à API Anthropic.
// Antes existiam 8+ cópias (ai.service, aiAgentMonitor, aiTriage,
// aiValidation, aiTicket, analytics.controller, weeklyReport, ai-audit,
// ai-categorize). Todas agora usam este módulo.

export const AI_MODEL = 'claude-sonnet-4-20250514';

// ── Pricing Anthropic (claude-sonnet-4-20250514) ────────────────────────
// https://www.anthropic.com/pricing#702702
const COST_INPUT_PER_TOKEN = 3.0 / 1_000_000;   // $3.00 / 1M input tokens
const COST_OUTPUT_PER_TOKEN = 15.0 / 1_000_000;  // $15.00 / 1M output tokens

export function hasClaude(): boolean {
  return !!env.anthropicKey;
}

/**
 * Chama a API de mensagens da Anthropic com um prompt do usuário.
 * Registra tokens usados e custo estimado em AICostLog (fire-and-forget).
 * @param prompt Conteúdo da mensagem enviado ao modelo.
 * @param maxTokens Limite de tokens de resposta (padrão 1200).
 * @param modulo Nome do módulo que fez a chamada (ex: 'triage', 'audit').
 * @returns O texto da resposta ou string vazia se não houver conteúdo.
 */
export async function callClaude(
  prompt: string,
  maxTokens = 1200,
  modulo?: string,
): Promise<string> {
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

  // ── Log de custos (fire-and-forget) ───────────────────────────────
  try {
    const usage = data.usage;
    if (usage) {
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const custoInput = Math.round(inputTokens * COST_INPUT_PER_TOKEN * 1_000_000) / 1_000_000;
      const custoOutput = Math.round(outputTokens * COST_OUTPUT_PER_TOKEN * 1_000_000) / 1_000_000;
      const custoTotal = custoInput + custoOutput;

      // Lazy import para não bloquear — Prisma singleton
      import('../config/database').then(({ default: prisma }) => {
        prisma.aICostLog.create({
          data: {
            modelo: AI_MODEL,
            inputTokens,
            outputTokens,
            custoInput,
            custoOutput,
            custoTotal,
            maxTokens,
            modulo: modulo || null,
            descricao: prompt.slice(0, 200),
          },
        }).catch(() => {});
      }).catch(() => {});
    }
  } catch {
    // Nunca quebrar o fluxo principal por causa do log
  }

  return data.content?.[0]?.text || '';
}
