import crypto from 'crypto';
import prisma from '../../../config/database';
import { env } from '../../../config/env';

// ── External Integration Service ───────────────────────────────────────
// Camada de integração com CRM/sistemas externos. Desacoplada do código do
// CRM: o Helpdesk fala com a API e a API fala com o CRM externo.
//
//   HELP DESK ⇄ ExternalIntegrationService ⇄ API externa (CRM)
//
// Regras de segurança:
//   - apiKey/token criptografados em repouso (AES-256-GCM) e mascarados na API.
//   - webhooks recebidos validados por HMAC-SHA256 (webhookSecret).
//   - rate limit + timeout + retry controlado + log de auditoria.

// ── Encryption at rest ────────────────────────────────────────────────
// Chave derivada de INTEGRATION_ENCRYPTION_KEY ou (fallback determinístico)
// de uma combinação de secrets existentes. Nunca usar chave fixa em código.
function getEncryptionKey(): Buffer {
  const secret = env.integrationEncryptionKey || `${env.jwtSecret}::${env.jwtRefreshSecret}`;
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivB64, tagB64, encB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !encB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Mascara segredo para exibição: mostra só os últimos 4 caracteres. */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseHeadersJson(headersJson: string | null | undefined): Record<string, string> {
  try {
    const parsed = headersJson ? JSON.parse(headersJson) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

interface ExternalIntegrationRow {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  baseUrl: string;
  authType: string;
  apiKeyEnc: string | null;
  tokenEnc: string | null;
  headersJson: string;
  timeoutMs: number;
  ativo: boolean;
  webhookSecret: string | null;
  lastTestAt: Date | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
}

function buildAuthHeaders(integration: ExternalIntegrationRow): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...parseHeadersJson(integration.headersJson),
  };
  const apiKey = integration.apiKeyEnc ? decryptSecret(integration.apiKeyEnc) : null;
  const token = integration.tokenEnc ? decryptSecret(integration.tokenEnc) : null;

  switch (integration.authType) {
    case 'api_key':
      if (apiKey) headers['X-API-Key'] = apiKey;
      break;
    case 'bearer_token':
      if (token) headers['Authorization'] = `Bearer ${token}`;
      break;
    case 'oauth2':
      if (token) headers['Authorization'] = `Bearer ${token}`;
      break;
    default:
      if (apiKey) headers['X-API-Key'] = apiKey;
  }
  return headers;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 800;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Core outbound client ──────────────────────────────────────────────

export interface CallExternalOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  integrationId: string;
  /** Suprime o log de auditoria (ex.: pings de saúde). */
  skipLog?: boolean;
}

export interface CallExternalResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  durationMs: number;
  retries: number;
}

export async function callExternal(opts: CallExternalOptions): Promise<CallExternalResult> {
  const started = Date.now();
  const integration = await prisma.externalIntegration.findUnique({
    where: { id: opts.integrationId },
  });
  if (!integration) {
    return { ok: false, error: 'Integracao nao encontrada', durationMs: Date.now() - started, retries: 0 };
  }
  if (!integration.ativo) {
    return { ok: false, error: 'Integracao desativada', durationMs: Date.now() - started, retries: 0 };
  }

  const base = (integration.baseUrl || '').replace(/\/+$/, '');
  const url = `${base}${opts.path.startsWith('/') ? opts.path : `/${opts.path}`}`;
  const method = opts.method || 'GET';
  const headers = buildAuthHeaders(integration);
  const timeoutMs = integration.timeoutMs || 15000;

  let lastError = '';
  let lastStatus: number | undefined;
  let lastBody: string | undefined;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      lastStatus = response.status;
      lastBody = await response.text();

      if (response.ok) {
        let data: unknown = lastBody;
        try {
          data = lastBody ? JSON.parse(lastBody) : null;
        } catch {
          /* corpo não-JSON */
        }
        if (!opts.skipLog) {
          await logIntegrationCall({
            integrationId: integration.id,
            direction: 'outbound',
            endpoint: url,
            method,
            status: response.status,
            requestBody: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            responseBody: lastBody.slice(0, 4000),
            durationMs: Date.now() - started,
          });
        }
        return { ok: true, status: response.status, data, durationMs: Date.now() - started, retries };
      }

      lastError = lastBody.slice(0, 500) || `HTTP ${response.status}`;

      // Rate limit: respeitar Retry-After quando informado
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
        const delay = Math.min((retryAfter || 2) * 1000, 10_000);
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          retries++;
          continue;
        }
        break;
      }

      if (!RETRYABLE_STATUS.has(response.status) || attempt >= MAX_RETRIES) break;
      await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
      retries++;
    } catch (err: any) {
      lastError = err?.message || String(err);
      // Timeout/abort: retry apenas se ainda há tentativas
      if (attempt >= MAX_RETRIES) break;
      await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
      retries++;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!opts.skipLog) {
    await logIntegrationCall({
      integrationId: integration.id,
      direction: 'outbound',
      endpoint: url,
      method,
      status: lastStatus,
      requestBody: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      responseBody: lastBody?.slice(0, 2000),
      error: lastError,
      durationMs: Date.now() - started,
    });
  }
  return { ok: false, status: lastStatus, error: lastError, durationMs: Date.now() - started, retries };
}

