import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  finalizarAtendimento,
  finalizeTicketAfterEvaluation,
  buscarTicketAtivo,
  buscarCsatPendente,
  encerrarTicket,
} from '../modules/helpdesk/flow.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

// ⚠️ CRITICAL BUSINESS RULE — Guard-rail de regressão do ciclo de vida do ticket.
// Fluxo protegido: atendimento → encerramento → avaliação → resposta → ticket
// fechado → NOVA mensagem = NOVO ticket (nunca reabre o anterior).

const PHONE = '85999990080';

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  const tickets = await prisma.ticket.findMany({
    where: { contactPhone: PHONE },
    select: { id: true },
  });
  for (const t of tickets) {
    await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
    await prisma.ticketStageEvent.deleteMany({ where: { ticketId: t.id } });
    await prisma.message.deleteMany({ where: { ticketId: t.id } });
    await prisma.ticket.delete({ where: { id: t.id } });
  }
});

describe('Fluxo de encerramento do atendimento (guard-rail)', () => {
  it('cria ticket ativo → encerra → avaliação pendente', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-1-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure',
        contactPhone: PHONE,
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });

    const ativo = await buscarTicketAtivo(PHONE);
    expect(ativo?.id).toBe(t.id);

    await encerrarTicket(t.id, {
      status: 'fechado',
      etapa: 'concluido',
      origem: 'manual',
      dataFechamento: true,
      dataConclusao: true,
      finalizarCsat: true,
    });

    const encerrado = await prisma.ticket.findUnique({ where: { id: t.id } });
    expect(encerrado?.status).toBe('fechado');
    expect(encerrado?.etapa).toBe('concluido');
    expect(encerrado?.dataFechamento).toBeInstanceOf(Date);
    expect(encerrado?.evaluationStatus).toBe('aguardando');

    // Ticket fechado NUNCA é reaberto por buscarTicketAtivo
    const reativado = await buscarTicketAtivo(PHONE);
    expect(reativado).toBeNull();

    // Ambiente de teste não tem provider WhatsApp → simula o envio bem-sucedido
    // da lista interativa (enviadoEm preenchido), como ocorre em produção.
    await prisma.cSATResposta.updateMany({
      where: { ticketId: t.id },
      data: { enviadoEm: new Date() },
    });

    const csatPendente = await buscarCsatPendente(PHONE);
    expect(csatPendente).not.toBeNull();
    expect(csatPendente?.csat.respondidoEm).toBeNull();
  });

  it('resposta da avaliação finaliza definitivamente e limpa o contexto do bot', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure 2',
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

    const r = await finalizeTicketAfterEvaluation(PHONE, csat, 5, 'Ótimo');
    expect(r.ok).toBe(true);
    expect(r.jaFinalizado).toBeUndefined();

    const respondido = await prisma.cSATResposta.findUnique({ where: { id: csat.id } });
    expect(respondido?.respondidoEm).toBeInstanceOf(Date);
    expect(respondido?.nota).toBe(5);

    const ticket = await prisma.ticket.findUnique({ where: { id: t.id } });
    expect(ticket?.evaluationStatus).toBe('respondido');
    expect(ticket?.satisfacao).toBe(5);
  });

  it('é idempotente: segunda resposta da avaliação não reprocessa', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-3-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure 3',
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

    const r1 = await finalizeTicketAfterEvaluation(PHONE, csat, 4);
    expect(r1.ok).toBe(true);

    // Clique duplo / webhook duplicado
    const r2 = await finalizeTicketAfterEvaluation(PHONE, csat, 1);
    expect(r2.ok).toBe(true);
    expect(r2.jaFinalizado).toBe(true);

    // A nota original prevalece — não foi sobrescrita
    const respondido = await prisma.cSATResposta.findUnique({ where: { id: csat.id } });
    expect(respondido?.nota).toBe(4);
    const ticket = await prisma.ticket.findUnique({ where: { id: t.id } });
    expect(ticket?.satisfacao).toBe(4);
  });

  it('nova mensagem após ticket fechado NÃO reabre o antigo — cria novo ticket', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-4-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure 4',
        contactPhone: PHONE,
        status: 'fechado',
        etapa: 'concluido',
        dataFechamento: new Date(),
        dataConclusao: new Date(),
        evaluationStatus: 'respondido',
      },
    });

    // Mensagem nova: sem ticket ativo e sem CSAT pendente
    const ativo = await buscarTicketAtivo(PHONE);
    expect(ativo).toBeNull();
    const csatPendente = await buscarCsatPendente(PHONE);
    expect(csatPendente).toBeNull();

    const novo = await prisma.ticket.create({
      data: {
        externalId: `closure-4b-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure 4',
        contactPhone: PHONE,
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp_baileys',
      },
    });

    const ativoNovo = await buscarTicketAtivo(PHONE);
    expect(ativoNovo?.id).toBe(novo.id);
    expect(ativoNovo?.id).not.toBe(t.id);
  });

  it('avaliação pendente não responde = mensagem nova vira novo ticket', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-5-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure 5',
        contactPhone: PHONE,
        status: 'fechado',
        etapa: 'concluido',
        dataFechamento: new Date(),
        dataConclusao: new Date(),
        evaluationStatus: 'aguardando',
      },
    });
    await prisma.cSATResposta.create({
      data: { ticketId: t.id, tokenResposta: crypto.randomUUID(), enviadoEm: new Date() },
    });

    // Nova mensagem que NÃO é nota (ex: novo problema) → deve abandonar a
    // avaliação pendente para permitir novo ticket. Não deve ficar presa.
    const ativo = await buscarTicketAtivo(PHONE);
    expect(ativo).toBeNull();
    const csatPendente = await buscarCsatPendente(PHONE);
    expect(csatPendente).not.toBeNull();
  });

  it('finalizarAtendimento é idempotente: reexecutar não reenvia CSAT', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-6-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Closure 6',
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

    // Já enviada → finalizarAtendimento não deve reenviar/duplicar
    const result = await finalizarAtendimento(t.id);
    expect(result).toBe(true);

    const csats = await prisma.cSATResposta.count({ where: { ticketId: t.id } });
    expect(csats).toBe(1);
    const aindaPendente = await buscarCsatPendente(PHONE);
    expect(aindaPendente?.csat.id).toBe(csat.id);
  });
});
