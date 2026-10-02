import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import prisma from '../config/database';
import {
  ensureAmbienteHelpdesk,
  limparTicketsPorTelefone,
  abrirAtendimentoSempre,
  restaurarHorario,
  makeSendMessageMock,
  HorarioSnapshot,
} from './helpers/test-utils';
import { processIncomingMessageHandler, getConversationState, limparEstadoConversa } from '../modules/integrations/whatsapp/whatsapp-message-handler';
import { buscarTicketAtivo } from '../modules/helpdesk/flow.service';
import {
  decidirProcessamento,
  ordenarCronologicamente,
  registrarEventoConexao,
  iniciarJanelaRecuperacao,
  finalizarJanelaRecuperacao,
  obterJanela,
  marcarReconectado,
  notaRecuperada,
  notaDuplicada,
  notaErro,
} from '../modules/integrations/whatsapp/whatsapp-recovery.service';
import { enviarMenuInicial } from '../modules/helpdesk/triagem.service';

vi.mock('../modules/helpdesk/triagem.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/helpdesk/triagem.service')>();
  return { ...actual, enviarMenuInicial: vi.fn(async () => ({ ok: true })) };
});

const PHONE_RT = '85999991101';
const PHONE_RC = '85999991102';
const PHONE_DUP = '85999991103';
const PHONE_ORD = '85999991104';
const ALL_PHONES = [PHONE_RT, PHONE_RC, PHONE_DUP, PHONE_ORD];

let horarioSnapshot: HorarioSnapshot | null = null;

beforeAll(async () => {
  await ensureAmbienteHelpdesk();
  horarioSnapshot = await abrirAtendimentoSempre();
});

afterAll(async () => {
  if (horarioSnapshot) await restaurarHorario(horarioSnapshot);
});

afterEach(async () => {
  for (const phone of ALL_PHONES) {
    await limparTicketsPorTelefone(phone);
    limparEstadoConversa(phone);
  }
  vi.mocked(enviarMenuInicial).mockClear();
});

describe('Decisão de processamento (notify/append/recuperação)', () => {
  it('Cenário 1 — notify em tempo real é processado como REAL_TIME', () => {
    const agora = Math.floor(Date.now() / 1000);
    const d = decidirProcessamento({ type: 'notify', messageTimestampSec: agora });
    expect(d.processar).toBe(true);
    expect(d.recovered).toBe(false);
    expect(d.motivo).toContain('tempo real');
  });

  it('Cenário 1 — notify sem reconexão registrada nunca é marcado como recuperado', () => {
    const antiga = Math.floor(Date.now() / 1000) - 3600;
    const d = decidirProcessamento({ type: 'notify', messageTimestampSec: antiga });
    expect(d.processar).toBe(true);
    expect(d.recovered).toBe(false);
  });

  it('Cenário 2/3 — notify anterior à reconexão (idade > 60s) é RECOVERED', () => {
    const reconectou = Date.now();
    const enviadaDuranteQueda = Math.floor((reconectou - 10 * 60_000) / 1000);
    const d = decidirProcessamento({
      type: 'notify',
      messageTimestampSec: enviadaDuranteQueda,
      reconnectedAtMs: reconectou,
    });
    expect(d.processar).toBe(true);
    expect(d.recovered).toBe(true);
  });

  it('notify enviada segundos antes da reconexão (skew de relógio) segue REAL_TIME', () => {
    const reconectou = Date.now();
    const d = decidirProcessamento({
      type: 'notify',
      messageTimestampSec: Math.floor((reconectou - 5_000) / 1000),
      reconnectedAtMs: reconectou,
    });
    expect(d.processar).toBe(true);
    expect(d.recovered).toBe(false);
  });

  it('Cenário 2/3 — append (lote offline) dentro da janela é processado como RECOVERED', () => {
    const agora = Math.floor(Date.now() / 1000);
    const d = decidirProcessamento({ type: 'append', messageTimestampSec: agora - 3600 });
    expect(d.processar).toBe(true);
    expect(d.recovered).toBe(true);
  });

  it('append fora da janela máxima de recuperação NÃO é processado', () => {
    const antiga = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const d = decidirProcessamento({ type: 'append', messageTimestampSec: antiga });
    expect(d.processar).toBe(false);
    expect(d.motivo).toContain('janela');
  });

  it('append sem timestamp NÃO é processado', () => {
    const d = decidirProcessamento({ type: 'append', messageTimestampSec: 0 });
    expect(d.processar).toBe(false);
  });

  it('tipo de upsert desconhecido NÃO é processado', () => {
    const d = decidirProcessamento({ type: 'history-batch', messageTimestampSec: Math.floor(Date.now() / 1000) });
    expect(d.processar).toBe(false);
  });
});