// ── Log de auditoria ──────────────────────────────────────────────────

interface LogInput {
  integrationId: string;
  direction: string;
  endpoint?: string;
  method?: string;
  status?: number;
  requestBody?: string;
  responseBody?: string;
  error?: string;
  durationMs: number;
}

async function logIntegrationCall(input: LogInput): Promise<void> {
  try {
    await prisma.externalIntegrationLog.create({
      data: {
        integrationId: input.integrationId,
        direction: input.direction,
        endpoint: input.endpoint,
        method: input.method,
        status: input.status,
        requestBody: input.requestBody,
        responseBody: input.responseBody,
        error: input.error,
        durationMs: input.durationMs,
      },
    });
  } catch {
    // Log não-crítico — nunca quebra o fluxo
  }
}

/** Registra um webhook recebido (inbound) com corpo truncado. */
export async function logInbound(input: { integrationId: string; body: unknown; endpoint: string }): Promise<void> {
  await logIntegrationCall({
    integrationId: input.integrationId,
    direction: 'inbound',
    endpoint: input.endpoint,
    method: 'POST',
    requestBody: typeof input.body === 'string' ? input.body.slice(0, 4000) : JSON.stringify(input.body).slice(0, 4000),
    status: 200,
    durationMs: 0,
  });
}

// ── Test connection ───────────────────────────────────────────────────

export async function testConnection(integrationId: string): Promise<{ ok: boolean; status?: string; error?: string; durationMs?: number }> {
  const integration = await prisma.externalIntegration.findUnique({ where: { id: integrationId } });
  if (!integration) return { ok: false, error: 'Integracao nao encontrada' };

  const result = await callExternal({ integrationId, path: '/health', method: 'GET', skipLog: true });
  const status = result.ok ? 'ok' : `error:${result.status || 'network'}`;
  await prisma.externalIntegration.update({
    where: { id: integrationId },
    data: { lastTestAt: new Date(), lastTestStatus: status, lastTestError: result.error || null },
  });
  return { ok: result.ok, status, error: result.error, durationMs: result.durationMs };
}

// ── Webhook (inbound) ─────────────────────────────────────────────────

export function validarWebhookSignature(slug: string, body: unknown, signature: string | undefined): { ok: boolean; integration?: ExternalIntegrationRow; error?: string } {
  if (!slug) return { ok: false, error: 'slug ausente' };
  // Busca por slug — chamado de forma assíncrona pelo controller.
  return { ok: false, error: 'pending_db_lookup' };
}

export async function buscarPorSlug(slug: string): Promise<ExternalIntegrationRow | null> {
  return prisma.externalIntegration.findUnique({ where: { slug } }) as Promise<ExternalIntegrationRow | null>;
}

