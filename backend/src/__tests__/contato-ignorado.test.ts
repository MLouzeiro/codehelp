import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  ensureAmbienteHelpdesk,
  criarDepartamentoTeste,
  limparTicketsPorTelefone,
  makeSendMessageMock,
  abrirAtendimentoSempre,
  restaurarHorario,
  HorarioSnapshot,
} from './helpers/test-utils';
import { processIncomingMessageHandler } from '../modules/integrations/whatsapp/whatsapp-message-handler';
import {
  criarContatoIgnorado,
  reativarContatoIgnorado,
  alternarStatusContatoIgnorado,
  listarContatosIgnorados,
  getResumoContatosIgnorados,
  isOrigemIgnorada,
  invalidarCacheContatosIgnorados,
} from '../modules/integrations/whatsapp/contatosIgnorados.service';

// ⚠️ CRITICAL BUSINESS RULE — Contatos/grupos ignorados do Helpdesk.
// Mensagem de origem ignorada NÃO pode iniciar o fluxo automático (sem
// ticket, sem saudação, sem fila, sem IA). Ao reativar, volta ao normal.

const DEPT_SLUG = 'n_ign';
const PHONE_IGNORADO = '85999991001';
const PHONE_REATIVADO = '85999991002';
const PHONE_GRUPO = '120363000000000000@g.us';
const PHONE_NAO_IGNORADO = '85999991003';

let horarioSnapshot: HorarioSnapshot | null = null;

beforeAll(async () => {
  await ensureAmbienteHelpdesk();
  await criarDepartamentoTeste(DEPT_SLUG, 'N - Contato Ignorado');
  horarioSnapshot = await abrirAtendimentoSempre();
});

afterAll(async () => {
  if (horarioSnapshot) await restaurarHorario(horarioSnapshot);
  invalidarCacheContatosIgnorados();
  await prisma.contatoIgnorado.deleteMany({ where: { chave: { in: [PHONE_IGNORADO, PHONE_REATIVADO, PHONE_GRUPO] } } });
});

afterEach(async () => {
  invalidarCacheContatosIgnorados();
  await prisma.contatoIgnorado.deleteMany({ where: { chave: { in: [PHONE_IGNORADO, PHONE_REATIVADO, PHONE_GRUPO] } } });
  await limparTicketsPorTelefone(PHONE_IGNORADO);
  await limparTicketsPorTelefone(PHONE_REATIVADO);
  await limparTicketsPorTelefone(PHONE_NAO_IGNORADO);
});

describe('Contatos ignorados — service', () => {
  it('cria um contato ignorado e detecta pela origem', async () => {
    await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_IGNORADO, nome: 'Número de teste', motivo: 'Número interno' },
      null,
    );
    const res = await isOrigemIgnorada({ phoneDigits: PHONE_IGNORADO });
    expect(res.ignorado).toBe(true);
    expect(res.registro?.nome).toBe('Número de teste');
    expect(res.registro?.motivo).toBe('Número interno');
  });

  it('detecta ignorado mesmo com DDI 55 no telefone recebido', async () => {
    await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_REATIVADO, nome: 'Sem DDI', motivo: 'Teste' },
      null,
    );
    // Mensagem chega com 55 prefixado (formato do WhatsApp)
    const res = await isOrigemIgnorada({ phoneDigits: `55${PHONE_REATIVADO}` });
    expect(res.ignorado).toBe(true);
  });

  it('detecta grupo ignorado pelo jid', async () => {
    await criarContatoIgnorado(
      { tipo: 'grupo', chave: PHONE_GRUPO, nome: 'Equipe Desenvolvimento', motivo: 'Grupo interno' },
      null,
    );
    const res = await isOrigemIgnorada({ phoneDigits: '', jid: PHONE_GRUPO });
    expect(res.ignorado).toBe(true);
    expect(res.registro?.tipo).toBe('grupo');
  });

  it('reativa e volta a não ser ignorado', async () => {
    const criado = await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_REATIVADO, nome: 'Reativar', motivo: 'X' },
      null,
    );
    await reativarContatoIgnorado(criado.id, null);
    const res = await isOrigemIgnorada({ phoneDigits: PHONE_REATIVADO });
    expect(res.ignorado).toBe(false);
    const lista = await listarContatosIgnorados({});
    expect(lista.items.length).toBeGreaterThanOrEqual(0);
  });

  it('alterna status rapidamente (switch)', async () => {
    const criado = await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_REATIVADO, nome: 'Toggle', motivo: null },
      null,
    );
    await alternarStatusContatoIgnorado(criado.id, null);
    expect((await isOrigemIgnorada({ phoneDigits: PHONE_REATIVADO })).ignorado).toBe(false);
    await alternarStatusContatoIgnorado(criado.id, null);
    expect((await isOrigemIgnorada({ phoneDigits: PHONE_REATIVADO })).ignorado).toBe(true);
  });

  it('mantém histórico de auditoria após reativação', async () => {
    const criado = await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_REATIVADO, nome: 'Hist', motivo: 'Motivo teste' },
      null,
    );
    const reativado = await reativarContatoIgnorado(criado.id, null);
    expect(reativado.historico.length).toBeGreaterThanOrEqual(2);
    expect(reativado.historico.some((e: any) => e.acao === 'adicionado')).toBe(true);
    expect(reativado.historico.some((e: any) => e.acao === 'reativado')).toBe(true);
    expect(reativado.reativadoEm).not.toBeNull();
  });

  it('calcula resumo de indicadores', async () => {
    await criarContatoIgnorado({ tipo: 'contato', chave: PHONE_IGNORADO, nome: 'A', motivo: 'Número interno' }, null);
    await criarContatoIgnorado({ tipo: 'grupo', chave: PHONE_GRUPO, nome: 'G', motivo: 'Grupo interno' }, null);
    const resumo = await getResumoContatosIgnorados();
    expect(resumo.contatosIgnorados).toBeGreaterThanOrEqual(1);
    expect(resumo.gruposIgnorados).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(resumo.principaisMotivos)).toBe(true);
  });
});

