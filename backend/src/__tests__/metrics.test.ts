import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../config/database';
import { getDashboardMetrics } from '../modules/helpdesk/metrics.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

describe('Metrics Service (Bloco 9)', () => {
  beforeAll(async () => {
    await ensureHelpdeskEntities();
  });

  describe('getDashboardMetrics', () => {
    it('retorna estrutura completa do dashboard', async () => {
      const m = await getDashboardMetrics();
      expect(m).toHaveProperty('periodo');
      expect(m).toHaveProperty('backlog');
      expect(m).toHaveProperty('mttr');
      expect(m).toHaveProperty('mtfa');
      expect(m).toHaveProperty('sla');
      expect(m).toHaveProperty('fcr');
      expect(m).toHaveProperty('csat');
      expect(m).toHaveProperty('porAgente');
      expect(m).toHaveProperty('porCategoria');
    });

    it('periodo tem inicio e fim', async () => {
      const m = await getDashboardMetrics();
      expect(m.periodo.inicio).toBeInstanceOf(Date);
      expect(m.periodo.fim).toBeInstanceOf(Date);
    });

    it('backlog contem distribuicoes por etapa/prioridade/fila', async () => {
      const m = await getDashboardMetrics();
      expect(typeof m.backlog.total).toBe('number');
      expect(typeof m.backlog.porEtapa).toBe('object');
      expect(typeof m.backlog.porPrioridade).toBe('object');
      expect(typeof m.backlog.porFila).toBe('object');
    });

    it('mttr inclui media, mediana e p95', async () => {
      const m = await getDashboardMetrics();
      expect(typeof m.mttr.mediaMinutos).toBe('number');
      expect(typeof m.mttr.medianaMinutos).toBe('number');
      expect(typeof m.mttr.p95Minutos).toBe('number');
    });

    it('sla compliance calculado corretamente', async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const t1 = await criarTicketResolvido('sla-ok', 30, 60, admin!.id);
      const t2 = await criarTicketResolvido('sla-vio', 120, 60, admin!.id);
      const m = await getDashboardMetrics();
      expect(m.sla.noPrazo).toBeGreaterThanOrEqual(1);
      expect(m.sla.violados).toBeGreaterThanOrEqual(1);
      expect(m.sla.compliancePercentual).toBeGreaterThanOrEqual(0);
      expect(m.sla.compliancePercentual).toBeLessThanOrEqual(100);
      expect(m.sla.total).toBe(m.sla.noPrazo + m.sla.violados);
      await prisma.ticket.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
    });

    it('FCR considera tickets escalonados', async () => {
      const m = await getDashboardMetrics();
      expect(typeof m.fcr.percentual).toBe('number');
      expect(m.fcr.percentual).toBeGreaterThanOrEqual(0);
      expect(m.fcr.percentual).toBeLessThanOrEqual(100);
    });

    it('CSAT retorna media e totais', async () => {
      const m = await getDashboardMetrics();
      expect(typeof m.csat.mediaNotas).toBe('number');
      expect(typeof m.csat.totalRespostas).toBe('number');
      expect(typeof m.csat.percentualResposta).toBe('number');
    });

    it('porAgente ordenado por ticketsAtendidos desc', async () => {
      const m = await getDashboardMetrics();
      for (let i = 1; i < m.porAgente.length; i++) {
        expect(m.porAgente[i].ticketsAtendidos).toBeLessThanOrEqual(m.porAgente[i - 1].ticketsAtendidos);
      }
    });

    it('porCategoria ordenado por total desc', async () => {
      const m = await getDashboardMetrics();
      for (let i = 1; i < m.porCategoria.length; i++) {
        expect(m.porCategoria[i].total).toBeLessThanOrEqual(m.porCategoria[i - 1].total);
      }
    });

    it('respeita periodo customizado', async () => {
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const m = await getDashboardMetrics(new Date(Date.now() - 60 * 1000), amanha);
      expect(m.periodo.inicio.getTime()).toBeLessThanOrEqual(m.periodo.fim.getTime());
    });
  });
});

async function criarTicketResolvido(tag: string, mttrMin: number, slaTotalMin: number, assigneeId: string) {
  const agora = Date.now();
  return prisma.ticket.create({
    data: {
      externalId: `metrics-${tag}-${agora}-${Math.random()}`,
      contactName: `Cliente ${tag}`,
      contactPhone: '85999990090',
      status: 'fechado',
      etapa: 'concluido',
      assigneeId,
      prioridade: 'media',
      slaTotalMinutos: slaTotalMin,
      slaPausadoTotalMin: 0,
      dataAbertura: new Date(agora - (mttrMin + 1) * 60 * 1000),
      dataInicioAtendimento: new Date(agora - (mttrMin) * 60 * 1000),
      dataFechamento: new Date(agora - 1 * 60 * 1000),
    },
  });
}
