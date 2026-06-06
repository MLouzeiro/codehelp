import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  pausarSLA,
  retomarSLA,
  gerenciarPausaSlaPorEtapa,
  etapaPausaSla,
  ETAPAS_PAUSAM_SLA,
  getSlaComPausa,
} from '../modules/helpdesk/slaPausa.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('SLA Pausa (Bloco 10)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('etapaPausaSla', () => {
    it('aguardando_cliente pausa SLA', () => {
      expect(etapaPausaSla('aguardando_cliente')).toBe(true);
    });
    it('aguardando_os pausa SLA', () => {
      expect(etapaPausaSla('aguardando_os')).toBe(true);
    });
    it('pendente pausa SLA (futuro, apos Bloco 11)', () => {
      expect(etapaPausaSla('pendente')).toBe(true);
    });
    it('em_atendimento NAO pausa SLA', () => {
      expect(etapaPausaSla('em_atendimento')).toBe(false);
    });
    it('concluido NAO pausa SLA', () => {
      expect(etapaPausaSla('concluido')).toBe(false);
    });
    it('fila NAO pausa SLA', () => {
      expect(etapaPausaSla('fila')).toBe(false);
    });
  });

  describe('pausarSLA', () => {
    it('marca slaPausadoEm e motivo no ticket', async () => {
      const t = await criarTicketTeste();
      const ok = await pausarSLA(t.id, 'Aguardando cliente');
      expect(ok).toBe(true);
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoEm).toBeInstanceOf(Date);
      expect(updated?.motivoStatus).toBe('Aguardando cliente');
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('idempotente: 2x nao sobrescreve pausa existente', async () => {
      const t = await criarTicketTeste();
      await pausarSLA(t.id, 'Primeira');
      const ok = await pausarSLA(t.id, 'Segunda');
      expect(ok).toBe(false);
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.motivoStatus).toBe('Primeira');
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('atribui slaTotalMinutos se nao existir', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `pausa-no-sla-${Date.now()}-${Math.random()}`,
          contactName: 'Sem SLA',
          contactPhone: '85999990030',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          prioridade: 'alta',
        },
      });
      await pausarSLA(t.id);
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaTotalMinutos).toBe(240);
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('retorna false para ticket inexistente', async () => {
      const ok = await pausarSLA('nao-existe');
      expect(ok).toBe(false);
    });
  });

  describe('retomarSLA', () => {
    it('acumula minutos pausados em slaPausadoTotalMin', async () => {
      const t = await criarTicketTeste();
      const abertura = new Date(Date.now() - 60 * 60 * 1000);
      await prisma.ticket.update({
        where: { id: t.id },
        data: { dataAbertura: abertura, slaPausadoEm: new Date(Date.now() - 30 * 60 * 1000) },
      });
      const ok = await retomarSLA(t.id);
      expect(ok).toBe(true);
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoEm).toBeNull();
      expect(updated?.slaPausadoTotalMin).toBeGreaterThanOrEqual(29);
      expect(updated?.slaPausadoTotalMin).toBeLessThanOrEqual(31);
      expect(updated?.motivoStatus).toBeNull();
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('soma pausa atual + pausas anteriores acumuladas', async () => {
      const t = await criarTicketTeste();
      await prisma.ticket.update({
        where: { id: t.id },
        data: {
          slaPausadoEm: new Date(Date.now() - 20 * 60 * 1000),
          slaPausadoTotalMin: 100,
        },
      });
      await retomarSLA(t.id);
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoTotalMin).toBeGreaterThanOrEqual(119);
      expect(updated?.slaPausadoTotalMin).toBeLessThanOrEqual(121);
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('retorna false se nao esta pausado', async () => {
      const t = await criarTicketTeste();
      const ok = await retomarSLA(t.id);
      expect(ok).toBe(false);
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('gerenciarPausaSlaPorEtapa', () => {
    it('transicao em_atendimento -> aguardando_cliente PAUSA', async () => {
      const t = await criarTicketTeste();
      const r = await gerenciarPausaSlaPorEtapa(t.id, 'aguardando_cliente', 'em_atendimento');
      expect(r).toBe('pausou');
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoEm).toBeInstanceOf(Date);
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('transicao aguardando_cliente -> em_atendimento RETOMA', async () => {
      const t = await criarTicketTeste();
      await prisma.ticket.update({
        where: { id: t.id },
        data: { slaPausadoEm: new Date(Date.now() - 10 * 60 * 1000) },
      });
      const r = await gerenciarPausaSlaPorEtapa(t.id, 'em_atendimento', 'aguardando_cliente');
      expect(r).toBe('retomou');
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoEm).toBeNull();
      expect(updated?.slaPausadoTotalMin).toBeGreaterThanOrEqual(9);
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('transicao em_atendimento -> fila: sem_mudanca', async () => {
      const t = await criarTicketTeste();
      const r = await gerenciarPausaSlaPorEtapa(t.id, 'fila', 'em_atendimento');
      expect(r).toBe('sem_mudanca');
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoEm).toBeNull();
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('transicao aguardando_cliente -> aguardando_os: sem_mudanca (continua pausado)', async () => {
      const t = await criarTicketTeste();
      await prisma.ticket.update({
        where: { id: t.id },
        data: { slaPausadoEm: new Date(Date.now() - 5 * 60 * 1000) },
      });
      const r = await gerenciarPausaSlaPorEtapa(t.id, 'aguardando_os', 'aguardando_cliente');
      expect(r).toBe('sem_mudanca');
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.slaPausadoEm).toBeInstanceOf(Date);
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('getSlaComPausa', () => {
    it('retorna info de SLA considerando pausas', async () => {
      const t = await criarTicketTeste();
      const abertura = new Date(Date.now() - 90 * 60 * 1000);
      await prisma.ticket.update({
        where: { id: t.id },
        data: {
          dataAbertura: abertura,
          slaTotalMinutos: 60,
          slaPausadoEm: new Date(Date.now() - 60 * 60 * 1000),
          slaPausadoTotalMin: 0,
        },
      });
      const info = await getSlaComPausa(t.id);
      expect(info).toBeTruthy();
      expect(info!.pausado).toBe(true);
      expect(info!.restantesMinutos).toBe(30);
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });
});

async function criarTicketTeste() {
  return prisma.ticket.create({
    data: {
      externalId: `pausa-${Date.now()}-${Math.random()}`,
      contactName: 'Cliente Pausa',
      contactPhone: '85999990040',
      status: 'em_atendimento',
      etapa: 'em_atendimento',
      prioridade: 'media',
      slaTotalMinutos: 480,
      dataAbertura: new Date(),
    },
  });
}