describe('Ordenação cronológica', () => {
  it('Cenário 4 — mensagens fora de ordem são ordenadas 10:01 → 10:02 → 10:03', () => {
    const mensagens = [
      { id: 'C', ts: 1003 },
      { id: 'A', ts: 1001 },
      { id: 'B', ts: 1002 },
    ];
    const ordenadas = ordenarCronologicamente(mensagens, (m) => m.ts);
    expect(ordenadas.map((m) => m.id)).toEqual(['A', 'B', 'C']);
  });

  it('mensagens sem timestamp mantêm a ordem de chegada (estável)', () => {
    const mensagens = [{ id: 'X' }, { id: 'Y' }];
    const ordenadas = ordenarCronologicamente(mensagens, () => 0);
    expect(ordenadas.map((m) => m.id)).toEqual(['X', 'Y']);
  });
});

describe('Mensagem REAL_TIME (regressão — fluxo atual preservado)', () => {
  it('Cenário 1 — mensagem em tempo real cria ticket, salva mensagem e dispara o menu do bot', async () => {
    const { fn } = makeSendMessageMock();

    await processIncomingMessageHandler(
      {
        phone: PHONE_RT,
        text: 'Preciso de ajuda agora',
        contactName: 'Cliente Tempo Real',
        provider: 'baileys',
        messageId: `rt-1-${Date.now()}`,
        recovered: false,
      },
      fn,
    );

    const ativo = await buscarTicketAtivo(PHONE_RT);
    expect(ativo).not.toBeNull();
    expect(ativo?.canal).toBe('whatsapp_baileys');

    const msg = await prisma.message.findFirst({ where: { ticketId: ativo!.id, fromMe: false } });
    expect(msg?.content).toContain('Preciso de ajuda');
    expect(msg?.remoteId).toContain('rt-1-');

    expect(vi.mocked(enviarMenuInicial)).toHaveBeenCalledTimes(1);
    expect(getConversationState(PHONE_RT)).toBe('AWAITING_DEPARTMENT');
  });

  it('Cenário 7 — mensagem em tempo real durante janela de recuperação NÃO é afetada', async () => {
    const { fn } = makeSendMessageMock();
    iniciarJanelaRecuperacao('sessao-teste-janela', 10 * 60_000);
    expect(obterJanela('sessao-teste-janela')).toBeDefined();

    await processIncomingMessageHandler(
      {
        phone: PHONE_RT,
        text: 'Mensagem nova chegando durante sync',
        contactName: 'Cliente Durante Sync',
        provider: 'baileys',
        messageId: `rt-2-${Date.now()}`,
        recovered: false,
      },
      fn,
    );

    const ativo = await buscarTicketAtivo(PHONE_RT);
    expect(ativo).not.toBeNull();
    expect(vi.mocked(enviarMenuInicial)).toHaveBeenCalledTimes(1);
    expect(getConversationState(PHONE_RT)).toBe('AWAITING_DEPARTMENT');

    finalizarJanelaRecuperacao('sessao-teste-janela');
    expect(obterJanela('sessao-teste-janela')).toBeUndefined();
  });
});

