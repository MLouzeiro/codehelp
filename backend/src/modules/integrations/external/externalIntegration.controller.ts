import { Request, Response } from 'express';
import prisma from '../../../config/database';
import {
  encryptSecret,
  maskSecret,
  testConnection,
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
  logInbound,
} from './externalIntegration.service';

// ── Helpers de serialização segura ────────────────────────────────────
// Nunca expõe segredos completos — apenas mascarados.

function serializeIntegration(row: any): any {
  return {
    id: row.id,
    nome: row.nome,
    slug: row.slug,
    tipo: row.tipo,
    baseUrl: row.baseUrl,
    authType: row.authType,
    hasApiKey: Boolean(row.apiKeyEnc),
    hasToken: Boolean(row.tokenEnc),
    apiKey: maskSecret(row.apiKeyEnc ? '****' : null),
    headersJson: row.headersJson,
    timeoutMs: row.timeoutMs,
    ativo: row.ativo,
    webhookPath: row.webhookPath,
    hasWebhookSecret: Boolean(row.webhookSecret),
    lastTestAt: row.lastTestAt,
    lastTestStatus: row.lastTestStatus,
    lastTestError: row.lastTestError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listIntegrations(req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.externalIntegration.findMany({ orderBy: { nome: 'asc' } });
    res.json(rows.map(serializeIntegration));
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao listar integracoes: ${err.message}` });
  }
}

export async function getIntegration(req: Request, res: Response): Promise<void> {
  try {
    const row = await prisma.externalIntegration.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Integracao nao encontrada' });
      return;
    }
    res.json(serializeIntegration(row));
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao buscar integracao: ${err.message}` });
  }
}

export async function createIntegration(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};
    const validation = validarConfig(body);
    if (validation) {
      res.status(400).json({ error: validation });
      return;
    }
    const slug = String(body.slug || body.nome || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await prisma.externalIntegration.findUnique({ where: { slug } });
    if (existing) {
      res.status(409).json({ error: `Ja existe uma integracao com o slug "${slug}"` });
      return;
    }

    const headersJson = body.headersJson || '{}';
    let parsedHeaders: any = {};
    try {
      parsedHeaders = typeof headersJson === 'string' ? JSON.parse(headersJson) : headersJson;
    } catch {
      res.status(400).json({ error: 'headersJson invalido — deve ser um JSON' });
      return;
    }

    const row = await prisma.externalIntegration.create({
      data: {
        nome: String(body.nome).trim(),
        slug,
        tipo: String(body.tipo || 'crm'),
        baseUrl: String(body.baseUrl).trim().replace(/\/+$/, ''),
        authType: String(body.authType || 'api_key'),
        apiKeyEnc: body.apiKey ? encryptSecret(String(body.apiKey)) : null,
        tokenEnc: body.token ? encryptSecret(String(body.token)) : null,
        headersJson: JSON.stringify(parsedHeaders),
        timeoutMs: Math.max(1000, Math.min(120000, Number(body.timeoutMs || 15000))),
        webhookPath: body.webhookPath ? String(body.webhookPath) : null,
        webhookSecret: body.webhookSecret ? String(body.webhookSecret) : null,
      },
    });
    res.status(201).json(serializeIntegration(row));
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao criar integracao: ${err.message}` });
  }
}

export async function updateIntegration(req: Request, res: Response): Promise<void> {
  try {
    const row = await prisma.externalIntegration.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Integracao nao encontrada' });
      return;
    }
    const body = req.body || {};
    const validation = validarConfig(body);
    if (validation) {
      res.status(400).json({ error: validation });
      return;
    }

    const data: any = {};
    if (body.nome !== undefined) data.nome = String(body.nome).trim();
    if (body.baseUrl !== undefined) data.baseUrl = String(body.baseUrl).trim().replace(/\/+$/, '');
    if (body.authType !== undefined) data.authType = String(body.authType);
    if (body.headersJson !== undefined) {
      try {
        data.headersJson = JSON.stringify(typeof body.headersJson === 'string' ? JSON.parse(body.headersJson) : body.headersJson);
      } catch {
        res.status(400).json({ error: 'headersJson invalido — deve ser um JSON' });
        return;
      }
    }
    if (body.timeoutMs !== undefined) data.timeoutMs = Math.max(1000, Math.min(120000, Number(body.timeoutMs)));
    if (body.webhookPath !== undefined) data.webhookPath = body.webhookPath ? String(body.webhookPath) : null;
    if (body.webhookSecret !== undefined) data.webhookSecret = body.webhookSecret ? String(body.webhookSecret) : null;
    // Segredos: só sobrescreve se fornecidos (evita apagar sem querer)
    if (body.apiKey !== undefined && body.apiKey) data.apiKeyEnc = encryptSecret(String(body.apiKey));
    if (body.token !== undefined && body.token) data.tokenEnc = encryptSecret(String(body.token));

    const updated = await prisma.externalIntegration.update({ where: { id: req.params.id }, data });
    res.json(serializeIntegration(updated));
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao atualizar integracao: ${err.message}` });
  }
}