export function checkSignature(integration: { webhookSecret: string | null }, body: unknown, signature: string | undefined): boolean {
  if (!integration.webhookSecret) return false;
  if (!signature) return false;
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const expected = crypto.createHmac('sha256', integration.webhookSecret).update(raw).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Outbound helpers (API de consulta/integração) ─────────────────────

export async function consultarClienteExterno(integrationId: string, clienteId: string): Promise<CallExternalResult> {
  return callExternal({ integrationId, method: 'GET', path: `/clients/${clienteId}` });
}

export async function consultarEmpresaExterna(integrationId: string, empresaId: string): Promise<CallExternalResult> {
  return callExternal({ integrationId, method: 'GET', path: `/companies/${empresaId}` });
}

export async function consultarContatosExternos(integrationId: string, clienteId: string): Promise<CallExternalResult> {
  return callExternal({ integrationId, method: 'GET', path: `/clients/${clienteId}/contacts` });
}

export async function consultarContratosExternos(integrationId: string, clienteId: string): Promise<CallExternalResult> {
  return callExternal({ integrationId, method: 'GET', path: `/clients/${clienteId}/contracts` });
}

export async function consultarServicosExternos(integrationId: string, clienteId: string): Promise<CallExternalResult> {
  return callExternal({ integrationId, method: 'GET', path: `/clients/${clienteId}/services` });
}

export async function enviarAtualizacaoTicketExterno(integrationId: string, ticket: { id: string; protocolo?: string | null; status: string; etapa: string; prioridade?: string | null; assunto?: string | null }): Promise<CallExternalResult> {
  return callExternal({
    integrationId,
    method: 'POST',
    path: `/tickets/${ticket.id}/status`,
    body: {
      ticketId: ticket.id,
      protocolo: ticket.protocolo || null,
      status: ticket.status,
      etapa: ticket.etapa,
      prioridade: ticket.prioridade || null,
      assunto: ticket.assunto || null,
      dataEnvio: new Date().toISOString(),
    },
  });
}

export async function enviarInfoAtendimentoExterno(integrationId: string, ticket: { id: string; protocolo?: string | null; status: string; etapa: string }, mensagens: Array<{ fromMe: boolean; content: string | null; sentAt: Date }>): Promise<CallExternalResult> {
  return callExternal({
    integrationId,
    method: 'POST',
    path: `/tickets/${ticket.id}/atendimento`,
    body: {
      ticketId: ticket.id,
      protocolo: ticket.protocolo || null,
      status: ticket.status,
      etapa: ticket.etapa,
      mensagens: mensagens.slice(0, 200).map((m) => ({ fromMe: m.fromMe, conteudo: m.content, data: m.sentAt.toISOString() })),
    },
  });
}

// ── Config validation ─────────────────────────────────────────────────

export function validarConfig(input: { nome?: unknown; baseUrl?: unknown; authType?: unknown; timeoutMs?: unknown }): string | null {
  if (!input.nome || String(input.nome).trim().length === 0) return 'Nome da integracao e obrigatorio';
  if (!input.baseUrl || !/^https?:\/\//i.test(String(input.baseUrl))) return 'URL base invalida (use http(s)://)';
  if (input.authType && !['api_key', 'bearer_token', 'oauth2'].includes(String(input.authType))) return 'Tipo de autenticacao invalido';
  if (input.timeoutMs !== undefined && (Number(input.timeoutMs) < 1000 || Number(input.timeoutMs) > 120000)) return 'Timeout deve estar entre 1s e 120s';
  return null;
}

export default {
  callExternal,
  testConnection,
  encryptSecret,
  decryptSecret,
  maskSecret,
  validarConfig,
  consultarClienteExterno,
  consultarEmpresaExterna,
  consultarContatosExternos,
  consultarContratosExternos,
  consultarServicosExternos,
  enviarAtualizacaoTicketExterno,
  enviarInfoAtendimentoExterno,
  buscarPorSlug,
  checkSignature,
};