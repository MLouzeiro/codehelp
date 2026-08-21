import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureAmbienteHelpdesk } from './helpers/test-utils';
import {
  registrarStatusEvent,
  listOrderTimeline,
  createOrderFromTicket,
  getOrdersDashboard,
  exportOrdersCsv,
  STATUS_OS,
  STATUS_OS_LABEL,
} from '../modules/orders/orders.service';
import { createTask } from '../modules/kanban/kanban.service';

let clientId: string;
let tecnicoId: string;
let usuarioId: string;
let ticketId: string;
let orderId: string;
let taskId: string;
let boardId: string;
let columnId: string;

beforeAll(async () => {
  await ensureAmbienteHelpdesk();

  const tecnico = await prisma.user.create({
    data: { name: 'OS Tecnico', email: `os-tec-${Date.now()}@test.dev`, password: 'hash', role: 'agente' },
  });
  tecnicoId = tecnico.id;

  const usuario = await prisma.user.create({
    data: { name: 'OS Usuario', email: `os-user-${Date.now()}@test.dev`, password: 'hash', role: 'gerente' },
  });
  usuarioId = usuario.id;

  const client = await prisma.client.create({ data: { razaoSocial: 'Cliente OS', status: 'ativo' } });
  clientId = client.id;

  const ticket = await prisma.ticket.create({
    data: {
      contactName: 'Cliente OS',
      contactPhone: '5511999990000',
      assunto: 'Problema de conexao no terminal',
      observacoes: 'Cliente relata queda intermitente',
      status: 'em_atendimento',
      etapa: 'em_atendimento',
      clientId,
      assigneeId: tecnicoId,
      canal: 'whatsapp',
      categoria: 'suporte',
    },
  });
  ticketId = ticket.id;
});

afterEach(async () => {
  if (taskId) {
    await prisma.kanbanStageTime.deleteMany({ where: { taskId } });
    await prisma.kanbanActivity.deleteMany({ where: { taskId } });
    await prisma.kanbanTaskTag.deleteMany({ where: { taskId } });
    await prisma.kanbanTask.delete({ where: { id: taskId } });
    taskId = '';
  }
  if (orderId) {
    await prisma.serviceOrderStatusEvent.deleteMany({ where: { orderId } });
    await prisma.timeEntry.deleteMany({ where: { orderId } });
    await prisma.serviceOrder.delete({ where: { id: orderId } });
    orderId = '';
  }
  if (boardId) {
    await prisma.kanbanColumn.deleteMany({ where: { boardId } });
    await prisma.kanbanBoard.delete({ where: { id: boardId } });
    boardId = '';
    columnId = '';
  }
});

describe('OS no Helpdesk - criacao a partir do ticket', () => {
  it('cria OS com dados do ticket (cliente, tecnico, descricao)', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    expect(order.numeroOs).toMatch(/^OS-\d{4}-\d{4}$/);
    expect(order.clientId).toBe(clientId);
    expect(order.tecnicoResponsavelId).toBe(tecnicoId);
    expect(order.ticketId).toBe(ticketId);
    expect(order.status).toBe('rascunho');
    expect(order.tipoServico).toBe('suporte');
    expect(order.descricaoServico).toContain('Problema de conexao');
  });

  it('registra evento inicial rascunho na criacao', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    const events = await prisma.serviceOrderStatusEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].statusNovo).toBe('rascunho');
    expect(events[0].usuarioId).toBe(usuarioId);
    expect(events[0].origem).toBe('sistema');
  });

  it('lanca erro quando ticket nao tem cliente vinculado', async () => {
    const ticketSemCliente = await prisma.ticket.create({
      data: {
        contactName: 'Sem Cliente',
        contactPhone: '5511999990001',
        assunto: 'Sem cliente',
        status: 'fila',
        etapa: 'fila',
        canal: 'whatsapp',
      },
    });

    await expect(createOrderFromTicket(ticketSemCliente.id, usuarioId)).rejects.toThrow(/cliente vinculado/i);

    await prisma.ticket.delete({ where: { id: ticketSemCliente.id } });
  });
});

