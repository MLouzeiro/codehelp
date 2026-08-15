import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import {
  gerarRelatorioAnalitico,
  gerarCsvRelatorio,
  gerarPdfRelatorio,
  obterOpcoesFiltros,
  buildWhere,
} from '../modules/analytics/relatorios.service';

let ticketIds: string[] = [];

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (ticketIds.length) {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    ticketIds = [];
  }
});

describe('Relatório Analítico — filtros combinados (TESTE #32)', () => {
  it('gera relatório com todas as seções e comparativo', async () => {
    const rel = await gerarRelatorioAnalitico({});

    expect(rel.periodo.dias).toBeGreaterThanOrEqual(1);
    expect(rel.resumo).toMatchObject({
      totalTickets: expect.any(Number),
      ticketsFechados: expect.any(Number),
      taxaResolucao: expect.any(Number),
      tempoMedioRespostaMin: expect.any(Number),
      tempoMedioResolucaoH: expect.any(Number),
      csatMedio: expect.any(Number),
      fcr: expect.any(Number),
    });
    expect(Array.isArray(rel.tendenciaDiaria)).toBe(true);
    expect(Array.isArray(rel.porCanal)).toBe(true);
    expect(Array.isArray(rel.porPrioridade)).toBe(true);
    expect(Array.isArray(rel.porStatus)).toBe(true);
    expect(Array.isArray(rel.porCategoria)).toBe(true);
    expect(Array.isArray(rel.porDepartamento)).toBe(true);
    expect(Array.isArray(rel.porFila)).toBe(true);
    expect(Array.isArray(rel.porAnalista)).toBe(true);
    expect(Array.isArray(rel.porCliente)).toBe(true);
    expect(Array.isArray(rel.porAssunto)).toBe(true);
    expect(Array.isArray(rel.tempoPorTipo)).toBe(true);
    expect(Array.isArray(rel.tempoPorDepartamento)).toBe(true);
    expect(rel.horasDev).toMatchObject({ totalH: expect.any(Number), porTicket: expect.any(Number) });
    expect(rel.implantacoes).toMatchObject({ total: expect.any(Number), concluidas: expect.any(Number) });
    expect(rel.comparativo).toMatchObject({
      deltaTickets: expect.any(Number),
      deltaFechados: expect.any(Number),
      deltaTempoResposta: expect.any(Number),
      deltaCsat: expect.any(Number),
      deltaSla: expect.any(Number),
      deltaFcr: expect.any(Number),
    });
  });

  it('aplica filtros combinados de canal + prioridade + status', async () => {
    const agora = new Date();

    const t1 = await prisma.ticket.create({
      data: {
        externalId: `rel-can-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Rel',
        contactPhone: '85999998801',
        status: 'aberto',
        etapa: 'fila',
        canal: 'email',
        prioridade: 'urgente',
        assunto: 'Problema no sistema financeiro',
        createdAt: agora,
      },
    });
    const t2 = await prisma.ticket.create({
      data: {
        externalId: `rel-can2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Rel',
        contactPhone: '85999998802',
        status: 'aberto',
        etapa: 'fila',
        canal: 'telefone',
        prioridade: 'baixa',
        assunto: 'Dúvida simples',
        createdAt: agora,
      },
    });
    ticketIds = [t1.id, t2.id];

    const filtro = {
      inicio: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()),
      fim: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999),
      canal: 'email',
      prioridade: 'urgente',
      status: 'aberto',
    };
    const rel = await gerarRelatorioAnalitico(filtro);

    expect(rel.resumo.totalTickets).toBeGreaterThanOrEqual(1);
    const where = buildWhere(filtro);
    const contagem = await prisma.ticket.count({ where });
    expect(contagem).toBe(1);
    expect(rel.porCanal.some(c => c.valor === 'email' && c.total === 1)).toBe(true);
    expect(rel.porPrioridade.some(p => p.valor === 'urgente' && p.total === 1)).toBe(true);
    expect(rel.porAssunto.some(a => a.valor === 'Problema no sistema financeiro')).toBe(true);
  });

  it('filtro por assunto (contains) restringe o conjunto', async () => {
    const agora = new Date();
    const t1 = await prisma.ticket.create({
      data: {
        externalId: `rel-asm-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Rel',
        contactPhone: '85999998803',
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp',
        prioridade: 'media',
        assunto: 'Impressora sem conexão de rede',
        createdAt: agora,
      },
    });
    const t2 = await prisma.ticket.create({
      data: {
        externalId: `rel-asm2-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Rel',
        contactPhone: '85999998804',
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp',
        prioridade: 'media',
        assunto: 'Faturamento duplicado',
        createdAt: agora,
      },
    });
    ticketIds = [t1.id, t2.id];

    const filtro = { assunto: 'impressora' };
    const rel = await gerarRelatorioAnalitico(filtro);
    expect(rel.resumo.totalTickets).toBe(1);
    expect(rel.porAssunto.some(a => a.valor === 'Impressora sem conexão de rede')).toBe(true);
  });

  it('gera CSV com cabeçalhos e seções', async () => {
    const rel = await gerarRelatorioAnalitico({});
    const csv = gerarCsvRelatorio(rel);
    expect(csv).toContain('Relatório Analítico');
    expect(csv).toContain('Indicador;Valor');
    expect(csv).toContain('Total de tickets');
    expect(csv).toContain('Por analista');
  });

  it('gera PDF válido (buffer %PDF)', async () => {
    const rel = await gerarRelatorioAnalitico({});
    const pdf = await gerarPdfRelatorio(rel);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('obterOpcoesFiltros retorna listas para dropdowns', async () => {
    const opcoes = await obterOpcoesFiltros();
    expect(Array.isArray(opcoes.filas)).toBe(true);
    expect(Array.isArray(opcoes.departamentos)).toBe(true);
    expect(Array.isArray(opcoes.analistas)).toBe(true);
    expect(Array.isArray(opcoes.clientes)).toBe(true);
    expect(opcoes.canais).toContain('whatsapp');
    expect(opcoes.prioridades).toContain('urgente');
    expect(Array.isArray(opcoes.statuses)).toBe(true);
    expect(Array.isArray(opcoes.categorias)).toBe(true);
  });
});