import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import prisma from '../config/database';
import {
  getMetasIndicadores,
  setMetasIndicadores,
  classificarTempo,
  classificarPercentual,
  getIndicadoresAtendimento,
  getSlaTicketIndicador,
  getAlertasIndicadores,
  exportarIndicadoresCsv,
  METAS_INDICADORES_DEFAULT,
} from '../modules/helpdesk/indicadores.service';

let limpeza: {
  ticketIds: string[];
  messageIds: string[];
  csatIds: string[];
  audId: string[];
  userIds: string[];
} = { ticketIds: [], messageIds: [], csatIds: [], audId: [], userIds: [] };

function sufixo() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function tag() {
  return `ind_${sufixo()}`;
}

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

async function limparDados() {
  await prisma.cSATResposta.deleteMany({ where: { id: { in: limpeza.csatIds } } });
  await prisma.auditoriaProfissional.deleteMany({ where: { id: { in: limpeza.audId } } });
  await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.message.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.aIClassification.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: limpeza.ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: limpeza.userIds } } });
  await prisma.helpdeskConfig.deleteMany({ where: { slug: 'metas_indicadores' } });
  limpeza = { ticketIds: [], messageIds: [], csatIds: [], audId: [], userIds: [] };
}

async function criarTicketTeste(assuntoTag: string, extra?: Record<string, any>) {
  const ticket = await prisma.ticket.create({
    data: {
      contactName: 'Contato Indicadores',
      contactPhone: `55${sufixo().slice(-10)}`,
      assunto: assuntoTag,
      status: 'aberto',
      etapa: 'fila',
      canal: 'whatsapp',
      prioridade: 'media',
      ...extra,
    },
  });
  limpeza.ticketIds.push(ticket.id);
  return ticket;
}

async function criarMensagem(ticketId: string, fromMe: boolean, createdAt: Date) {
  const msg = await prisma.message.create({
    data: { ticketId, fromMe, content: fromMe ? 'Resposta do agente' : 'Mensagem do cliente', sentAt: createdAt, createdAt },
  });
  limpeza.messageIds.push(msg.id);
  return msg;
}