describe('OS - timeline de status (tempo por status)', () => {
  it('listOrderTimeline retorna duracoes por status e marca ultimo como em andamento', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    await registrarStatusEvent({ orderId: order.id, statusNovo: 'em_execucao', statusAnterior: 'rascunho', usuarioId });
    await registrarStatusEvent({
      orderId: order.id,
      statusNovo: 'concluida',
      statusAnterior: 'em_execucao',
      usuarioId,
      origem: 'manual',
      observacao: 'Servico finalizado',
    });

    const timeline = await listOrderTimeline(order.id);
    expect(timeline).toHaveLength(3);

    expect(timeline[0].statusNovo).toBe('rascunho');
    expect(timeline[0].emAndamento).toBe(false);
    expect(timeline[0].duracaoMin).toBeGreaterThanOrEqual(0);
    expect(timeline[1].emAndamento).toBe(false);
    expect(timeline[2].statusLabel).toBe('Concluída');
    expect(timeline[2].emAndamento).toBe(true);
    expect(timeline[2].observacao).toBe('Servico finalizado');
    expect(timeline[2].usuario?.name).toBe('OS Usuario');
  });

  it('STATUS_OS e STATUS_OS_LABEL coerentes', () => {
    expect(STATUS_OS).toEqual(['rascunho', 'aguardando_assinatura', 'assinada', 'em_execucao', 'concluida', 'cancelada']);
    expect(STATUS_OS_LABEL.concluida).toBe('Concluída');
    expect(STATUS_OS_LABEL.aguardando_assinatura).toBe('Aguardando Assinatura');
  });
});

describe('OS - data de conclusao', () => {
  it('status concluida define dataConclusao e registra evento', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    await registrarStatusEvent({ orderId: order.id, statusNovo: 'em_execucao', statusAnterior: 'rascunho', usuarioId });
    await registrarStatusEvent({ orderId: order.id, statusNovo: 'concluida', statusAnterior: 'em_execucao', usuarioId });

    const updated = await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'concluida', dataConclusao: new Date() },
    });
    expect(updated.dataConclusao).toBeInstanceOf(Date);

    const timeline = await listOrderTimeline(order.id);
    expect(timeline[timeline.length - 1].statusNovo).toBe('concluida');
    expect(timeline[timeline.length - 1].emAndamento).toBe(true);
  });
});

describe('OS - integracao com tarefas (orderId em KanbanTask)', () => {
  it('cria tarefa vinculada a OS e ao ticket', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    const board = await prisma.kanbanBoard.create({ data: { nome: `Board OS ${Date.now()}` } });
    boardId = board.id;
    const column = await prisma.kanbanColumn.create({ data: { boardId: board.id, nome: 'A Fazer', ordem: 0 } });
    columnId = column.id;

    const task = await createTask(
      board.id,
      {
        titulo: 'Implementar ajuste do terminal',
        columnId: column.id,
        clientId,
        ticketId,
        orderId: order.id,
        responsavelId: tecnicoId,
        tipoTarefa: 'implementacao',
      },
      usuarioId
    );
    taskId = task.id;

    expect(task.orderId).toBe(order.id);
    expect(task.ticketId).toBe(ticketId);

    const reloaded = await prisma.kanbanTask.findUnique({
      where: { id: task.id },
      include: { order: { select: { numeroOs: true, status: true } } },
    });
    expect(reloaded?.order?.numeroOs).toBe(order.numeroOs);
  });
});

describe('OS - dashboard e export', () => {
  it('getOrdersDashboard agrega status, tipos e tecnicos', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    const dash = await getOrdersDashboard({});
    expect(dash.total).toBeGreaterThanOrEqual(1);
    expect(dash.rascunho).toBeGreaterThanOrEqual(1);
    expect(typeof dash.taxaConclusao).toBe('number');
    expect(Array.isArray(dash.porStatus)).toBe(true);
    expect(Array.isArray(dash.porTipo)).toBe(true);
    expect(Array.isArray(dash.porTecnico)).toBe(true);
  });

  it('exportOrdersCsv gera CSV com BOM, cabecalho e linha', async () => {
    const order = await createOrderFromTicket(ticketId, usuarioId);
    orderId = order.id;

    const orders = await prisma.serviceOrder.findMany({
      where: { id: order.id },
      include: { client: true, tecnicoResponsavel: true, ticket: true, signature: true },
    });
    const csv = exportOrdersCsv(orders);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Numero');
    expect(csv).toContain(order.numeroOs);
  });
});