describe('Mensagem RECOVERED (pós-reconexão)', () => {
  it('Cenário 2/3 — mensagem recuperada cria ticket e salva mensagem SEM disparar o bot', async () => {
    const { fn, calls } = makeSendMessageMock();

    await processIncomingMessageHandler(
      {
        phone: PHONE_RC,
        text: 'Cliente enviou enquanto sistema estava fora',
        contactName: 'Cliente Recuperado',
        provider: 'baileys',
        messageId: `rc-1-${Date.now()}`,
        recovered: true,
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
      fn,
    );

    const ativo = await buscarTicketAtivo(PHONE_RC);
    expect(ativo).not.toBeNull();
    expect(ativo?.status).toBe('aberto');

    const msg = await prisma.message.findFirst({ where: { ticketId: ativo!.id, fromMe: false } });
    expect(msg).not.toBeNull();
    expect(msg?.content).toContain('enquanto sistema estava fora');
    expect(msg?.remoteId).toContain('rc-1-');

    expect(vi.mocked(enviarMenuInicial)).not.toHaveBeenCalled();
    expect(getConversationState(PHONE_RC)).toBe('IDLE');
    expect(calls).toHaveLength(0);
  });

  it('Cenário 4 — duas mensagens recuperadas são salvas na ordem cronológica', async () => {
    const { fn } = makeSendMessageMock();
    const base = Date.now();

    await processIncomingMessageHandler(
      { phone: PHONE_ORD, text: 'A - Bom dia', provider: 'baileys', messageId: `ord-A-${base}`, recovered: true },
      fn,
    );
    await processIncomingMessageHandler(
      { phone: PHONE_ORD, text: 'B - Preciso de ajuda', provider: 'baileys', messageId: `ord-B-${base}`, recovered: true },
      fn,
    );
    await processIncomingMessageHandler(
      { phone: PHONE_ORD, text: 'C - É urgente', provider: 'baileys', messageId: `ord-C-${base}`, recovered: true },
      fn,
    );

    const ativo = await buscarTicketAtivo(PHONE_ORD);
    expect(ativo).not.toBeNull();

    const mensagens = await prisma.message.findMany({
      where: { ticketId: ativo!.id, fromMe: false },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    });
    expect(mensagens.map((m) => m.content)).toEqual([
      'A - Bom dia',
      'B - Preciso de ajuda',
      'C - É urgente',
    ]);
    expect(vi.mocked(enviarMenuInicial)).not.toHaveBeenCalled();
  });

  it('mensagem recuperada em ticket JÁ ativo é anexada sem criar segundo ticket', async () => {
    const { fn } = makeSendMessageMock();

    await processIncomingMessageHandler(
      { phone: PHONE_RC, text: 'Primeira em tempo real', provider: 'baileys', messageId: `rc-2a-${Date.now()}`, recovered: false },
      fn,
    );
    const ticket = await buscarTicketAtivo(PHONE_RC);
    expect(ticket).not.toBeNull();
    const totalAntes = await prisma.ticket.count({ where: { contactPhone: PHONE_RC } });

    vi.mocked(enviarMenuInicial).mockClear();

    await processIncomingMessageHandler(
      { phone: PHONE_RC, text: 'Mensagem antiga recuperada', provider: 'baileys', messageId: `rc-2b-${Date.now()}`, recovered: true },
      fn,
    );

    const totalDepois = await prisma.ticket.count({ where: { contactPhone: PHONE_RC } });
    expect(totalDepois).toBe(totalAntes);

    const mensagens = await prisma.message.findMany({
      where: { ticketId: ticket!.id, fromMe: false },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    });
    expect(mensagens.map((m) => m.content)).toContain('Mensagem antiga recuperada');
    expect(vi.mocked(enviarMenuInicial)).not.toHaveBeenCalled();
  });
});

describe('Idempotência (dedupe persistente)', () => {
  it('Cenário 5 — mensagem já existente no banco (remoteId) é ignorada sem criar ticket', async () => {
    const { fn, calls } = makeSendMessageMock();
    const messageId = `dup-${Date.now()}`;

    const ticket = await prisma.ticket.create({
      data: {
        contactName: 'Cliente Dedupe',
        contactPhone: PHONE_DUP,
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp_baileys',
      },
    });
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: false, content: 'mensagem original', remoteId: messageId },
    });

    const totalAntes = await prisma.ticket.count({ where: { contactPhone: PHONE_DUP } });

    await processIncomingMessageHandler(
      { phone: PHONE_DUP, text: 'tentativa de duplicada', provider: 'baileys', messageId },
      fn,
    );

    const totalDepois = await prisma.ticket.count({ where: { contactPhone: PHONE_DUP } });
    expect(totalDepois).toBe(totalAntes);

    const mensagens = await prisma.message.findMany({ where: { ticketId: ticket.id } });
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].content).toBe('mensagem original');
    expect(getConversationState(PHONE_DUP)).toBe('IDLE');
    expect(calls).toHaveLength(0);
  });

  it('webhook repetido (mesmo messageId) no mesmo processo continua bloqueado', async () => {
    const { fn } = makeSendMessageMock();
    const messageId = `dup-live-${Date.now()}`;

    await processIncomingMessageHandler(
      { phone: PHONE_DUP, text: 'primeira', provider: 'baileys', messageId },
      fn,
    );
    await processIncomingMessageHandler(
      { phone: PHONE_DUP, text: 'segunda duplicada', provider: 'baileys', messageId },
      fn,
    );

    const tickets = await prisma.ticket.findMany({ where: { contactPhone: PHONE_DUP } });
    expect(tickets).toHaveLength(1);
    const mensagens = await prisma.message.findMany({ where: { ticketId: tickets[0].id, fromMe: false } });
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].content).toBe('primeira');
  });
});

