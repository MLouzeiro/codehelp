import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  ensureAmbienteHelpdesk,
  limparTicketsPorTelefone,
  criarDepartamentoTeste,
  criarMensagemBotMenuEnviado,
  makeSendMessageMock,
} from './helpers/test-utils';
import { processIncomingMessageHandler } from '../modules/integrations/whatsapp/whatsapp-message-handler';
import { buscarTicketAtivo, buscarCsatPendente, finalizarAtendimento } from '../modules/helpdesk/flow.service';
import { encerrarTicket } from '../modules/helpdesk/flow.service';

// ⚠️ CRITICAL BUSINESS RULE — E2E do ciclo de vida completo do ticket.
// Cobre o caminho mais longo e crítico do sistema via handler canônico:
//
//   nova mensagem → NOVO ticket → menu departamento (dept_<slug>)
//   → fila → analista conclui (encerrarTicket) → CSAT agendado
//   → cliente avalia (rating_N) → ticket fechado definitivamente
//   → nova mensagem → NOVO ticket (nunca reabre o anterior).
//
// O provider não está conectado; o envio real do menu/CSAT falha de forma
// controlada (fallback explícito) e é simulado via enviadoEm para permitir
// a resposta da avaliação (como ocorre em produção).

const PHONE = '85999990091';
const DEPT_SLUG = 'n1';

beforeAll(async () => {
  await ensureAmbienteHelpdesk();
  await criarDepartamentoTeste(DEPT_SLUG, 'N1 - Suporte Inicial');
});

afterEach(async () => {
  await limparTicketsPorTelefone(PHONE);
});

describe('E2E — ciclo de vida completo (handler + serviços)', () => {
  it('mensagem → ticket → departamento → fila → encerramento → CSAT → avaliação → novo ticket', async () => {
    const { fn } = makeSendMessageMock();

    // ── 1) Cliente envia primeira mensagem ───────────────────────────
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'Boa tarde, preciso de suporte com o sistema',
        contactName: 'Cliente E2E',
        provider: 'baileys',
        messageId: `e2e-1-${Date.now()}`,
      },
      fn,
    );

    const ticket1 = await buscarTicketAtivo(PHONE);
    expect(ticket1).not.toBeNull();
    expect(ticket1?.status).toBe('aberto');

    // O provider não está conectado em teste: simula o menu interativo
    // já enviado (como ocorre em produção quando o Baileys está ativo).
    await criarMensagemBotMenuEnviado(ticket1!.id);

    // ── 2) Cliente clica no departamento ─────────────────────────────
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: `dept_${DEPT_SLUG}`,
        interactiveId: `dept_${DEPT_SLUG}`,
        contactName: 'Cliente E2E',
        provider: 'baileys',
        messageId: `e2e-2-${Date.now()}`,
      },
      fn,
    );

    const comDept = await prisma.ticket.findUnique({ where: { id: ticket1!.id } });
    expect(comDept?.departamentoId).not.toBeNull();
    expect(comDept?.etapa).toBe('fila');

    // ── 3) Analista conclui o atendimento (encerramento canônico) ────
    const resultado = await encerrarTicket(ticket1!.id, {
      status: 'fechado',
      etapa: 'concluido',
      origem: 'manual',
      dataFechamento: true,
      dataConclusao: true,
      finalizarCsat: true,
    });
    expect(resultado.ok).toBe(true);

    const encerrado = await prisma.ticket.findUnique({ where: { id: ticket1!.id } });
    expect(encerrado?.status).toBe('fechado');
    expect(encerrado?.etapa).toBe('concluido');
    expect(encerrado?.evaluationStatus).toBe('aguardando');

    // Ticket encerrado NÃO é reaberto por buscarTicketAtivo
    expect(await buscarTicketAtivo(PHONE)).toBeNull();

    // ── 4) CSAT agendado/enviado (simula provider conectado) ─────────
    const csat = await prisma.cSATResposta.findUnique({ where: { ticketId: ticket1!.id } });
    expect(csat).not.toBeNull();
    await prisma.cSATResposta.update({
      where: { id: csat!.id },
      data: { enviadoEm: new Date() },
    });

    const pendente = await buscarCsatPendente(PHONE);
    expect(pendente).not.toBeNull();
    expect(pendente?.csat.id).toBe(csat!.id);

    // ── 5) Cliente responde a avaliação (rating_N) ───────────────────
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'rating_5',
        interactiveId: 'rating_5',
        contactName: 'Cliente E2E',
        provider: 'baileys',
        messageId: `e2e-3-${Date.now()}`,
      },
      fn,
    );

    const avaliado = await prisma.cSATResposta.findUnique({ where: { id: csat!.id } });
    expect(avaliado?.respondidoEm).toBeInstanceOf(Date);
    expect(avaliado?.nota).toBe(5);

    const ticketAvaliado = await prisma.ticket.findUnique({ where: { id: ticket1!.id } });
    expect(ticketAvaliado?.evaluationStatus).toBe('respondido');
    expect(ticketAvaliado?.satisfacao).toBe(5);
    expect(ticketAvaliado?.etapa).toBe('concluido');
    expect(ticketAvaliado?.status).toBe('fechado');

    // ── 6) Nova mensagem → NOVO ticket (não reabre o anterior) ───────
    await processIncomingMessageHandler(
      {
        phone: PHONE,
        text: 'Ola de novo, tenho outra duvida',
        contactName: 'Cliente E2E',
        provider: 'baileys',
        messageId: `e2e-4-${Date.now()}`,
      },
      fn,
    );

    const ticket2 = await buscarTicketAtivo(PHONE);
    expect(ticket2).not.toBeNull();
    expect(ticket2?.id).not.toBe(ticket1!.id);
    expect(ticket2?.status).toBe('aberto');

    const total = await prisma.ticket.count({ where: { contactPhone: PHONE } });
    expect(total).toBe(2);
  });

  it('finalizarAtendimento é idempotente: não reenvia CSAT já enviado', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `e2e-idem-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente E2E 2',
        contactPhone: PHONE,
        status: 'fechado',
        etapa: 'concluido',
        dataFechamento: new Date(),
        dataConclusao: new Date(),
        evaluationStatus: 'aguardando',
      },
    });
    const csat = await prisma.cSATResposta.create({
      data: { ticketId: t.id, tokenResposta: crypto.randomUUID(), enviadoEm: new Date() },
    });

    const r1 = await finalizarAtendimento(t.id);
    expect(r1).toBe(true);

    const csats = await prisma.cSATResposta.count({ where: { ticketId: t.id } });
    expect(csats).toBe(1);
    expect(csat.id).toBe((await prisma.cSATResposta.findFirst({ where: { ticketId: t.id } }))?.id);
  });
});
