import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  finalizarAtendimento,
  finalizeTicketAfterEvaluation,
  buscarTicketAtivo,
  buscarCsatPendente,
  buscarConfirmacaoPendente,
  processarRespostaEncerramento,
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
    // Novo fluxo: encerrou → AGUARDA confirmação de resolução (não CSAT direto)
    expect(encerrado?.evaluationStatus).toBe('aguardando_confirmacao');

    // Ticket fechado NUNCA é reaberto por buscarTicketAtivo
    const reativado = await buscarTicketAtivo(PHONE);
    expect(reativado).toBeNull();

    // Confirmação pendente é encontrada para o telefone
    const confirmacao = await buscarConfirmacaoPendente(PHONE);
    expect(confirmacao).not.toBeNull();
    expect(confirmacao.id).toBe(t.id);

    // Cliente responde SIM → avaliação criada (aguardando envio)
    const rSim = await processarRespostaEncerramento(PHONE, confirmacao, '1');
    expect(rSim.ok).toBe(true);
    const aguardando = await prisma.ticket.findUnique({ where: { id: t.id } });
    expect(aguardando?.evaluationStatus).toBe('aguardando');

    // Ambiente de teste não tem provider WhatsApp → simula o envio bem-sucedido
    // da avaliação (enviadoEm preenchido), como ocorre em produção.
    await prisma.cSATResposta.updateMany({
      where: { ticketId: t.id },
      data: { enviadoEm: new Date() },
    });

    const csatPendente = await buscarCsatPendente(PHONE);
    expect(csatPendente).not.toBeNull();
    expect(csatPendente?.csat.respondidoEm).toBeNull();
  });

  it('fluxo NÃO: cliente responde que NÃO foi resolvido → descreve → encerrado sem resolucao + alerta + avaliacao', async () => {
    const supervisor = await prisma.user.create({
      data: {
        name: 'Supervisor Teste',
        email: `supervisor-${Date.now()}@test.com`,
        password: 'x',
        role: 'supervisor',
        active: true,
      },
    });
    try {
      const t = await prisma.ticket.create({
        data: {
          externalId: `closure-nao-${Date.now()}-${Math.random()}`,
          contactName: 'Cliente Sem Resolucao',
          contactPhone: PHONE,
          status: 'fechado',
          etapa: 'concluido',
          dataFechamento: new Date(),
          dataConclusao: new Date(),
          evaluationStatus: 'aguardando_confirmacao',
        },
      });

      const confirmacao = await buscarConfirmacaoPendente(PHONE);
      expect(confirmacao).not.toBeNull();

      // NÃO → pede a descrição
      const rNao = await processarRespostaEncerramento(PHONE, confirmacao, '2');
      expect(rNao.ok).toBe(true);
      expect(rNao.aguardandoDescricao).toBe(true);
      const aguardandoDesc = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(aguardandoDesc?.evaluationStatus).toBe('aguardando_descricao');

      // Cliente descreve o problema → encerrado sem resolução + alerta + avaliação
      const confirmacao2 = await buscarConfirmacaoPendente(PHONE);
      const rDesc = await processarRespostaEncerramento(PHONE, confirmacao2, 'O sistema continua travando ao abrir');
      expect(rDesc.ok).toBe(true);
      expect(rDesc.semResolucao).toBe(true);

      const final = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(final?.motivoStatus).toBe('encerrado_sem_resolucao');
      expect(final?.resumoFinal).toContain('travando');
      expect(final?.evaluationStatus).toBe('aguardando');

      const notif = await prisma.notificacao.findMany({
        where: { ticketId: t.id, tipo: 'encerrado_sem_resolucao' },
      });
      expect(notif.length).toBeGreaterThanOrEqual(1);
      expect(notif.some((n) => n.destinatarioId === supervisor.id)).toBe(true);
    } finally {
      await prisma.user.delete({ where: { id: supervisor.id } }).catch(() => {});
    }
  });

  it('resposta inválida na confirmação não cria novo ticket e re-pergunta', async () => {
    const t = await prisma.ticket.create({
      data: {
        externalId: `closure-invalida-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Invalida',
        contactPhone: PHONE,
        status: 'fechado',
        etapa: 'concluido',
        dataFechamento: new Date(),
        dataConclusao: new Date(),
        evaluationStatus: 'aguardando_confirmacao',
      },
    });

    const confirmacao = await buscarConfirmacaoPendente(PHONE);
    const r = await processarRespostaEncerramento(PHONE, confirmacao, 'qualquer coisa');
    expect(r.ok).toBe(false);
    expect(r.respostaInvalida).toBe(true);

    // Estado mantém aguardando_confirmacao — nenhum CSAT criado
    const ticket = await prisma.ticket.findUnique({ where: { id: t.id } });
    expect(ticket?.evaluationStatus).toBe('aguardando_confirmacao');
    const csat = await prisma.cSATResposta.findUnique({ where: { ticketId: t.id } });
    expect(csat).toBeNull();
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