describe('Eventos de conexão e janela de recuperação', () => {
  const sessionId = `test-rec-${Date.now()}`;

  afterAll(async () => {
    await prisma.whatsAppSession.deleteMany({ where: { session: sessionId } });
  });

  it('registra desconexão e reconexão com downtime calculado', async () => {
    await registrarEventoConexao(sessionId, 'disconnected', 'teste');

    const aposQueda = await prisma.whatsAppSession.findFirst({ where: { session: sessionId } });
    expect(aposQueda).not.toBeNull();
    expect(aposQueda?.connected).toBe(false);
    expect(aposQueda?.lastDisconnectedAt).not.toBeNull();

    await new Promise((r) => setTimeout(r, 1100));
    const downtime = await registrarEventoConexao(sessionId, 'connected');

    expect(downtime).not.toBeNull();
    expect(downtime!).toBeGreaterThanOrEqual(1000);

    const aposReconexao = await prisma.whatsAppSession.findFirst({ where: { session: sessionId } });
    expect(aposReconexao?.connected).toBe(true);
    expect(aposReconexao?.lastConnectedAt).not.toBeNull();
  });

  it('Cenário 6 — janela conta recuperadas/duplicadas/erros e finaliza sem exceção', () => {
    iniciarJanelaRecuperacao(sessionId, 10 * 60_000);
    const janela = obterJanela(sessionId);
    expect(janela).toBeDefined();
    expect(janela!.downtimeMs).toBe(10 * 60_000);

    notaRecuperada(sessionId);
    notaRecuperada(sessionId);
    notaDuplicada(sessionId, 'msg-1');
    notaErro(sessionId, 'msg-2', new Error('falha simulada'));

    const atual = obterJanela(sessionId)!;
    expect(atual.recuperadas).toBe(2);
    expect(atual.duplicadas).toBe(1);
    expect(atual.erros).toBe(1);

    finalizarJanelaRecuperacao(sessionId);
    expect(obterJanela(sessionId)).toBeUndefined();

    finalizarJanelaRecuperacao(sessionId);
    expect(obterJanela(sessionId)).toBeUndefined();
  });

  it('queda curta (< 60s) não inicia janela de recuperação', () => {
    iniciarJanelaRecuperacao(sessionId, 30_000);
    expect(obterJanela(sessionId)).toBeUndefined();
  });

  it('nova reconexão durante janela ativa substitui a janela anterior (retry sem vazamento)', () => {
    iniciarJanelaRecuperacao(sessionId, 5 * 60_000);
    const primeira = obterJanela(sessionId)!;
    iniciarJanelaRecuperacao(sessionId, 8 * 60_000);
    const segunda = obterJanela(sessionId)!;
    expect(segunda).not.toBe(primeira);
    expect(segunda.downtimeMs).toBe(8 * 60_000);
    expect(segunda.recuperadas).toBe(0);
    finalizarJanelaRecuperacao(sessionId);
  });

  it('marcarReconectado expõe o instante da reconexão para classificação', () => {
    const antes = Date.now();
    const marcado = marcarReconectado(sessionId);
    expect(marcado).toBeGreaterThanOrEqual(antes);
    expect(marcado).toBeLessThanOrEqual(Date.now());
  });
});
