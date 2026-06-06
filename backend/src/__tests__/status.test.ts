import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  STATUS_VALIDOS,
  ETAPA_PARA_STATUS,
  STATUS_PARA_ETAPA,
  normalizarStatus,
  statusParaEtapa,
  migrarStatusETickets,
  escalarTicket,
  marcarResolvido,
} from '../modules/helpdesk/status.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('Status Service (Bloco 11)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('Constantes', () => {
    it('existem 7 status validos do documento', () => {
      expect(STATUS_VALIDOS.length).toBe(7);
      expect(STATUS_VALIDOS).toContain('aberto');
      expect(STATUS_VALIDOS).toContain('em_atendimento');
      expect(STATUS_VALIDOS).toContain('pendente');
      expect(STATUS_VALIDOS).toContain('escalonado');
      expect(STATUS_VALIDOS).toContain('resolvido');
      expect(STATUS_VALIDOS).toContain('fechado');
      expect(STATUS_VALIDOS).toContain('cancelado');
    });

    it('mapeamento etapa -> status cobre todas etapas atuais', () => {
      expect(ETAPA_PARA_STATUS.fila).toBe('aberto');
      expect(ETAPA_PARA_STATUS.em_atendimento).toBe('em_atendimento');
      expect(ETAPA_PARA_STATUS.aguardando_cliente).toBe('pendente');
      expect(ETAPA_PARA_STATUS.aguardando_os).toBe('pendente');
      expect(ETAPA_PARA_STATUS.concluido).toBe('fechado');
      expect(ETAPA_PARA_STATUS.descartado).toBe('cancelado');
    });

    it('mapeamento reverso status -> etapa', () => {
      expect(STATUS_PARA_ETAPA.aberto).toBe('fila');
      expect(STATUS_PARA_ETAPA.fechado).toBe('concluido');
      expect(STATUS_PARA_ETAPA.cancelado).toBe('descartado');
    });
  });

  describe('normalizarStatus', () => {
    it('aceita status valido', () => {
      expect(normalizarStatus('aberto')).toBe('aberto');
      expect(normalizarStatus('escalonado')).toBe('escalonado');
    });
    it('mapeia etapa legada para status', () => {
      expect(normalizarStatus('fila')).toBe('aberto');
      expect(normalizarStatus('concluido')).toBe('fechado');
    });
    it('retorna null para entrada invalida', () => {
      expect(normalizarStatus('pirata')).toBeNull();
      expect(normalizarStatus(null)).toBeNull();
      expect(normalizarStatus(undefined)).toBeNull();
    });
    it('case-insensitive', () => {
      expect(normalizarStatus('ESCALONADO')).toBe('escalonado');
    });
  });

  describe('migrarStatusETickets', () => {
    it('idempotente: rodar 2x mantem dados', async () => {
      const r1 = await migrarStatusETickets();
      const r2 = await migrarStatusETickets();
      expect(r2.atualizados).toBe(0);
    });

    it('sincroniza status de ticket novo criado com etapa legada', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `mig-${Date.now()}-${Math.random()}`,
          contactName: 'Mig',
          contactPhone: '85999990050',
          status: 'aberto',
          etapa: 'concluido',
        },
      });
      await migrarStatusETickets();
      const updated = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(updated?.status).toBe('fechado');
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('escalarTicket', () => {
    it('move ticket para status=escalonado e atualiza idFila', async () => {
      const filaN1 = await prisma.fila.findUnique({ where: { slug: 'n1' } });
      const filaN2 = await prisma.fila.findUnique({ where: { slug: 'n2' } });
      const t = await prisma.ticket.create({
        data: {
          externalId: `esc-${Date.now()}-${Math.random()}`,
          contactName: 'Escalado',
          contactPhone: '85999990051',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
          idFila: filaN1!.id,
          slaTotalMinutos: 60,
        },
      });
      const result = await escalarTicket(t.id, filaN2!.id, 'Necessario conhecimento tecnico');
      expect(result.ticket.status).toBe('escalonado');
      expect(result.ticket.idFila).toBe(filaN2!.id);
      expect(result.ticket.slaTotalMinutos).toBe(filaN2!.slaMinutos);
      expect(result.ticket.motivoStatus).toBe('Necessario conhecimento tecnico');
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticketStageEvent.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('rejeita escalonar para N1', async () => {
      const filaN1 = await prisma.fila.findUnique({ where: { slug: 'n1' } });
      const t = await prisma.ticket.create({
        data: {
          externalId: `esc-n1-${Date.now()}-${Math.random()}`,
          contactName: 'N1 Rejeitado',
          contactPhone: '85999990052',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
        },
      });
      await expect(escalarTicket(t.id, filaN1!.id, 'teste')).rejects.toThrow('N1');
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('rejeita fila inexistente', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `esc-fake-${Date.now()}-${Math.random()}`,
          contactName: 'Fila Inexistente',
          contactPhone: '85999990053',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
        },
      });
      await expect(escalarTicket(t.id, 'fila-fake', 'teste')).rejects.toThrow('Fila nao encontrada');
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('marcarResolvido', () => {
    it('move para status=resolvido, seta dataResolucao e resumoFinal', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `res-${Date.now()}-${Math.random()}`,
          contactName: 'Resolvido',
          contactPhone: '85999990054',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
        },
      });
      const updated = await marcarResolvido(t.id, 'Problema resolvido com orientacao por telefone');
      expect(updated.status).toBe('resolvido');
      expect(updated.dataResolucao).toBeInstanceOf(Date);
      expect(updated.resumoFinal).toBe('Problema resolvido com orientacao por telefone');
      await prisma.auditLog.deleteMany({ where: { entidadeId: t.id } });
      await prisma.ticketStageEvent.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });
});