async function criarTecnico() {
  const user = await prisma.user.create({
    data: {
      name: `Tecnico ${sufixo()}`,
      email: `tec_ind_${sufixo()}@test.com`,
      password: 'hash-teste',
      role: 'tecnico',
      active: true,
    },
  });
  limpeza.userIds.push(user.id);
  return user;
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

describe('Metas de indicadores', () => {
  it('retorna metas padrão quando não configuradas', async () => {
    const metas = await getMetasIndicadores();
    expect(metas.tmrMetaMin).toBe(METAS_INDICADORES_DEFAULT.tmrMetaMin);
    expect(metas.slaRiscoPct).toBe(METAS_INDICADORES_DEFAULT.slaRiscoPct);
  });

  it('salva e relê metas customizadas', async () => {
    await setMetasIndicadores({ tmrMetaMin: 120, slaMetaPct: 90 });
    const metas = await getMetasIndicadores();
    expect(metas.tmrMetaMin).toBe(120);
    expect(metas.slaMetaPct).toBe(90);
    expect(metas.tmeMetaMin).toBe(METAS_INDICADORES_DEFAULT.tmeMetaMin);
  });

  it('clampa valores fora da faixa', async () => {
    await setMetasIndicadores({ slaMetaPct: 150, slaRiscoPct: -5 });
    const metas = await getMetasIndicadores();
    expect(metas.slaMetaPct).toBe(100);
    expect(metas.slaRiscoPct).toBe(1);
  });
});

describe('Classificação visual (ícone + texto, não só cor)', () => {
  it('classifica tempo como dentro/atenção/fora do limite', () => {
    const dentro = classificarTempo(30, 60);
    expect(dentro.estado).toBe('dentro');
    expect(dentro.icone).toBe('🟢');
    expect(dentro.texto).toBe('Dentro do limite');

    const atencao = classificarTempo(65, 60);
    expect(atencao.estado).toBe('atencao');
    expect(atencao.icone).toBe('🟡');

    const fora = classificarTempo(120, 60);
    expect(fora.estado).toBe('fora');
    expect(fora.icone).toBe('🔴');
  });

  it('classifica percentual de SLA (meta alta é melhor)', () => {
    const dentro = classificarPercentual(96, 95);
    expect(dentro.estado).toBe('dentro');
    const atencao = classificarPercentual(90, 95);
    expect(atencao.estado).toBe('atencao');
    const fora = classificarPercentual(50, 95);
    expect(fora.estado).toBe('fora');
  });
});

describe('getIndicadoresAtendimento', () => {
  it('retorna estrutura completa mesmo sem dados', async () => {
    const t = tag();
    const dados = await getIndicadoresAtendimento({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    expect(dados.cards.totalTickets.valor).toBe(0);
    expect(dados.cards.tmr.valor).toBe(0);
    expect(dados.sla.total).toBe(0);
    expect(dados.porAnalista).toEqual([]);
    expect(dados.cards.sla.classificacao.icone).toBeTruthy();
  });

  it('calcula TMR, primeira resposta e tempo total', async () => {
    const t = tag();
    const aberta = new Date(Date.now() - 2 * HORA);
    const fechada = new Date(Date.now() - HORA);
    await criarTicketTeste(t, {
      dataAbertura: aberta,
      dataFechamento: fechada,
      status: 'fechado',
      etapa: 'concluido',
      dataPrimeiraResposta: new Date(aberta.getTime() + 10 * MIN),
      slaTotalMinutos: 240,
      createdAt: aberta,
    });
    const dados = await getIndicadoresAtendimento({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    expect(dados.cards.totalTickets.valor).toBe(1);
    expect(dados.cards.tmr.valor).toBe(60);
    expect(dados.cards.primeiraResposta.valor).toBe(10);
    expect(dados.primeiraResposta.dentroMeta).toBe(1);
    expect(dados.primeiraResposta.percentualDentro).toBe(100);
    expect(dados.tempoTotalMin).toBe(60);
  });

  it('calcula TME a partir das mensagens (cliente → resposta do agente)', async () => {
    const t = tag();
    const ticket = await criarTicketTeste(t, {
      dataAbertura: new Date(Date.now() - 2 * HORA),
      status: 'em_atendimento',
      etapa: 'em_atendimento',
      slaTotalMinutos: 240,
      createdAt: new Date(Date.now() - 2 * HORA),
    });
    const t0 = new Date(Date.now() - 90 * MIN);
    await criarMensagem(ticket.id, false, t0);
    await criarMensagem(ticket.id, true, new Date(t0.getTime() + 15 * MIN));
    const dados = await getIndicadoresAtendimento({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    expect(dados.cards.tme.valor).toBe(15);
  });

  it('contabiliza SLA cumprido, em risco e violado', async () => {
    const t = tag();
    await criarTicketTeste(t, {
      slaTotalMinutos: 60,
      dataAbertura: new Date(Date.now() - 5 * HORA),
      createdAt: new Date(Date.now() - 5 * HORA),
      status: 'aberto',
      etapa: 'fila',
    });
    await criarTicketTeste(t, {
      slaTotalMinutos: 240,
      dataAbertura: new Date(Date.now() - 200 * MIN),
      createdAt: new Date(Date.now() - 200 * MIN),
      status: 'aberto',
      etapa: 'fila',
    });
    await criarTicketTeste(t, {
      slaTotalMinutos: 240,
      dataAbertura: new Date(Date.now() - 30 * MIN),
      createdAt: new Date(Date.now() - 30 * MIN),
      status: 'aberto',
      etapa: 'fila',
    });
    await criarTicketTeste(t, {
      slaTotalMinutos: 240,
      dataAbertura: new Date(Date.now() - 2 * HORA),
      dataFechamento: new Date(Date.now() - HORA),
      createdAt: new Date(Date.now() - 2 * HORA),
      status: 'fechado',
      etapa: 'concluido',
    });
    const dados = await getIndicadoresAtendimento({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    expect(dados.sla.total).toBe(4);
    expect(dados.sla.violado).toBe(1);
    expect(dados.sla.emRisco).toBe(1);
    expect(dados.sla.cumprido).toBe(2);
    expect(dados.cards.slaViolado.valor).toBe(1);
  });

  it('compara com o período anterior (delta e evolução)', async () => {
    const t = tag();
    const agora = new Date();
    const inicio = new Date(agora.getTime() - 7 * DIA);
    const fim = agora;
    const abertaCur = new Date(agora.getTime() - 2 * DIA);
    await criarTicketTeste(t, {
      dataAbertura: abertaCur,
      dataFechamento: new Date(abertaCur.getTime() + HORA),
      createdAt: abertaCur,
      status: 'fechado',
      etapa: 'concluido',
      slaTotalMinutos: 240,
    });
    const abertaPrev = new Date(agora.getTime() - 10 * DIA);
    await criarTicketTeste(t, {
      dataAbertura: abertaPrev,
      dataFechamento: new Date(abertaPrev.getTime() + 2 * HORA),
      createdAt: abertaPrev,
      status: 'fechado',
      etapa: 'concluido',
      slaTotalMinutos: 240,
    });
    const dados = await getIndicadoresAtendimento({ inicio, fim, assunto: t });
    expect(dados.cards.totalTickets.valor).toBe(1);
    expect(dados.cards.tmr.valor).toBe(60);
    expect(dados.comparacaoPeriodoAnterior.tmr.atual).toBe(60);
    expect(dados.comparacaoPeriodoAnterior.tmr.anterior).toBe(120);
    expect(dados.comparacaoPeriodoAnterior.tmr.deltaPct).toBeLessThan(0);
    expect(dados.cards.tmr.evolucao).toBe('melhorou');
    expect(dados.cards.tmr.deltaLabel).toContain('%');
  });

  it('filtros recalculam tudo (analista, categoria, período)', async () => {
    const t = tag();
    const catA = `cat_${sufixo()}`;
    const catB = `cat_${sufixo()}`;
    const tec = await criarTecnico();
    await criarTicketTeste(t, {
      dataAbertura: new Date(Date.now() - HORA),
      status: 'em_atendimento',
      etapa: 'em_atendimento',
      assigneeId: tec.id,
      categoria: catA,
      slaTotalMinutos: 240,
      createdAt: new Date(Date.now() - HORA),
    });
    await criarTicketTeste(t, {
      dataAbertura: new Date(Date.now() - HORA),
      status: 'aberto',
      etapa: 'fila',
      categoria: catB,
      slaTotalMinutos: 240,
      createdAt: new Date(Date.now() - HORA),
    });

    const todos = await getIndicadoresAtendimento({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    expect(todos.cards.totalTickets.valor).toBe(2);

    const porAnalista = await getIndicadoresAtendimento({
      inicio: new Date(Date.now() - 7 * DIA),
      fim: new Date(),
      assunto: t,
      analistaId: tec.id,
    });
    expect(porAnalista.cards.totalTickets.valor).toBe(1);

    const porCategoria = await getIndicadoresAtendimento({
      inicio: new Date(Date.now() - 7 * DIA),
      fim: new Date(),
      assunto: t,
      categoria: catA,
    });
    expect(porCategoria.cards.totalTickets.valor).toBe(1);

    const foraDoPeriodo = await getIndicadoresAtendimento({
      inicio: new Date(Date.now() - 30 * DIA),
      fim: new Date(Date.now() - 25 * DIA),
      assunto: t,
    });
    expect(foraDoPeriodo.cards.totalTickets.valor).toBe(0);

    const linhas = await exportarIndicadoresCsv({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    expect(linhas).toContain('Indicador;Valor;Meta');
    expect(linhas).toContain('TMR');
  });
});

describe('getSlaTicketIndicador (tempo real)', () => {
  it('classifica ticket aberto dentro do prazo', async () => {
    const t = tag();
    const ticket = await criarTicketTeste(t, {
      slaTotalMinutos: 240,
      dataAbertura: new Date(Date.now() - 30 * MIN),
      createdAt: new Date(Date.now() - 30 * MIN),
      status: 'aberto',
      etapa: 'fila',
    });
    const sla = await getSlaTicketIndicador(ticket.id);
    expect(sla).not.toBeNull();
    expect(sla!.classificacao.estado).toBe('dentro');
    expect(sla!.classificacao.icone).toBe('🟢');
    expect(sla!.statusSla).toBe('ok');
  });

  it('classifica ticket com SLA violado', async () => {
    const t = tag();
    const ticket = await criarTicketTeste(t, {
      slaTotalMinutos: 60,
      dataAbertura: new Date(Date.now() - 5 * HORA),
      createdAt: new Date(Date.now() - 5 * HORA),
      status: 'aberto',
      etapa: 'fila',
    });
    const sla = await getSlaTicketIndicador(ticket.id);
    expect(sla!.classificacao.estado).toBe('fora');
    expect(sla!.classificacao.icone).toBe('🔴');
    expect(sla!.statusSla).toBe('violado');
  });

  it('retorna null para ticket inexistente', async () => {
    const sla = await getSlaTicketIndicador('id-inexistente');
    expect(sla).toBeNull();
  });
});

describe('getAlertasIndicadores', () => {
  it('gera alertas de SLA violado, em risco, aguardando resposta e acima da meta', async () => {
    const t = tag();
    await criarTicketTeste(t, {
      slaTotalMinutos: 60,
      dataAbertura: new Date(Date.now() - 5 * HORA),
      createdAt: new Date(Date.now() - 5 * HORA),
      status: 'em_atendimento',
      etapa: 'em_atendimento',
    });
    const ticketRisco = await criarTicketTeste(t, {
      slaTotalMinutos: 240,
      dataAbertura: new Date(Date.now() - 200 * MIN),
      createdAt: new Date(Date.now() - 200 * MIN),
      status: 'em_atendimento',
      etapa: 'em_atendimento',
    });
    const ticketEspera = await criarTicketTeste(t, {
      slaTotalMinutos: 240,
      dataAbertura: new Date(Date.now() - HORA),
      createdAt: new Date(Date.now() - HORA),
      status: 'em_atendimento',
      etapa: 'em_atendimento',
    });
    await criarMensagem(ticketEspera.id, false, new Date(Date.now() - 40 * MIN));
    await criarMensagem(ticketRisco.id, false, new Date(Date.now() - 5 * MIN));
    await criarTicketTeste(t, {
      slaTotalMinutos: 9999,
      dataAbertura: new Date(Date.now() - 10 * HORA),
      createdAt: new Date(Date.now() - 10 * HORA),
      status: 'aberto',
      etapa: 'fila',
      updatedAt: new Date(Date.now() - 2 * HORA),
    });

    const { alertas } = await getAlertasIndicadores({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    const tipos = alertas.map(a => a.tipo);
    expect(tipos).toContain('sla_violado');
    expect(tipos).toContain('sla_em_risco');
    expect(tipos).toContain('aguardando_resposta');
    expect(tipos).toContain('acima_da_meta');
    const violado = alertas.find(a => a.tipo === 'sla_violado');
    expect(violado!.gravidade).toBe('critico');
    const emRisco = alertas.find(a => a.tipo === 'sla_em_risco');
    expect(emRisco!.mensagem).toContain('consumiu');
  });

  it('não gera alertas quando não há tickets correspondentes', async () => {
    const { alertas, total } = await getAlertasIndicadores({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: tag() });
    expect(total).toBe(0);
    expect(alertas).toEqual([]);
  });
});

describe('per-analista', () => {
  it('agrupa indicadores por analista', async () => {
    const t = tag();
    const tec = await criarTecnico();
    const t1 = await criarTicketTeste(t, {
      dataAbertura: new Date(Date.now() - 2 * HORA),
      dataFechamento: new Date(Date.now() - HORA),
      status: 'fechado',
      etapa: 'concluido',
      dataPrimeiraResposta: new Date(Date.now() - (2 * HORA - 10 * MIN)),
      assigneeId: tec.id,
      slaTotalMinutos: 240,
      createdAt: new Date(Date.now() - 2 * HORA),
    });
    await criarTicketTeste(t, {
      dataAbertura: new Date(Date.now() - HORA),
      status: 'em_atendimento',
      etapa: 'em_atendimento',
      assigneeId: tec.id,
      slaTotalMinutos: 240,
      createdAt: new Date(Date.now() - HORA),
    });
    await prisma.cSATResposta.create({
      data: { ticketId: t1.id, nota: 5, respondidoEm: new Date() },
    });
    await prisma.auditoriaProfissional.create({
      data: {
        ticketId: t1.id,
        agenteId: tec.id,
        retrabalho: true,
        classificacaoResolucao: 'REABERTO',
      },
    });

    const dados = await getIndicadoresAtendimento({ inicio: new Date(Date.now() - 7 * DIA), fim: new Date(), assunto: t });
    const analista = dados.porAnalista.find(a => a.agenteId === tec.id);
    expect(analista).toBeDefined();
    expect(analista!.tickets).toBe(2);
    expect(analista!.resolvidos).toBe(1);
    expect(analista!.tmrMin).toBe(60);
    expect(analista!.primeiraRespostaMin).toBe(10);
    expect(analista!.csatMedia).toBe(5);
    expect(analista!.reaberturas).toBe(1);
    expect(analista!.retrabalho).toBe(1);
    expect(analista!.taxaSla).toBeGreaterThanOrEqual(0);
  });
});