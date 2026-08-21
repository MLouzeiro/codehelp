import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { env } from '../config/env';
import { apiKeyAuth } from '../modules/integrations/public/publicApiAuth';
import {
  listarClientes, detalharCliente, listarTickets, detalharTicket, listarAgentes, listarContratos, atualizarStatusTicket,
} from '../modules/integrations/public/publicApi.service';

let clientId: string | null = null;
let ticketId: string | null = null;

beforeAll(async () => {
  await ensureHelpdeskEntities();
  env.integrationApiKeys = ['test-key-123', 'rw-key-456:rw'];
});

afterEach(async () => {
  if (ticketId) {
    await prisma.message.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    ticketId = null;
  }
  if (clientId) { await prisma.client.deleteMany({ where: { id: clientId } }); clientId = null; }
});

function makeReqRes() {
  const req: any = { headers: {}, query: {} };
  let status = 0; let body: any = null;
  const res: any = {
    status: (s: number) => { status = s; return res; },
    json: (b: any) => { body = b; return res; },
  };
  return { req, res, getStatus: () => status, getBody: () => body };
}

describe('API Pública de Integração — Auth', () => {
  it('rejeita requisição sem chave', () => {
    const { req, res, getStatus, getBody } = makeReqRes();
    apiKeyAuth(req, res, () => {});
    expect(getStatus()).toBe(401);
    expect(getBody().error).toContain('ausente');
  });

  it('rejeita chave inválida', () => {
    const { req, res, getStatus } = makeReqRes();
    req.headers['x-api-key'] = 'chave-errada';
    apiKeyAuth(req, res, () => {});
    expect(getStatus()).toBe(401);
  });

  it('aceita chave válida (leitura)', () => {
    const { req, res, getStatus } = makeReqRes();
    req.headers['x-api-key'] = 'test-key-123';
    apiKeyAuth(req, res, () => {});
    expect(getStatus()).toBe(0);
    expect(req.apiKeyMeta.scope).toBe('read');
  });

  it('aceita chave :rw com escopo de escrita', () => {
    const { req, res, getStatus } = makeReqRes();
    req.headers['x-api-key'] = 'rw-key-456:rw';
    apiKeyAuth(req, res, () => {});
    expect(getStatus()).toBe(0);
    expect(req.apiKeyMeta.scope).toBe('read-write');
  });
});

describe('API Pública de Integração — Leitura', () => {
  it('lista clientes com paginação', async () => {
    const client = await prisma.client.create({
      data: { razaoSocial: `API Cliente ${Date.now()}`, segmento: 'laboratorio' },
    });
    clientId = client.id;

    const res = await listarClientes({ page: 1, limit: 5 });
    expect(res.paginacao.page).toBe(1);
    expect(res.paginacao.total).toBeGreaterThanOrEqual(1);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
  });

  it('detalha cliente com colaboradores e ativos', async () => {
    const client = await prisma.client.create({
      data: {
        razaoSocial: `API Detalhe ${Date.now()}`,
        colaboradores: { create: { nome: 'Contato API', cargo: 'Gerente', whatsapp: '85999998800' } },
        ativos: { create: { nome: 'Terminal X', tipo: 'terminal', serial: 'SN-API-1' } },
      },
    });
    clientId = client.id;

    const detalhe = await detalharCliente(client.id);
    expect(detalhe.razaoSocial).toBeTruthy();
    expect(detalhe.colaboradores.length).toBeGreaterThanOrEqual(1);
    expect(detalhe.ativos.length).toBeGreaterThanOrEqual(1);
  });

  it('lista empresas apenas com CNPJ/CPF', async () => {
    const semCnpj = await prisma.client.create({ data: { razaoSocial: 'Sem CNPJ API' } });
    const comCnpj = await prisma.client.create({ data: { razaoSocial: 'Com CNPJ API', cnpjCpf: '12345678000199' } });
    clientId = comCnpj.id;
    await prisma.client.deleteMany({ where: { id: semCnpj.id } });

    const res = await listarEmpresasNaAPI();
    expect(res.data.every((c: any) => c.cnpjCpf)).toBe(true);
  });

  it('lista contratos com filtros', async () => {
    const client = await prisma.client.create({
      data: { razaoSocial: `Contrato API ${Date.now()}`, tipoContrato: 'assinatura', valorMensalidade: 500 },
    });
    clientId = client.id;

    const res = await listarContratos({ tipoContrato: 'assinatura' });
    expect(res.data.some((c: any) => c.id === client.id)).toBe(true);
  });

  it('lista tickets com filtro de status', async () => {
    const client = await prisma.client.create({ data: { razaoSocial: `Ticket API ${Date.now()}` } });
    clientId = client.id;
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `pub-${Date.now()}-${Math.random()}`,
        clientId: client.id,
        contactName: 'Cli Pub',
        contactPhone: '85999997704',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const res = await listarTickets({ status: 'aberto' });
    expect(res.data.some((t: any) => t.id === ticket.id)).toBe(true);
  });

  it('detalha ticket com mensagens e cliente', async () => {
    const client = await prisma.client.create({ data: { razaoSocial: `Ticket Detalhe API ${Date.now()}` } });
    clientId = client.id;
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `pub-det-${Date.now()}-${Math.random()}`,
        clientId: client.id,
        contactName: 'Cli Det',
        contactPhone: '85999997705',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        messages: { create: { fromMe: false, content: 'Problema no sistema', sentAt: new Date() } },
      },
    });
    ticketId = ticket.id;

    const detalhe = await detalharTicket(ticket.id);
    expect(detalhe.client?.razaoSocial).toBeTruthy();
    expect(detalhe.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('lista analistas ativos', async () => {
    const res = await listarAgentes({});
    expect(Array.isArray(res.data)).toBe(true);
    for (const a of res.data) expect((a as any).password).toBeUndefined();
  });
});

async function listarEmpresasNaAPI() {
  const { listarEmpresas } = await import('../modules/integrations/public/publicApi.service');
  return listarEmpresas({});
}

describe('API Pública de Integração — Escrita', () => {
  it('atualiza status do ticket', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `pub-w-${Date.now()}-${Math.random()}`,
        contactName: 'Cli Escrita',
        contactPhone: '85999997706',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const atualizado = await atualizarStatusTicket(ticket.id, { status: 'fechado', motivoStatus: 'resolvido via API' });
    expect(atualizado.status).toBe('fechado');
    expect(atualizado.motivoStatus).toBe('resolvido via API');
    expect(atualizado.dataFechamento).toBeTruthy();
  });

  it('rejeita status inválido', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `pub-w2-${Date.now()}-${Math.random()}`,
        contactName: 'Cli Escrita 2',
        contactPhone: '85999997707',
        status: 'aberto',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    await expect(atualizarStatusTicket(ticket.id, { status: 'inexistente' })).rejects.toThrow('Status inválido');
  });

  it('retorna 404 para ticket inexistente', async () => {
    await expect(atualizarStatusTicket('id-inexistente-xyz', { status: 'fechado' })).rejects.toThrow('não encontrado');
  });
});