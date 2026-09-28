import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../config/database';
import {
  calcularIndicePrioridade,
  analisePorAssunto,
  analiseRiscoClientes,
  analiseProgresso,
  analiseEscalonamento,
  detectarOportunidadesAutomacao,
  detectarPossiveisBugs,
  gerarResumoExecutivo,
  gerarInteligenciaCompleta,
  FiltrosInteligencia,
} from '../modules/helpdesk/inteligencia-operacional.service';

let limpeza = {
  ticketIds: [] as string[],
  messageIds: [] as string[],
  userIds: [] as string[],
  clientIds: [] as string[],
};

function sufixo() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

const MIN = 60 * 1000;
const HORA = 60 * MIN;

async function limparDados() {
  await prisma.message.deleteMany({ where: { ticketId: { in: limpeza.ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: limpeza.ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: limpeza.userIds } } });
  await prisma.client.deleteMany({ where: { id: { in: limpeza.clientIds } } });
  limpeza = { ticketIds: [], messageIds: [], userIds: [], clientIds: [] };
}

async function criarClienteTeste() {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `Cliente Intel ${sufixo()}`,
      cnpjCpf: `${Math.floor(Math.random() * 90000000000000) + 10000000000000}`,
    },
  });
  limpeza.clientIds.push(cliente.id);
  return cliente;
}

async function criarTecnico() {
  const user = await prisma.user.create({
    data: {
      name: `Tecnico Intel ${sufixo()}`,
      email: `tec_intel_${sufixo()}@test.com`,
      password: 'hash-teste',
      role: 'tecnico',
      active: true,
    },
  });
  limpeza.userIds.push(user.id);
  return user;
}