export async function toggleIntegration(req: Request, res: Response): Promise<void> {
  try {
    const row = await prisma.externalIntegration.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Integracao nao encontrada' });
      return;
    }
    const ativo = req.body?.ativo !== undefined ? Boolean(req.body.ativo) : !row.ativo;
    const updated = await prisma.externalIntegration.update({ where: { id: req.params.id }, data: { ativo } });
    res.json(serializeIntegration(updated));
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao alternar integracao: ${err.message}` });
  }
}

export async function deleteIntegration(req: Request, res: Response): Promise<void> {
  try {
    const row = await prisma.externalIntegration.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Integracao nao encontrada' });
      return;
    }
    await prisma.externalIntegration.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao remover integracao: ${err.message}` });
  }
}

// ── Test de conexão ───────────────────────────────────────────────────

export async function testIntegrationConnection(req: Request, res: Response): Promise<void> {
  try {
    const result = await testConnection(req.params.id);
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.error || 'Falha na conexao' });
      return;
    }
    res.json({ ok: true, status: result.status, durationMs: result.durationMs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: `Erro ao testar conexao: ${err.message}` });
  }
}

// ── Logs de auditoria ─────────────────────────────────────────────────

export async function getIntegrationLogs(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const [total, logs] = await Promise.all([
      prisma.externalIntegrationLog.count({ where: { integrationId: req.params.id } }),
      prisma.externalIntegrationLog.findMany({
        where: { integrationId: req.params.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({ total, page, limit, logs });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao buscar logs: ${err.message}` });
  }
}

// ── Outbound: consultas no CRM externo ────────────────────────────────

export async function consultarCliente(req: Request, res: Response): Promise<void> {
  try {
    const result = await consultarClienteExterno(req.params.integrationId, req.params.clienteId);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function consultarEmpresa(req: Request, res: Response): Promise<void> {
  try {
    const result = await consultarEmpresaExterna(req.params.integrationId, req.params.empresaId);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function consultarContatos(req: Request, res: Response): Promise<void> {
  try {
    const result = await consultarContatosExternos(req.params.integrationId, req.params.clienteId);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function consultarContratos(req: Request, res: Response): Promise<void> {
  try {
    const result = await consultarContratosExternos(req.params.integrationId, req.params.clienteId);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function consultarServicos(req: Request, res: Response): Promise<void> {
  try {
    const result = await consultarServicosExternos(req.params.integrationId, req.params.clienteId);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Outbound: sincronizar ticket/atendimento ──────────────────────────

export async function syncTicket(req: Request, res: Response): Promise<void> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.ticketId },
      select: { id: true, protocolo: true, status: true, etapa: true, prioridade: true, assunto: true },
    });
    if (!ticket) {
      res.status(404).json({ ok: false, error: 'Ticket nao encontrado' });
      return;
    }
    const result = await enviarAtualizacaoTicketExterno(req.params.integrationId, ticket);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function syncAtendimento(req: Request, res: Response): Promise<void> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.ticketId },
      select: { id: true, protocolo: true, status: true, etapa: true },
    });
    if (!ticket) {
      res.status(404).json({ ok: false, error: 'Ticket nao encontrado' });
      return;
    }
    const messages = await prisma.message.findMany({
      where: { ticketId: ticket.id },
      orderBy: { sentAt: 'desc' },
      take: 200,
      select: { fromMe: true, content: true, sentAt: true },
    });
    const result = await enviarInfoAtendimentoExterno(req.params.integrationId, ticket, messages);
    if (!result.ok) {
      res.status(result.status || 502).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, data: result.data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Webhook (inbound) ─────────────────────────────────────────────────

export async function receberWebhook(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug;
    const integration = await buscarPorSlug(slug);
    if (!integration) {
      res.status(404).json({ error: 'Integracao nao encontrada' });
      return;
    }
    if (!checkSignature(integration, req.body, req.headers['x-webhook-signature'] as string | undefined)) {
      res.status(401).json({ error: 'Assinatura invalida' });
      return;
    }
    await logInbound({ integrationId: integration.id, body: req.body, endpoint: req.originalUrl });
    res.json({ ok: true, received: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao processar webhook: ${err.message}` });
  }
}

export default {
  listIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  toggleIntegration,
  deleteIntegration,
  testIntegrationConnection,
  getIntegrationLogs,
  consultarCliente,
  consultarEmpresa,
  consultarContatos,
  consultarContratos,
  consultarServicos,
  syncTicket,
  syncAtendimento,
  receberWebhook,
};