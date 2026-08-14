import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { gerarDashboardExecutivo } from '../modules/analytics/dashboardExecutivo.service';

let ticketId: string;

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (ticketId) {
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
});

describe('Dashboard Executivo (FASE 6)', () => {
  it('gera painel consolidado com todas as seções', async () => {
    const dash = await gerarDashboardExecutivo(30);

    expect(dash.periodo.dias).toBe(30);
    expect(dash.resumo).toMatchObject({
      totalTickets: expect.any(Number),
      ticketsFechados: expect.any(Number),
      ticketsAbertos: expect.any(Number),
      taxaResolucao: expect.any(Number),
      tempoMedioRespostaMin: expect.any(Number),
      tempoMedioResolucaoH: expect.any(Number),
      taxaSla: expect.any(Number),
      csatMedio: expect.any(Number),
      fcr: expect.any(Number),
    });
    expect(Array.isArray(dash.tendenciaDiaria)).toBe(true);
    expect(dash.tendenciaDiaria.length).toBeGreaterThanOrEqual(30);
    expect(Array.isArray(dash.statusPorDia)).toBe(true);
    expect(Array.isArray(dash.statuses)).toBe(true);
    expect(Array.isArray(dash.porEtapa)).toBe(true);
    expect(Array.isArray(dash.porCanal)).toBe(true);
    expect(Array.isArray(dash.porCategoria)).toBe(true);
    expect(Array.isArray(dash.porDepartamento)).toBe(true);
    expect(Array.isArray(dash.porAgente)).toBe(true);
    expect(Array.isArray(dash.tempoMedioPorFila)).toBe(true);
    expect(Array.isArray(dash.csatTrending)).toBe(true);
    expect(dash.comparativo).toMatchObject({
      deltaTickets: expect.any(Number),
      deltaFechados: expect.any(Number),
      deltaTempoResposta: expect.any(Number),
      deltaCsat: expect.any(Number),
    });
  });

  it('respeita período parametrizável de 7 dias', async () => {
    const dash = await gerarDashboardExecutivo(7);
    expect(dash.periodo.dias).toBe(7);
    expect(dash.tendenciaDiaria.length).toBeGreaterThanOrEqual(7);
  });

  it('contabiliza ticket criado no período no resumo', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `exec-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Exec',
        contactPhone: '85999997700',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const dash = await gerarDashboardExecutivo(7);
    expect(dash.resumo.totalTickets).toBeGreaterThanOrEqual(1);
    expect(dash.porEtapa.some(e => e.etapa === 'em_atendimento' && e.total > 0)).toBe(true);
  });
});