import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import {
  auditarEncerramento,
  resumoAuditoriaEncerramentos,
  listarTicketsEncerrados,
} from '../modules/helpdesk/closureAudit.service';

let ticketsIds: string[] = [];

beforeAll(async () => {
  await ensureHelpdeskEntities();
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

describe('Auditoria de Encerramento (FASE 7)', () => {
  it('detecta encerramento prematuro sem confirmação do cliente', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `aud-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Audit',
        contactPhone: '85999998800',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Vou verificar o problema e te retorno.', sentAt: new Date(Date.now() - 3600000) },
    });

    const auditoria = await auditarEncerramento(ticket.id, false);

    expect(auditoria.tipo).toBe('encerramento_prematuro');
    expect(auditoria.recomendaReabertura).toBe(true);
    expect(auditoria.nota).toBeLessThanOrEqual(5);
  });

  it('detecta resolução real quando cliente confirma', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `aud2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Audit 2',
        contactPhone: '85999998801',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Tentamos o procedimento, me confirma se resolveu?', sentAt: new Date(Date.now() - 7200000) },
    });
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: false, content: 'Funcionou, obrigado! Pode fechar.', sentAt: new Date(Date.now() - 3600000) },
    });

    const auditoria = await auditarEncerramento(ticket.id, false);

    expect(auditoria.tipo).toBe('resolucao_real');
    expect(auditoria.recomendaReabertura).toBe(false);
    expect(auditoria.nota).toBeGreaterThanOrEqual(8);
  });

  it('detecta reabertura quando cliente abre novo ticket após encerramento', async () => {
    const primeiro = await prisma.ticket.create({
      data: {
        externalId: `aud3a-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Audit 3',
        contactPhone: '85999998802',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        dataFechamento: new Date(Date.now() - 60000),
      },
    });
    await prisma.message.create({
      data: { ticketId: primeiro.id, fromMe: true, content: 'Concluímos o atendimento.', sentAt: new Date(Date.now() - 120000) },
    });

    const reabertura = await prisma.ticket.create({
      data: {
        externalId: `aud3b-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Audit 3',
        contactPhone: '85999998802',
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp_baileys',
        createdAt: new Date(),
      },
    });
    await prisma.message.create({
      data: { ticketId: reabertura.id, fromMe: false, content: 'O problema voltou, preciso de ajuda!', sentAt: new Date() },
    });
    ticketsIds.push(primeiro.id, reabertura.id);

    const auditoria = await auditarEncerramento(primeiro.id, false);

    expect(auditoria.tipo).toBe('reabertura');
    expect(auditoria.clienteVoltou).toBe(true);
    expect(auditoria.mensagensAposEncerramento).toBeGreaterThan(0);
    expect(auditoria.ticketReaberturaId).toBe(reabertura.id);
  });

  it('gera resumo agregado com taxas', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `aud4-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Audit 4',
        contactPhone: '85999998803',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);
    await prisma.message.create({
      data: { ticketId: ticket.id, fromMe: true, content: 'Atendimento concluído.', sentAt: new Date() },
    });

    const resumo = await resumoAuditoriaEncerramentos({ limit: 100 });

    expect(resumo.totalAuditados).toBeGreaterThanOrEqual(1);
    expect(typeof resumo.taxaPrematura).toBe('number');
    expect(typeof resumo.pctReabertura).toBe('number');
    expect(resumo.prematuros + resumo.resolucoesReais + resumo.reaberturas).toBeLessThanOrEqual(resumo.totalAuditados);
  });

  it('lista tickets encerrados com filtro', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `aud5-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Audit 5',
        contactPhone: '85999998804',
        status: 'fechado',
        etapa: 'concluido',
        canal: 'whatsapp_baileys',
        dataFechamento: new Date(),
      },
    });
    ticketsIds.push(ticket.id);

    const lista = await listarTicketsEncerrados({ limit: 50 });
    expect(Array.isArray(lista)).toBe(true);
    expect(lista.some(t => t.id === ticket.id)).toBe(true);
  });
});