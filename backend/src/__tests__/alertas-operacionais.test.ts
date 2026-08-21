import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { getAlertasOperacionais } from '../modules/analytics/alertasOperacionais.service';

let ticketIds: string[] = [];
let connectionIds: string[] = [];

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (connectionIds.length) {
    await prisma.whatsAppConnection.deleteMany({ where: { id: { in: connectionIds } } });
  }
  if (ticketIds.length) {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  ticketIds = [];
  connectionIds = [];
});

async function criarTicket(overrides: Record<string, any> = {}, comMetrics: Record<string, any> = {}) {
  const ticket = await prisma.ticket.create({
    data: {
      externalId: `alertas-${Date.now()}-${Math.random()}`,
      contactName: 'Cliente Alerta',
      contactPhone: '85999997701',
      status: 'aberto',
      etapa: 'em_atendimento',
      canal: 'whatsapp_baileys',
      ...overrides,
      ...(Object.keys(comMetrics).length
        ? { metrics: { create: comMetrics } }
        : {}),
    },
  });
  ticketIds.push(ticket.id);
  return ticket;
}

const resumoOk = {
  totalTickets: 10,
  taxaResolucao: 80,
  tempoMedioRespostaMin: 120,
  csatMedio: 4.2,
  ticketsAbertos: 5,
  slaCumprido: 8,
  slaTotal: 10,
  taxaSla: 80,
};

describe('Alertas Operacionais (dashboard executivo)', () => {
  it('não gera alertas de resumo quando o período está saudável', async () => {
    const alertas = await getAlertasOperacionais(30, resumoOk);
    expect(Array.isArray(alertas)).toBe(true);
    expect(alertas.some(a => a.tipo === 'csat_baixo')).toBe(false);
    expect(alertas.some(a => a.tipo === 'resposta_acima_meta')).toBe(false);
    expect(alertas.some(a => a.tipo === 'resolucao_baixa')).toBe(false);
    expect(alertas.some(a => a.tipo === 'taxa_sla_baixa')).toBe(false);
  });

  it('gera alerta CRÍTICO de SLA violado com base em métrica real', async () => {
    await criarTicket({}, { slaStatus: 'violado', slaPercentualConsumido: 120 });
    const alertas = await getAlertasOperacionais(30, resumoOk);
    const sla = alertas.find(a => a.tipo === 'sla_violado');
    expect(sla).toBeDefined();
    expect(sla!.nivel).toBe('critico');
    expect(sla!.contagem).toBeGreaterThanOrEqual(1);
  });

  it('gera alerta de atenção para SLA em risco (90%)', async () => {
    await criarTicket({}, { slaStatus: 'alerta_90' });
    const alertas = await getAlertasOperacionais(30, resumoOk);
    const sla = alertas.find(a => a.tipo === 'sla_em_risco');
    expect(sla).toBeDefined();
    expect(sla!.nivel).toBe('atencao');
  });

  it('gera alerta INFO para SLA em alerta (75%)', async () => {
    await criarTicket({}, { slaStatus: 'alerta_75' });
    const alertas = await getAlertasOperacionais(30, resumoOk);
    const sla = alertas.find(a => a.tipo === 'sla_alerta');
    expect(sla).toBeDefined();
    expect(sla!.nivel).toBe('info');
  });

  it('gera alerta de atenção para chamados parados em aguardando_os > 24h', async () => {
    await criarTicket({
      etapa: 'aguardando_os',
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    const alertas = await getAlertasOperacionais(30, resumoOk);
    const parado = alertas.find(a => a.tipo === 'parado_aguardando_os');
    expect(parado).toBeDefined();
    expect(parado!.nivel).toBe('atencao');
  });

  it('NÃO gera alerta de parado para ticket atualizado recentemente', async () => {
    await criarTicket({ etapa: 'aguardando_os' });
    const alertas = await getAlertasOperacionais(30, resumoOk);
    expect(alertas.some(a => a.tipo === 'parado_aguardando_os')).toBe(false);
  });

  it('gera alerta de atenção quando CSAT abaixo da meta', async () => {
    const alertas = await getAlertasOperacionais(30, { ...resumoOk, csatMedio: 3.1 });
    const csat = alertas.find(a => a.tipo === 'csat_baixo');
    expect(csat).toBeDefined();
    expect(csat!.nivel).toBe('atencao');
  });

  it('gera alerta de atenção quando tempo de resposta acima da meta', async () => {
    const alertas = await getAlertasOperacionais(30, { ...resumoOk, tempoMedioRespostaMin: 500 });
    const resposta = alertas.find(a => a.tipo === 'resposta_acima_meta');
    expect(resposta).toBeDefined();
    expect(resposta!.nivel).toBe('atencao');
  });

  it('gera alerta de atenção quando taxa de resolução baixa', async () => {
    const alertas = await getAlertasOperacionais(30, { ...resumoOk, taxaResolucao: 45 });
    const baixa = alertas.find(a => a.tipo === 'resolucao_baixa');
    expect(baixa).toBeDefined();
    expect(baixa!.nivel).toBe('atencao');
  });

  it('gera alerta de atenção quando taxa de SLA abaixo da meta', async () => {
    const alertas = await getAlertasOperacionais(30, { ...resumoOk, taxaSla: 70 });
    const sla = alertas.find(a => a.tipo === 'taxa_sla_baixa');
    expect(sla).toBeDefined();
    expect(sla!.nivel).toBe('atencao');
  });

  it('gera alerta CRÍTICO de WhatsApp offline para conexão ativa desconectada', async () => {
    const conn = await prisma.whatsAppConnection.create({
      data: { nome: 'Filial Teste', numero: '85999997799', slug: `alerta-${Date.now()}` },
    });
    connectionIds.push(conn.id);

    const alertas = await getAlertasOperacionais(30, resumoOk);
    const offline = alertas.find(a => a.tipo === 'whatsapp_offline');
    expect(offline).toBeDefined();
    expect(offline!.nivel).toBe('critico');
  });

  it('não quebra quando não há conexões WhatsApp cadastradas', async () => {
    const alertas = await getAlertasOperacionais(30, resumoOk);
    expect(Array.isArray(alertas)).toBe(true);
  });
});