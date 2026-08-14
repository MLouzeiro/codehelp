import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import {
  startTimer,
  stopTimer,
  createManualEntry,
  getConsumptionByClient,
  getTicketTimeBlocks,
  categorizarTipo,
  inferirTipoDeDepartamento,
} from '../modules/timetracking/timetracking.service';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';

let userId: string;
let clientId: string;
let ticketId: string;

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (ticketId) {
    await prisma.timeEntry.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
  if (clientId) {
    await prisma.client.deleteMany({ where: { id: clientId } });
  }
});

describe('Time Tracking — unitário (categorias)', () => {
  it('mapeia tipos gravados para categorias canonicas', () => {
    expect(categorizarTipo('dev')).toBe('desenvolvimento');
    expect(categorizarTipo('desenvolvimento')).toBe('desenvolvimento');
    expect(categorizarTipo('implantacao')).toBe('implantacao');
    expect(categorizarTipo('suporte')).toBe('atendimento');
    expect(categorizarTipo('treinamento')).toBe('atendimento');
    expect(categorizarTipo('atendimento')).toBe('atendimento');
    expect(categorizarTipo('reuniao')).toBe('atendimento');
    expect(categorizarTipo('xpto')).toBe('outro');
  });

  it('infere tipo a partir do departamento', () => {
    expect(inferirTipoDeDepartamento('dev')).toBe('dev');
    expect(inferirTipoDeDepartamento('desenvolvimento')).toBe('dev');
    expect(inferirTipoDeDepartamento('implantacao')).toBe('implantacao');
    expect(inferirTipoDeDepartamento('treinamento')).toBe('treinamento');
    expect(inferirTipoDeDepartamento('suporte')).toBe('suporte');
    expect(inferirTipoDeDepartamento(undefined)).toBe('suporte');
  });
});

describe('Time Tracking — integração', () => {
  it('timer start/stop grava duracao e vincula ticket/cliente/tarefa/setor', async () => {
    const client = await prisma.client.create({
      data: { razaoSocial: 'Cliente TT', status: 'ativo' },
    });
    clientId = client.id;

    const user = await prisma.user.create({
      data: {
        name: 'Analista TT',
        email: `tt-${Date.now()}@test.dev`,
        password: 'hash',
        role: 'agente',
      },
    });
    userId = user.id;

    const ticket = await prisma.ticket.create({
      data: {
        externalId: `tt-${Date.now()}-${Math.random()}`,
        contactName: 'Contato TT',
        contactPhone: '85999990090',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        clientId: client.id,
        assigneeId: user.id,
      },
    });
    ticketId = ticket.id;

    const task = await prisma.kanbanTask.create({
      data: {
        numero: 1,
        titulo: 'Tarefa TT',
        columnId: (await prisma.kanbanColumn.findFirstOrThrow()).id,
        boardId: (await prisma.kanbanBoard.findFirstOrThrow()).id,
        ticketId: ticket.id,
        responsavelId: user.id,
        clientId: client.id,
      },
    });

    const entry = await startTimer({
      usuarioId: user.id,
      ticketId: ticket.id,
      tarefaId: task.id,
      clienteId: client.id,
      setorId: null as any,
      tipo: 'dev',
      descricao: 'Tarefa: TT',
      tags: ['auto'],
    });

    expect(entry.ticketId).toBe(ticket.id);
    expect(entry.tarefaId).toBe(task.id);
    expect(entry.clienteId).toBe(client.id);
    expect(entry.dataFim).toBeNull();

    const stopped = await stopTimer(entry.id);
    expect(stopped.dataFim).toBeInstanceOf(Date);
    expect(stopped.duracaoMin).toBeGreaterThanOrEqual(0);

    const blocks = await getTicketTimeBlocks(ticket.id);
    expect(blocks.length).toBe(1);
    expect(blocks[0].tarefa?.titulo).toBe('Tarefa TT');
    expect(blocks[0].usuario).toBe('Analista TT');
  });

  it('relatorio de consumo agrupa por cliente e categoria', async () => {
    const client = await prisma.client.create({
      data: { razaoSocial: 'Consumo SA', status: 'ativo' },
    });
    clientId = client.id;

    const user = await prisma.user.create({
      data: {
        name: 'Analista Consumo',
        email: `ttc-${Date.now()}@test.dev`,
        password: 'hash',
        role: 'agente',
      },
    });
    userId = user.id;

    const ticket = await prisma.ticket.create({
      data: {
        externalId: `ttc-${Date.now()}-${Math.random()}`,
        contactName: 'Contato Consumo',
        contactPhone: '85999990091',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        clientId: client.id,
        assigneeId: user.id,
      },
    });
    ticketId = ticket.id;

    await createManualEntry({
      usuarioId: user.id,
      ticketId: ticket.id,
      clienteId: client.id,
      tipo: 'dev',
      descricao: 'dev 60',
      duracaoMin: 60,
    });
    await createManualEntry({
      usuarioId: user.id,
      ticketId: ticket.id,
      clienteId: client.id,
      tipo: 'suporte',
      descricao: 'suporte 30',
      duracaoMin: 30,
    });
    await createManualEntry({
      usuarioId: user.id,
      ticketId: ticket.id,
      clienteId: client.id,
      tipo: 'implantacao',
      descricao: 'impl 120',
      duracaoMin: 120,
    });

    const consumo = await getConsumptionByClient({});
    const linha = consumo.find((c) => c.id === client.id);
    expect(linha).toBeDefined();
    expect(linha?.desenvolvimentoMin).toBe(60);
    expect(linha?.atendimentoMin).toBe(30);
    expect(linha?.implantacaoMin).toBe(120);
    expect(linha?.totalMin).toBe(210);
    expect(linha?.entradas).toBe(3);
  });
});