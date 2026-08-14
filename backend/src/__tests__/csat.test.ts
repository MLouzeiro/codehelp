import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import {
  agendarCsat,
  montarMensagemCsat,
  responderCsat,
  processarAgendamentosCsat,
  getEstatisticasCsat,
} from '../modules/csat/csat.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('CSAT Service (Bloco 7)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('montarMensagemCsat', () => {
    it('inclui 5 opcoes de estrelas (1-5)', () => {
      const msg = montarMensagemCsat('token-123', 'https://app.example.com');
      expect(msg).toContain('1 - Péssimo');
      expect(msg).toContain('2 - Ruim');
      expect(msg).toContain('3 - Regular');
      expect(msg).toContain('4 - Bom');
      expect(msg).toContain('5 - Excelente');
    });
    it('inclui URL com token', () => {
      const msg = montarMensagemCsat('abc-def-123', 'https://app.example.com');
      expect(msg).toContain('https://app.example.com/csat/abc-def-123');
    });
  });

  describe('agendarCsat', () => {
    it('cria CSAT para ticket fechado', async () => {
      const t = await criarTicketFechado();
      const r = await agendarCsat(t.id);
      expect(r.criado).toBe(true);
      expect(r.csat).toBeTruthy();
      expect(r.csat.tokenResposta).toBeTruthy();
      expect(r.csat.ticketId).toBe(t.id);
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('cria CSAT para ticket concluido (etapa)', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `csat-conc-${Date.now()}-${Math.random()}`,
          contactName: 'Concluido CSAT',
          contactPhone: '85999990060',
          status: 'fechado',
          etapa: 'concluido',
          dataFechamento: new Date(),
        },
      });
      const r = await agendarCsat(t.id);
      expect(r.criado).toBe(true);
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('retorna existente se CSAT ja existe', async () => {
      const t = await criarTicketFechado();
      await agendarCsat(t.id);
      const r2 = await agendarCsat(t.id);
      expect(r2.criado).toBe(false);
      expect(r2.csat).toBeTruthy();
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('NAO agenda ticket em andamento', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `csat-nao-${Date.now()}-${Math.random()}`,
          contactName: 'Em Aberto',
          contactPhone: '85999990061',
          status: 'em_atendimento',
          etapa: 'em_atendimento',
        },
      });
      const r = await agendarCsat(t.id);
      expect(r.criado).toBe(false);
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('responderCsat', () => {
    it('registra nota e comentario', async () => {
      const t = await criarTicketFechado();
      const { csat } = await agendarCsat(t.id);
      const r = await responderCsat(csat.tokenResposta, { nota: 5, comentario: 'Otimo atendimento' });
      expect(r.nota).toBe(5);
      expect(r.comentario).toBe('Otimo atendimento');
      expect(r.respondidoEm).toBeInstanceOf(Date);
      const ticket = await prisma.ticket.findUnique({ where: { id: t.id } });
      expect(ticket?.satisfacao).toBe(5);
      expect(ticket?.dataCSAT).toBeInstanceOf(Date);
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('rejeita nota fora do range (0 ou 6)', async () => {
      const t = await criarTicketFechado();
      const { csat } = await agendarCsat(t.id);
      await expect(responderCsat(csat.tokenResposta, { nota: 0 })).rejects.toThrow('1 e 5');
      await expect(responderCsat(csat.tokenResposta, { nota: 6 })).rejects.toThrow('1 e 5');
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('rejeita token invalido', async () => {
      await expect(responderCsat('token-fake', { nota: 3 })).rejects.toThrow('invalido');
    });

    it('rejeita resposta duplicada', async () => {
      const t = await criarTicketFechado();
      const { csat } = await agendarCsat(t.id);
      await responderCsat(csat.tokenResposta, { nota: 4 });
      await expect(responderCsat(csat.tokenResposta, { nota: 5 })).rejects.toThrow('ja respondido');
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('CSAT negativo (nota 2) gera notificacao para atendente+supervisores', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const t = await prisma.ticket.create({
        data: {
          externalId: `csat-neg-${Date.now()}-${Math.random()}`,
          contactName: 'Insatisfeito',
          contactPhone: '85999990062',
          status: 'fechado',
          etapa: 'concluido',
          dataFechamento: new Date(),
          assigneeId: admin!.id,
        },
      });
      const { csat } = await agendarCsat(t.id);
      await responderCsat(csat.tokenResposta, { nota: 2, comentario: 'Demora' });
      const notifs = await prisma.notificacao.findMany({
        where: { ticketId: t.id, tipo: 'csat_negativo' },
      });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
      const assigneeNotif = notifs.find((n) => n.destinatarioId === admin!.id);
      expect(assigneeNotif).toBeTruthy();
      expect(assigneeNotif!.mensagem).toContain('2 estrelas');
      await prisma.notificacao.deleteMany({ where: { ticketId: t.id } });
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('CSAT positivo (nota 4) NAO gera notificacao negativa', async () => {
      const t = await criarTicketFechado();
      const { csat } = await agendarCsat(t.id);
      await responderCsat(csat.tokenResposta, { nota: 4 });
      const notifs = await prisma.notificacao.findMany({
        where: { ticketId: t.id, tipo: 'csat_negativo' },
      });
      expect(notifs.length).toBe(0);
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('processarAgendamentosCsat', () => {
    it('agenda CSAT para tickets fechados ha mais de 30min', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `csat-30-${Date.now()}-${Math.random()}`,
          contactName: 'Fechado Antigo',
          contactPhone: '85999990063',
          status: 'fechado',
          etapa: 'concluido',
          dataFechamento: new Date(Date.now() - 60 * 60 * 1000),
        },
      });
      const r = await processarAgendamentosCsat();
      expect(r.agendados).toBeGreaterThanOrEqual(1);
      const csat = await prisma.cSATResposta.findUnique({ where: { ticketId: t.id } });
      expect(csat).toBeTruthy();
      await prisma.cSATResposta.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticket.delete({ where: { id: t.id } });
    });

    it('NAO agenda ticket fechado ha menos de 30min', async () => {
      const t = await prisma.ticket.create({
        data: {
          externalId: `csat-recente-${Date.now()}-${Math.random()}`,
          contactName: 'Fechado Recente',
          contactPhone: '85999990064',
          status: 'fechado',
          etapa: 'concluido',
          dataFechamento: new Date(Date.now() - 5 * 60 * 1000),
        },
      });
      await processarAgendamentosCsat();
      const csat = await prisma.cSATResposta.findUnique({ where: { ticketId: t.id } });
      expect(csat).toBeNull();
      await prisma.ticket.delete({ where: { id: t.id } });
    });
  });

  describe('getEstatisticasCsat', () => {
    it('calcula media, distribuicao e percentual de resposta', async () => {
      const stats = await getEstatisticasCsat();
      expect(typeof stats.mediaNotas).toBe('number');
      expect(typeof stats.totalEnviados).toBe('number');
      expect(typeof stats.totalRespondidos).toBe('number');
      expect(typeof stats.percentualResposta).toBe('number');
      expect(stats.distribuicao).toHaveProperty('1');
      expect(stats.distribuicao).toHaveProperty('5');
    });
  });
});

async function criarTicketFechado() {
  return prisma.ticket.create({
    data: {
      externalId: `csat-${Date.now()}-${Math.random()}`,
      contactName: 'Cliente CSAT',
      contactPhone: '85999990070',
      status: 'fechado',
      etapa: 'concluido',
      dataFechamento: new Date(),
    },
  });
}
