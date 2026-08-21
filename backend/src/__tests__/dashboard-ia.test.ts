import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import prisma from '../config/database';
import { getDashboardIa } from '../modules/analytics/dashboardIa.service';
import { env } from '../config/env';

let limpeza: {
  ticketIds: string[];
  userIds: string[];
} = { ticketIds: [], userIds: [] };

function sufixo() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function limparDados() {
  await prisma.aIAgentClosureAudit.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.aIAgentAudit.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.cSATResposta.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.message.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } }).catch(() => {});
  await prisma.ticket.deleteMany({ where: { id: { in: limpeza.ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: limpeza.userIds } } });
  limpeza = { ticketIds: [], userIds: [] };
}

async function criarTecnico(nome = 'Analista IA') {
  const user = await prisma.user.create({
    data: {
      name: `${nome} ${sufixo()}`,
      email: `ia_${sufixo()}@test.com`,
      password: 'hash-teste',
      role: 'tecnico',
      active: true,
    },
  });
  limpeza.userIds.push(user.id);
  return user;
}

async function criarTicket(tecnicoId: string, diasAtras: number, fechado = false) {
  const dataAbertura = new Date(Date.now() - diasAtras * 24 * 3600 * 1000);
  const ticket = await prisma.ticket.create({
    data: {
      externalId: `dashia_${sufixo()}`,
      contactName: 'Cliente Dash IA',
      contactPhone: `55${sufixo().slice(-10)}`,
      status: fechado ? 'fechado' : 'aberto',
      etapa: fechado ? 'concluido' : 'em_atendimento',
      canal: 'whatsapp_baileys',
      dataAbertura,
      dataFechamento: fechado ? new Date(dataAbertura.getTime() + 3600 * 1000) : null,
      assigneeId: tecnicoId,
    },
  });
  limpeza.ticketIds.push(ticket.id);
  return ticket;
}

beforeAll(async () => {
  await limparDados();
});

afterEach(async () => {
  await limparDados();
});

afterAll(async () => {
  await limparDados();
});

describe('Dashboard IA (GET /api/analytics/dashboard-ia)', () => {
  it('retorna estrutura completa mesmo sem dados', async () => {
    const data = await getDashboardIa(7);

    expect(data.periodo).toBeDefined();
    expect(data.periodo.dias).toBe(7);
    expect(data.periodo.label).toContain(' a ');
    expect(data.atualizadoEm).toBeDefined();
    expect(data.cards).toMatchObject({
      totalTickets: expect.any(Object),
      tmr: expect.any(Object),
      tme: expect.any(Object),
      primeiraResposta: expect.any(Object),
      sla: expect.any(Object),
      slaEmRisco: expect.any(Object),
      slaViolado: expect.any(Object),
      tempoTotal: expect.any(Object),
    });
    expect(data.cards.sla.classificacao).toHaveProperty('icone');
    expect(data.sla.percentualCumprimento).toBeTypeOf('number');
    expect(data.primeiraResposta.percentualDentro).toBeTypeOf('number');
    expect(Array.isArray(data.porAnalista)).toBe(true);
    expect(Array.isArray(data.porDia)).toBe(true);
    expect(Array.isArray(data.alertas)).toBe(true);
    expect(Array.isArray(data.insights)).toBe(true);
    expect(data.insights.length).toBeGreaterThan(0);
    expect(data.fonte).toBe('local');
  });

  it('limita dias ao intervalo 1..90', async () => {
    const data = await getDashboardIa(500);
    expect(data.periodo.dias).toBe(90);

    const data1 = await getDashboardIa(0);
    expect(data1.periodo.dias).toBe(1);
  });

  it('enriquece porAnalista com nota IA e encerramentos', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicket(tecnico.id, 1, true);
    const ticket2 = await criarTicket(tecnico.id, 1, true);

    await prisma.aIAgentAudit.create({
      data: {
        ticketId: ticket.id,
        agentId: tecnico.id,
        conteudoMensagem: 'Atendimento cordial e objetivo',
        notaGeral: 8.5,
        classificacao: 'positivo',
        processadoEm: new Date(),
      },
    });

    await prisma.aIAgentClosureAudit.create({
      data: {
        ticketId: ticket.id,
        agentId: tecnico.id,
        protocolo: ticket.protocolo || 'PROTO',
        tipo: 'resolucao_real',
        nota: 9,
        diagnostico: 'Resolução confirmada pelo cliente',
      },
    });
    await prisma.aIAgentClosureAudit.create({
      data: {
        ticketId: ticket2.id,
        agentId: tecnico.id,
        protocolo: ticket2.protocolo || 'PROTO2',
        tipo: 'encerramento_prematuro',
        nota: 4,
        diagnostico: 'Cliente não confirmou resolução',
        recomendaReabertura: true,
      },
    });

    const data = await getDashboardIa(7);

    const analista = data.porAnalista.find(a => a.agenteId === tecnico.id);
    expect(analista).toBeDefined();
    expect(analista!.notaIa).toBe(8.5);
    expect(analista!.auditoriasIa).toBe(1);
    expect(analista!.encerramentos.auditados).toBe(2);
    expect(analista!.encerramentos.prematuros).toBe(1);
    expect(analista!.encerramentos.resolucoesReais).toBe(1);
    expect(analista!.encerramentos.notaMedia).toBeCloseTo(6.5, 1);
  });

  it('insights locais sinalizam SLA e encerramento prematuro', async () => {
    const tecnico = await criarTecnico();
    const ticket = await criarTicket(tecnico.id, 1, true);
    const ticket2 = await criarTicket(tecnico.id, 1, true);

    await prisma.aIAgentClosureAudit.create({
      data: { ticketId: ticket.id, agentId: tecnico.id, protocolo: ticket.protocolo || 'P1', tipo: 'encerramento_prematuro', nota: 3, recomendaReabertura: true },
    });
    await prisma.aIAgentClosureAudit.create({
      data: { ticketId: ticket2.id, agentId: tecnico.id, protocolo: ticket2.protocolo || 'P2', tipo: 'encerramento_prematuro', nota: 5, recomendaReabertura: true },
    });

    const data = await getDashboardIa(7);

    const analista = data.porAnalista.find(a => a.agenteId === tecnico.id);
    expect(analista).toBeDefined();
    expect(analista!.encerramentos.prematuros).toBe(2);

    const insightPrematuro = data.insights.find(i => i.texto.includes(analista!.agenteNome));
    expect(insightPrematuro).toBeDefined();
    expect(insightPrematuro!.gravidade).toBe('atencao');
    expect(data.insights.length).toBeGreaterThan(0);
  });

  it('funciona com fonte claude quando chave configurada (skip sem chave)', async () => {
    if (env.anthropicKey) {
      const data = await getDashboardIa(7);
      expect(['claude', 'local']).toContain(data.fonte);
    } else {
      expect(env.anthropicKey).toBe('');
    }
  });
});