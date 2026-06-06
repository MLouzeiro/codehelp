import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  calcularSlaTotalMinutos,
  calcularSlaRestanteMinutos,
  getSlaStatus,
  getSlaInfoFromTicket,
  processarAlertasSLA,
  atribuirSlaAoTicket,
  SLA_DEFAULT_MINUTOS,
} from '../modules/helpdesk/sla.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('SLA Service (Bloco 3)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('calcularSlaTotalMinutos', () => {
    it('prioridade alta -> usa SLAConfig (240)', async () => {
      const r = await calcularSlaTotalMinutos({ prioridade: 'alta' });
      expect(r.fonte).toBe('prioridade');
      expect(r.minutos).toBe(240);
    });

    it('prioridade urgente -> usa SLAConfig (120)', async () => {
      const r = await calcularSlaTotalMinutos({ prioridade: 'urgente' });
      expect(r.fonte).toBe('prioridade');
      expect(r.minutos).toBe(120);
    });

    it('sem prioridade -> cai para Fila N1 (60)', async () => {
      const filaN1 = await prisma.fila.findUnique({ where: { slug: 'n1' } });
      const r = await calcularSlaTotalMinutos({ idFila: filaN1!.id });
      expect(r.fonte).toBe('fila');
      expect(r.minutos).toBe(60);
    });

    it('sem nada -> default 240', async () => {
      const r = await calcularSlaTotalMinutos({});
      expect(r.fonte).toBe('default');
      expect(r.minutos).toBe(SLA_DEFAULT_MINUTOS);
    });

    it('prioridade sempre vence sobre fila', async () => {
      const filaN3 = await prisma.fila.findUnique({ where: { slug: 'n3' } });
      const r = await calcularSlaTotalMinutos({ prioridade: 'baixa', idFila: filaN3!.id });
      expect(r.fonte).toBe('prioridade');
      expect(r.minutos).toBe(1440);
    });
  });

  describe('calcularSlaRestanteMinutos', () => {
    it('30 min de 60 -> restantes=30, percentual=50', () => {
      const agora = new Date('2026-06-05T12:00:00Z');
      const abertura = new Date('2026-06-05T11:30:00Z');
      const r = calcularSlaRestanteMinutos({
        dataAbertura: abertura,
        slaTotalMinutos: 60,
        slaPausadoEm: null,
        slaPausadoTotalMin: 0,
        agora,
      });
      expect(r.restantes).toBe(30);
      expect(r.percentual).toBe(50);
      expect(r.pausado).toBe(false);
    });

    it('pausado 15 min, total 60 min, 30 min passados -> restantes=45', () => {
      const agora = new Date('2026-06-05T12:00:00Z');
      const abertura = new Date('2026-06-05T11:30:00Z');
      const r = calcularSlaRestanteMinutos({
        dataAbertura: abertura,
        slaTotalMinutos: 60,
        slaPausadoEm: null,
        slaPausadoTotalMin: 15,
        agora,
      });
      expect(r.restantes).toBe(45);
    });

    it('pausado agora 20 min, total acumulado 10 min, 50 min passados -> restantes=40', () => {
      const agora = new Date('2026-06-05T12:00:00Z');
      const abertura = new Date('2026-06-05T11:10:00Z');
      const pausaInicio = new Date('2026-06-05T11:40:00Z');
      const r = calcularSlaRestanteMinutos({
        dataAbertura: abertura,
        slaTotalMinutos: 60,
        slaPausadoEm: pausaInicio,
        slaPausadoTotalMin: 10,
        agora,
      });
      expect(r.restantes).toBe(40);
      expect(r.pausado).toBe(true);
      expect(r.pausaAtualMin).toBe(20);
    });

    it('restantes nunca fica negativo', () => {
      const agora = new Date('2026-06-05T15:00:00Z');
      const abertura = new Date('2026-06-05T11:00:00Z');
      const r = calcularSlaRestanteMinutos({
        dataAbertura: abertura,
        slaTotalMinutos: 60,
        slaPausadoEm: null,
        slaPausadoTotalMin: 0,
        agora,
      });
      expect(r.restantes).toBe(0);
      expect(r.percentual).toBeGreaterThanOrEqual(100);
    });
  });

  describe('getSlaStatus', () => {
    it('abaixo de 75% -> ok', () => {
      expect(getSlaStatus(50, false)).toBe('ok');
    });
    it('75% a 89% -> alerta_75', () => {
      expect(getSlaStatus(75, false)).toBe('alerta_75');
      expect(getSlaStatus(89.9, false)).toBe('alerta_75');
    });
    it('90% a 99% -> alerta_90', () => {
      expect(getSlaStatus(90, false)).toBe('alerta_90');
      expect(getSlaStatus(99, false)).toBe('alerta_90');
    });
    it('100%+ -> violado', () => {
      expect(getSlaStatus(100, false)).toBe('violado');
      expect(getSlaStatus(150, false)).toBe('violado');
    });
    it('ticket finalizado -> sempre concluido', () => {
      expect(getSlaStatus(150, true)).toBe('concluido');
      expect(getSlaStatus(50, true)).toBe('concluido');
    });
  });

  describe('getSlaInfoFromTicket', () => {
    it('retorna info completa de ticket novo', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `sla-info-${Date.now()}-${Math.random()}`,
          contactName: 'Test SLA Info',
          contactPhone: '85999990010',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          prioridade: 'media',
          slaTotalMinutos: 480,
          dataAbertura: new Date(Date.now() - 30 * 60 * 1000),
        },
      });
      const info = getSlaInfoFromTicket(ticket, new Date());
      expect(info.totalMinutos).toBe(480);
      expect(info.restantesMinutos).toBe(450);
      expect(info.percentualConsumido).toBeCloseTo(6.25, 1);
      expect(info.status).toBe('ok');
      expect(info.pausado).toBe(false);
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it('ticket em concluido -> status=concluido', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `sla-done-${Date.now()}-${Math.random()}`,
          contactName: 'Test Done',
          contactPhone: '85999990011',
          status: 'fechado',
          etapa: 'concluido',
          prioridade: 'media',
          slaTotalMinutos: 480,
          dataAbertura: new Date(Date.now() - 600 * 60 * 1000),
        },
      });
      const info = getSlaInfoFromTicket(ticket, new Date());
      expect(info.status).toBe('concluido');
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });

  describe('processarAlertasSLA', () => {
    it('cria notificacao sla_violado para ticket violado', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `sla-viol-${Date.now()}-${Math.random()}`,
          contactName: 'Test Violado',
          contactPhone: '85999990012',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          prioridade: 'urgente',
          slaTotalMinutos: 60,
          assigneeId: admin!.id,
          dataAbertura: new Date(Date.now() - 120 * 60 * 1000),
        },
      });
      const gerados = await processarAlertasSLA();
      const encontrou = gerados.find((g) => g.ticketId === ticket.id);
      expect(encontrou).toBeTruthy();
      expect(encontrou!.status).toBe('violado');
      const notif = await prisma.notificacao.findFirst({
        where: { ticketId: ticket.id, tipo: 'sla_violado' },
      });
      expect(notif).toBeTruthy();
      expect(notif!.destinatarioId).toBe(admin!.id);
      await prisma.notificacao.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it('idempotente: 2x nao duplica notificacao em 6h', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `sla-idem-${Date.now()}-${Math.random()}`,
          contactName: 'Test Idemp',
          contactPhone: '85999990013',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          prioridade: 'urgente',
          slaTotalMinutos: 60,
          assigneeId: admin!.id,
          dataAbertura: new Date(Date.now() - 90 * 60 * 1000),
        },
      });
      await processarAlertasSLA();
      await processarAlertasSLA();
      const count = await prisma.notificacao.count({
        where: { ticketId: ticket.id, tipo: { in: ['sla_75', 'sla_90', 'sla_violado'] } },
      });
      expect(count).toBe(1);
      await prisma.notificacao.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it('nao gera alerta para ticket sem assignee', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `sla-noasg-${Date.now()}-${Math.random()}`,
          contactName: 'Test NoAssignee',
          contactPhone: '85999990014',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          prioridade: 'urgente',
          slaTotalMinutos: 60,
          dataAbertura: new Date(Date.now() - 120 * 60 * 1000),
        },
      });
      const gerados = await processarAlertasSLA();
      const encontrou = gerados.find((g) => g.ticketId === ticket.id);
      expect(encontrou).toBeUndefined();
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });

  describe('atribuirSlaAoTicket', () => {
    it('atribui slaTotalMinutos baseado em prioridade', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          externalId: `sla-attr-${Date.now()}-${Math.random()}`,
          contactName: 'Test Atribuir',
          contactPhone: '85999990015',
          status: 'aberto',
          etapa: 'fila',
          prioridade: 'urgente',
        },
      });
      const minutos = await atribuirSlaAoTicket(ticket.id);
      expect(minutos).toBe(120);
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.slaTotalMinutos).toBe(120);
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });
  });
});
