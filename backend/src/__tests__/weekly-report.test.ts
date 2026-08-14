import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { gerarRelatorioSemanal, formatarMensagemWhatsApp } from '../modules/analytics/weeklyReport.service';

let ticketId: string;

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (ticketId) {
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
});

describe('Relatório Gerencial semanal (FASE 5)', () => {
  it('gera relatório com resumo completo mesmo sem tickets', async () => {
    const report = await gerarRelatorioSemanal(new Date(Date.now() - 7 * 24 * 3600 * 1000), new Date());

    expect(report.periodo).toBeDefined();
    expect(report.periodo.label).toContain(' a ');
    expect(report.resumo).toMatchObject({
      totalTickets: expect.any(Number),
      ticketsFechados: expect.any(Number),
      ticketsAbertos: expect.any(Number),
      taxaResolucao: expect.any(Number),
      tempoMedioResposta: expect.any(Number),
      tempoMedioResolucao: expect.any(Number),
      taxaSla: expect.any(Number),
      csatMedio: expect.any(Number),
      fcr: expect.any(Number),
    });
    expect(Array.isArray(report.porCliente)).toBe(true);
    expect(Array.isArray(report.porCategoria)).toBe(true);
    expect(Array.isArray(report.porDepartamento)).toBe(true);
    expect(Array.isArray(report.porAgente)).toBe(true);
    expect(Array.isArray(report.porCanal)).toBe(true);
    expect(Array.isArray(report.porDia)).toBe(true);
    expect(report.porDia.length).toBeGreaterThanOrEqual(7);
    expect(Array.isArray(report.sugestoesIa)).toBe(true);
    expect(report.comparativoSemanaAnterior).toMatchObject({
      deltaTickets: expect.any(Number),
      deltaFechados: expect.any(Number),
      deltaTempoResposta: expect.any(Number),
      deltaCsat: expect.any(Number),
      deltaSla: expect.any(Number),
    });
  });

  it('contabiliza ticket criado no período', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `rel-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Rel',
        contactPhone: '85999996600',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
      },
    });
    ticketId = ticket.id;

    const agora = new Date();
    const inicio = new Date(agora.getTime() - 24 * 3600 * 1000);
    const report = await gerarRelatorioSemanal(inicio, agora);

    expect(report.resumo.totalTickets).toBeGreaterThanOrEqual(1);
    expect(report.porDia.some(d => d.total > 0)).toBe(true);
  });

  it('formata mensagem WhatsApp com dados do relatório', async () => {
    const agora = new Date();
    const inicio = new Date(agora.getTime() - 7 * 24 * 3600 * 1000);
    const report = await gerarRelatorioSemanal(inicio, agora);

    const msg = formatarMensagemWhatsApp(report);

    expect(msg).toContain('RELATÓRIO SEMANAL');
    expect(msg).toContain(`Total de tickets: *${report.resumo.totalTickets}*`);
    expect(msg).toContain('RESUMO');
    expect(msg).toContain('PERFORMANCE');
    expect(msg).toContain('_Relatório gerado automaticamente pelo Codemed Hub_');
  });
});