describe('Contatos ignorados — integração com handler', () => {
  it('mensagem de contato ignorado NÃO cria ticket nem envia mensagem', async () => {
    await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_IGNORADO, nome: 'Teste Márcio', motivo: 'Número interno' },
      null,
    );
    const { fn, calls } = makeSendMessageMock();
    await processIncomingMessageHandler(
      { phone: PHONE_IGNORADO, text: 'Olá', contactName: 'Teste', provider: 'baileys', messageId: `ign-${Date.now()}` },
      fn,
    );
    expect(calls.length).toBe(0);
    const count = await prisma.ticket.count({ where: { contactPhone: PHONE_IGNORADO } });
    expect(count).toBe(0);
  });

  it('mensagem de grupo ignorado NÃO cria ticket', async () => {
    await criarContatoIgnorado(
      { tipo: 'grupo', chave: PHONE_GRUPO, nome: 'Equipe Dev', motivo: 'Grupo interno' },
      null,
    );
    const { fn, calls } = makeSendMessageMock();
    await processIncomingMessageHandler(
      { phone: PHONE_GRUPO, text: 'Olá', contactName: 'Grupo', provider: 'baileys', jid: PHONE_GRUPO, messageId: `grp-${Date.now()}` },
      fn,
    );
    expect(calls.length).toBe(0);
    const count = await prisma.ticket.count({ where: { contactJid: PHONE_GRUPO } });
    expect(count).toBe(0);
  });

  it('após reativar, o contato volta ao fluxo normal (cria ticket)', async () => {
    const criado = await criarContatoIgnorado(
      { tipo: 'contato', chave: PHONE_REATIVADO, nome: 'Reativar', motivo: 'Teste' },
      null,
    );
    await reativarContatoIgnorado(criado.id, null);

    const { fn } = makeSendMessageMock();
    await processIncomingMessageHandler(
      { phone: PHONE_REATIVADO, text: 'Olá', contactName: 'Cliente', provider: 'baileys', messageId: `re-${Date.now()}` },
      fn,
    );
    const count = await prisma.ticket.count({ where: { contactPhone: PHONE_REATIVADO } });
    expect(count).toBe(1);
  });

  it('contato não ignorado segue fluxo normal', async () => {
    const { fn } = makeSendMessageMock();
    await processIncomingMessageHandler(
      { phone: PHONE_NAO_IGNORADO, text: 'Olá', contactName: 'Cliente', provider: 'baileys', messageId: `ok-${Date.now()}` },
      fn,
    );
    const count = await prisma.ticket.count({ where: { contactPhone: PHONE_NAO_IGNORADO } });
    expect(count).toBe(1);
  });
});
