import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import {
  gerarRelatorioAnalista,
  getReplayConversa,
} from '../modules/helpdesk/agentReport.service';

let agenteId: string;
let ticketsIds: string[] = [];

beforeAll(async () => {
  await ensureHelpdeskEntities();
  const agente = await prisma.user.upsert({
    where: { email: 'auditor-fase8@teste.com' },
    create: {
      email: 'auditor-fase8@teste.com',
      name: 'Analista Fase 8',
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'tecnico',
      active: true,
    },
    update: {},
  });
  agenteId = agente.id;
});

afterEach(async () => {
  if (ticketsIds.length > 0) {
    await prisma.message.deleteMany({ where: { ticketId: { in: ticketsIds } } });
    await prisma.aIAgentAudit.deleteMany({ where: { ticketId: { in: ticketsIds } } }).catch(() => {});
    await prisma.cSATResposta.deleteMany({ where: { ticketId: { in: ticketsIds } } }).catch(() => {});
    await prisma.ticket.deleteMany({ where: { id: { in: ticketsIds } } });
    ticketsIds = [];
  }
});

describe('Auditoria individual por analista (FASE 8)', () => {
  it('gera relatório do analista com métricas e tickets', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `fa8a-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Fase 8',
        contactPhone: '85999998810',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataAbertura: new Date(Date.now() - 3600000),
        dataPrimeiraResposta: new Date(Date.now() - 3300000),
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Olá, vou ajudar com isso.', sentAt: new Date(Date.now() - 3300000) },
    });

    const relatorio = await gerarRelatorioAnalista(agenteId);

    expect(relatorio).not.toBeNull();
    expect(relatorio!.agenteNome).toBe('Analista Fase 8');
    expect(relatorio!.resumo.totalTickets).toBeGreaterThanOrEqual(1);
    expect(relatorio!.resumo.taxaResolucao).toBeGreaterThanOrEqual(0);
    expect(relatorio!.tickets.some(t => t.ticketId === ticket.id)).toBe(true);
    const t = relatorio!.tickets.find(x => x.ticketId === ticket.id);
    expect(t!.primeiraRespostaMin).toBe(5);
  });

  it('relatório filtra por período', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `fa8b-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Fase 8 B',
        contactPhone: '85999998811',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataAbertura: new Date('2020-01-01T00:00:00Z'),
      },
    });
    ticketsIds.push(ticket.id);

    const relatorio = await gerarRelatorioAnalista(agenteId, '2021-01-01', '2021-12-31');

    expect(relatorio!.tickets.some(t => t.ticketId === ticket.id)).toBe(false);
  });

  it('replay de conversa retorna mensagens com auditoria', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `fa8c-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Replay',
        contactPhone: '85999998812',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);

    const msg1 = await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: false, content: 'Preciso de ajuda com o sistema.', sentAt: new Date(Date.now() - 7200000) },
    });
    const msg2 = await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Olá! Pode me detalhar o problema?', sentAt: new Date(Date.now() - 7000000) },
    });

    await prisma.aIAgentAudit.create({
      data: {
        ticketId: ticket.id,
        agentId: agenteId,
        mensagemId: msg2.id,
        conteudoMensagem: 'Olá! Pode me detalhar o problema?',
        notProfissionalismo: 8,
        notCordialidade: 9,
        notClareza: 8,
        notEmpatia: 7,
        notaGeral: 8,
        classificacao: 'bom',
        alertas: '[]',
        pontosFortes: '["Saudação presente"]',
        pontosMelhoria: '[]',
      },
    });

    const replay = await getReplayConversa(ticket.id);

    expect(replay).not.toBeNull();
    expect(replay!.mensagens.length).toBe(2);
    expect(replay!.mensagens[0].fromMe).toBe(false);
    expect(replay!.mensagens[1].fromMe).toBe(true);
    expect(replay!.mensagens[1].auditoria).not.toBeNull();
    expect(replay!.mensagens[1].auditoria!.notaGeral).toBe(8);
    expect(replay!.resumoAuditoria.mensagensAuditadas).toBe(1);
    expect(replay!.resumoAuditoria.classificacao).toBe('excelente');
  });

  it('replay retorna null para ticket inexistente', async () => {
    const replay = await getReplayConversa('id-inexistente-fase8');
    expect(replay).toBeNull();
  });

  it('relatório calcula CSAT e FCR', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `fa8d-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente CSAT',
        contactPhone: '85999998813',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        assigneeId: agenteId,
        dataAbertura: new Date(Date.now() - 7200000),
        dataPrimeiraResposta: new Date(Date.now() - 7000000),
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Resolvido, obrigado!', sentAt: new Date(Date.now() - 7000000) },
    });
    await prisma.cSATResposta.create({
      data: {
        ticketId: ticket.id,
        nota: 5,
        respondidoEm: new Date(),
      },
    });

    const relatorio = await gerarRelatorioAnalista(agenteId);

    expect(relatorio!.resumo.csatRespondidos).toBeGreaterThanOrEqual(1);
    expect(relatorio!.resumo.csatMedia).toBe(5);
    expect(relatorio!.resumo.fcr).toBeGreaterThanOrEqual(0);
    expect(relatorio!.resumo.tempoMedioRespostaMin).toBe(3);
  });
});