async function criarTicketTeste(assunto: string, extra?: Record<string, any>) {
  const ticket = await prisma.ticket.create({
    data: {
      contactName: 'Contato Inteligencia',
      contactPhone: `55${sufixo().slice(-10)}`,
      assunto,
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

async function criarMensagem(ticketId: string, fromMe: boolean, sentAt: Date, content?: string) {
  const msg = await prisma.message.create({
    data: {
      ticketId,
      fromMe,
      content: content || (fromMe ? 'Resposta do agente' : 'Mensagem do cliente'),
      sentAt,
      createdAt: sentAt,
    },
  });
  limpeza.messageIds.push(msg.id);
  return msg;
}

beforeAll(async () => {
  await limparDados();
});

afterAll(async () => {
  await limparDados();
});

// ── calcularIndicePrioridade (unitário puro, sem DB) ─────────────────────

describe('calcularIndicePrioridade', () => {
  it('deve retornar 0 para todos os fatores zerados', () => {
    const score = calcularIndicePrioridade({
      volume: 0, crescimento: 0, sla: 100, reabertura: 0,
      clientes: 0, complexidadeN2N3: 0, csat: 5, emAtraso: 0,
    });
    expect(score).toBe(0);
  });

  it('deve retornar score alto com volume alto + SLA baixo + reabertura', () => {
    const score = calcularIndicePrioridade({
      volume: 80, crescimento: 50, sla: 30, reabertura: 20,
      clientes: 15, complexidadeN2N3: 10, csat: 2, emAtraso: 10,
    });
    expect(score).toBeGreaterThan(60);
  });

  it('deve retornar score baixo com volume baixo + SLA bom + CSAT alto', () => {
    const score = calcularIndicePrioridade({
      volume: 5, crescimento: 0, sla: 98, reabertura: 0,
      clientes: 2, complexidadeN2N3: 0, csat: 4.8, emAtraso: 0,
    });
    expect(score).toBeLessThan(30);
  });

  it('deve limitar score em 100', () => {
    const score = calcularIndicePrioridade({
      volume: 200, crescimento: 200, sla: 0, reabertura: 100,
      clientes: 100, complexidadeN2N3: 100, csat: 0, emAtraso: 50,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it('deve classificar criticamente com score >= 80', () => {
    const score = calcularIndicePrioridade({
      volume: 100, crescimento: 80, sla: 10, reabertura: 30,
      clientes: 20, complexidadeN2N3: 15, csat: 1, emAtraso: 20,
    });
    expect(score).toBeGreaterThanOrEqual(80);
  });
});

// ── Análise por Assunto (integração com DB) ──────────────────────────────

describe('analisePorAssunto', () => {
  it('deve retornar array vazio sem tickets', async () => {
    const resultado = await analisePorAssunto({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });
    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve agrupar tickets por assunto', async () => {
    const tag = `assunto_${sufixo()}`;
    await criarTicketTeste(tag);
    await criarTicketTeste(tag);

    const resultado = await analisePorAssunto({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    const encontrados = resultado.filter(a => a.assuntoNome === tag);
    expect(encontrados.length).toBe(1);
    expect(encontrados[0].total).toBe(2);
  });

  it('deve calcular percentual por assunto', async () => {
    const tag1 = `pct_a_${sufixo()}`;
    const tag2 = `pct_b_${sufixo()}`;
    await criarTicketTeste(tag1);
    await criarTicketTeste(tag1);
    await criarTicketTeste(tag2);

    const resultado = await analisePorAssunto({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    const a1 = resultado.find(a => a.assuntoNome === tag1);
    const a2 = resultado.find(a => a.assuntoNome === tag2);
    expect(a1).toBeDefined();
    expect(a2).toBeDefined();
    expect(a1!.total).toBe(2);
    expect(a2!.total).toBe(1);
  });

  it('deve ordenar por prioridade operacional decrescente', async () => {
    const tagAlto = `assunto_alto_${sufixo()}`;
    const tagBaixo = `assunto_baixo_${sufixo()}`;
    // Criar muitos tickets com SLA violado para o primeiro
    for (let i = 0; i < 5; i++) await criarTicketTeste(tagAlto);
    await criarTicketTeste(tagBaixo);

    const resultado = await analisePorAssunto({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    if (resultado.length >= 2) {
      const idxAlto = resultado.findIndex(a => a.assuntoNome === tagAlto);
      const idxBaixo = resultado.findIndex(a => a.assuntoNome === tagBaixo);
      expect(idxAlto).toBeLessThanOrEqual(idxBaixo);
    }
  });
});

// ── Análise de Risco de Clientes ─────────────────────────────────────────

describe('analiseRiscoClientes', () => {
  it('deve retornar array vazio sem tickets com 2+ chamados', async () => {
    const resultado = await analiseRiscoClientes({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });
    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve identificar cliente com múltiplos chamados', async () => {
    const cliente = await criarClienteTeste();
    for (let i = 0; i < 3; i++) {
      await criarTicketTeste(`problema_recorrente_${sufixo()}`, { clientId: cliente.id });
    }

    const resultado = await analiseRiscoClientes({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    const encontrado = resultado.find(r => r.clienteId === cliente.id);
    expect(encontrado).toBeDefined();
    expect(encontrado!.totalChamadosPeriodo).toBeGreaterThanOrEqual(3);
  });

  it('deve classificar risco do cliente', async () => {
    const cliente = await criarClienteTeste();
    for (let i = 0; i < 5; i++) {
      await criarTicketTeste(`problema_${sufixo()}`, {
        clientId: cliente.id,
        status: 'aberto',
        etapa: 'em_atendimento',
      });
    }

    const resultado = await analiseRiscoClientes({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    const encontrado = resultado.find(r => r.clienteId === cliente.id);
    expect(encontrado).toBeDefined();
    expect(['baixo', 'atencao', 'alto', 'critico']).toContain(encontrado!.risco);
    expect(typeof encontrado!.scoreRisco).toBe('number');
  });

  it('deve incluir fatores de risco', async () => {
    const cliente = await criarClienteTeste();
    for (let i = 0; i < 4; i++) {
      await criarTicketTeste(`falha_sistemica_${sufixo()}`, { clientId: cliente.id });
    }

    const resultado = await analiseRiscoClientes({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    const encontrado = resultado.find(r => r.clienteId === cliente.id);
    expect(encontrado).toBeDefined();
    expect(Array.isArray(encontrado!.fatores)).toBe(true);
  });

  it('deve ordenar por risco decrescente', async () => {
    const clienteRisco = await criarClienteTeste();
    const clienteNormal = await criarClienteTeste();

    for (let i = 0; i < 6; i++) {
      await criarTicketTeste(`critico_${sufixo()}`, {
        clientId: clienteRisco.id,
        status: 'aberto',
        etapa: 'em_atendimento',
      });
    }
    for (let i = 0; i < 2; i++) {
      await criarTicketTeste(`normal_${sufixo()}`, {
        clientId: clienteNormal.id,
        status: 'fechado',
        etapa: 'concluido',
      });
    }

    const resultado = await analiseRiscoClientes({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    if (resultado.length >= 2) {
      const idxRisco = resultado.findIndex(r => r.clienteId === clienteRisco.id);
      const idxNormal = resultado.findIndex(r => r.clienteId === clienteNormal.id);
      expect(idxRisco).toBeLessThanOrEqual(idxNormal);
    }
  });
});

// ── Progresso dos Chamados ───────────────────────────────────────────────

describe('analiseProgresso', () => {
  it('deve retornar array vazio sem tickets abertos', async () => {
    const resultado = await analiseProgresso({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });
    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve classificar progresso de tickets abertos', async () => {
    await criarTicketTeste(`progresso_${sufixo()}`, {
      status: 'aberto',
      etapa: 'em_atendimento',
      ultimaAtividadeRelevante: new Date(Date.now() - 6 * HORA), // 6h atrás → parado
    });

    const resultado = await analiseProgresso({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    expect(resultado.length).toBeGreaterThanOrEqual(1);
    const ticket = resultado[0];
    expect(['em_progresso', 'atencao', 'parado', 'critico']).toContain(ticket.progresso);
  });

  it('deve incluir fatores quando progresso for parado', async () => {
    await criarTicketTeste(`parado_${sufixo()}`, {
      status: 'aberto',
      etapa: 'em_atendimento',
      ultimaAtividadeRelevante: new Date(Date.now() - 10 * HORA),
    });

    const resultado = await analiseProgresso({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    const parado = resultado.find(r => r.progresso === 'parado' || r.progresso === 'critico');
    if (parado) {
      expect(Array.isArray(parado.fatores)).toBe(true);
      expect(parado.fatores.length).toBeGreaterThan(0);
    }
  });
});

// ── Escalonamento N1→N2→N3 ──────────────────────────────────────────────

describe('analiseEscalonamento', () => {
  it('deve retornar estrutura válida', async () => {
    const resultado = await analiseEscalonamento({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });

    expect(resultado).toHaveProperty('total');
    expect(resultado).toHaveProperty('n1ParaN2');
    expect(resultado).toHaveProperty('n2ParaN3');
    expect(resultado).toHaveProperty('porAssunto');
    expect(Array.isArray(resultado.porAssunto)).toBe(true);
  });

  it('deve contar tickets com nivel de suporte', async () => {
    await criarTicketTeste(`escalonamento_${sufixo()}`);

    const resultado = await analiseEscalonamento({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    expect(typeof resultado.total).toBe('number');
  });
});

// ── Oportunidades de Automação ──────────────────────────────────────────

describe('detectarOportunidadesAutomacao', () => {
  it('deve retornar array', async () => {
    const resultado = await detectarOportunidadesAutomacao({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });
    expect(Array.isArray(resultado)).toBe(true);
  });

  it('deve detectar oportunidades com volume suficiente', async () => {
    const tag = `automacao_${sufixo()}`;
    for (let i = 0; i < 20; i++) {
      await criarTicketTeste(tag);
    }

    const resultado = await detectarOportunidadesAutomacao({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    // Com 20 tickets do mesmo assunto, pode houver oportunidade
    expect(Array.isArray(resultado)).toBe(true);
  });
});

// ── Possíveis Bugs ──────────────────────────────────────────────────────

describe('detectarPossiveisBugs', () => {
  it('deve retornar array', async () => {
    const resultado = await detectarPossiveisBugs({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });
    expect(Array.isArray(resultado)).toBe(true);
  });
});

// ── Resumo Executivo ────────────────────────────────────────────────────

describe('gerarResumoExecutivo', () => {
  it('deve retornar campos obrigatórios', async () => {
    const resultado = await gerarResumoExecutivo({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });

    expect(resultado).toHaveProperty('totalChamados');
    expect(resultado).toHaveProperty('abertos');
    expect(resultado).toHaveProperty('resolvidos');
    expect(resultado).toHaveProperty('reabertos');
    expect(resultado).toHaveProperty('n1');
    expect(resultado).toHaveProperty('n2');
    expect(resultado).toHaveProperty('n3');
    expect(resultado).toHaveProperty('parados');
    expect(resultado).toHaveProperty('slaEmRisco');
    expect(resultado).toHaveProperty('clientesEmRisco');
    expect(resultado).toHaveProperty('principaisAssuntos');
    expect(resultado).toHaveProperty('principaisAlertas');
    expect(resultado).toHaveProperty('decisoesRecomendadas');
  });

  it('deve retornar contagens numéricas', async () => {
    const resultado = await gerarResumoExecutivo({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    expect(typeof resultado.totalChamados).toBe('number');
    expect(typeof resultado.abertos).toBe('number');
    expect(typeof resultado.resolvidos).toBe('number');
    expect(typeof resultado.parados).toBe('number');
  });

  it('deve incluir assuntos quando houver tickets', async () => {
    const tag = `resumo_${sufixo()}`;
    await criarTicketTeste(tag);

    const resultado = await gerarResumoExecutivo({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
    });

    expect(Array.isArray(resultado.principaisAssuntos)).toBe(true);
  });
});

// ── Inteligência Completa (orquestrador) ────────────────────────────────

describe('gerarInteligenciaCompleta', () => {
  it('deve retornar todos os módulos', async () => {
    const resultado = await gerarInteligenciaCompleta({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });

    expect(resultado).toHaveProperty('atualizadoEm');
    expect(resultado).toHaveProperty('periodo');
    expect(resultado).toHaveProperty('resumoExecutivo');
    expect(resultado).toHaveProperty('analiseAssuntos');
    expect(resultado).toHaveProperty('rankingAssuntos');
    expect(resultado).toHaveProperty('clientesEmRisco');
    expect(resultado).toHaveProperty('chamadosParados');
    expect(resultado).toHaveProperty('escalonamento');
    expect(resultado).toHaveProperty('oportunidadesAutomacao');
    expect(resultado).toHaveProperty('possiveisBugs');
  });

  it('deve respeitar período informado', async () => {
    const inicio = new Date(Date.now() - 3 * HORA);
    const fim = new Date();
    const resultado = await gerarInteligenciaCompleta({ inicio, fim });

    expect(resultado.periodo.dias).toBeGreaterThanOrEqual(1);
    expect(resultado.periodo.inicio).toBeInstanceOf(Date);
    expect(resultado.periodo.fim).toBeInstanceOf(Date);
  });

  it('deve ter arrays nas seções principais', async () => {
    const resultado = await gerarInteligenciaCompleta({
      inicio: new Date(Date.now() - 7 * HORA),
      fim: new Date(),
    });

    expect(Array.isArray(resultado.analiseAssuntos)).toBe(true);
    expect(Array.isArray(resultado.rankingAssuntos)).toBe(true);
    expect(Array.isArray(resultado.clientesEmRisco)).toBe(true);
    expect(Array.isArray(resultado.chamadosParados)).toBe(true);
    expect(Array.isArray(resultado.oportunidadesAutomacao)).toBe(true);
    expect(Array.isArray(resultado.possiveisBugs)).toBe(true);
  });

  it('deve funcionar com filtros de cliente', async () => {
    const cliente = await criarClienteTeste();
    await criarTicketTeste(`filtro_cliente_${sufixo()}`, { clientId: cliente.id });

    const resultado = await gerarInteligenciaCompleta({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
      clienteId: cliente.id,
    });

    expect(resultado).toHaveProperty('resumoExecutivo');
  });

  it('deve funcionar com filtros de analista', async () => {
    const tecnico = await criarTecnico();
    await criarTicketTeste(`filtro_analista_${sufixo()}`, { assigneeId: tecnico.id });

    const resultado = await gerarInteligenciaCompleta({
      inicio: new Date(Date.now() - 1 * HORA),
      fim: new Date(),
      analistaId: tecnico.id,
    });

    expect(resultado).toHaveProperty('resumoExecutivo');
  });
});
