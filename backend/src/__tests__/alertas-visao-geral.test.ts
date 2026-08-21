import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import prisma from '../config/database';
import { ensureHelpdeskEntities } from '../modules/helpdesk/seed.service';
import { gerarAlertasVisaoGeral } from '../modules/analytics/alertasVisaoGeral.service';

let ticketIds: string[] = [];
let taskIds: string[] = [];

beforeAll(async () => {
  await ensureHelpdeskEntities();
});

afterEach(async () => {
  if (taskIds.length) {
    await prisma.kanbanTask.deleteMany({ where: { id: { in: taskIds } } });
  }
  if (ticketIds.length) {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  ticketIds = [];
  taskIds = [];
});

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

describe('Alertas da Visão Geral', () => {
  it('retorna lista ordenada com níveis válidos', async () => {
    const alertas = await gerarAlertasVisaoGeral(30, resumoOk);
    expect(Array.isArray(alertas)).toBe(true);
    for (const a of alertas) {
      expect(['critico', 'atencao', 'info']).toContain(a.nivel);
      expect(a.titulo).toBeTruthy();
    }
    // Ordenação: críticos antes de atenção antes de info
    const pesos = alertas.map(a => ({ critico: 0, atencao: 1, info: 2 }[a.nivel] ?? 3));
    for (let i = 1; i < pesos.length; i++) expect(pesos[i] >= pesos[i - 1]).toBe(true);
  });

  it('detecta chamado sem movimentação há mais de 72h', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `vg-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente VG',
        contactPhone: '85999997702',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        updatedAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
      },
    });
    ticketIds.push(ticket.id);

    const alertas = await gerarAlertasVisaoGeral(30, resumoOk);
    const alerta = alertas.find(a => a.tipo === 'chamado_sem_movimentacao');
    expect(alerta).toBeDefined();
    expect(alerta!.nivel).toBe('critico');
  });

  it('detecta chamado reaberto via métrica do ticket', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: `vg-re-${Date.now()}-${Math.random()}`,
        contactName: 'Cliente Reaberto',
        contactPhone: '85999997703',
        status: 'aberto',
        etapa: 'em_atendimento',
        canal: 'whatsapp_baileys',
        metrics: { create: { totalReaberturas: 3, slaStatus: 'ok' } },
      },
    });
    ticketIds.push(ticket.id);

    const alertas = await gerarAlertasVisaoGeral(30, resumoOk);
    const alerta = alertas.find(a => a.tipo === 'chamado_reaberto');
    expect(alerta).toBeDefined();
    expect(alerta!.nivel).toBe('atencao');
  });

  it('detecta tarefa atrasada do kanban', async () => {
    const board = await prisma.kanbanBoard.create({ data: { nome: `VG-Board-${Date.now()}` } });
    const column = await prisma.kanbanColumn.create({
      data: { nome: 'Em andamento', boardId: board.id },
    });
    const task = await prisma.kanbanTask.create({
      data: {
        titulo: 'Tarefa VG atrasada',
        boardId: board.id,
        columnId: column.id,
        statusPrazo: 'atrasada',
        prazoEntrega: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    taskIds.push(task.id);

    const alertas = await gerarAlertasVisaoGeral(30, resumoOk);
    const alerta = alertas.find(a => a.tipo === 'tarefa_atrasada');
    expect(alerta).toBeDefined();
    expect(alerta!.nivel).toBe('critico');
  });

  it('detecta tarefa sem responsável', async () => {
    const board = await prisma.kanbanBoard.create({ data: { nome: `VG-Board2-${Date.now()}` } });
    const column = await prisma.kanbanColumn.create({
      data: { nome: 'Para fazer', boardId: board.id },
    });
    const task = await prisma.kanbanTask.create({
      data: { titulo: 'Tarefa VG sem responsável', boardId: board.id, columnId: column.id, statusPrazo: 'no_prazo' },
    });
    taskIds.push(task.id);

    const alertas = await gerarAlertasVisaoGeral(30, resumoOk);
    const alerta = alertas.find(a => a.tipo === 'tarefa_sem_responsavel');
    expect(alerta).toBeDefined();
  });

  it('detecta desenvolvimento atrasado por tipo de tarefa', async () => {
    const board = await prisma.kanbanBoard.create({ data: { nome: `VG-Board3-${Date.now()}` } });
    const column = await prisma.kanbanColumn.create({
      data: { nome: 'Em andamento', boardId: board.id },
    });
    const task = await prisma.kanbanTask.create({
      data: {
        titulo: 'Dev atrasado VG',
        boardId: board.id,
        columnId: column.id,
        tipoTarefa: 'dev',
        statusPrazo: 'atrasada',
      },
    });
    taskIds.push(task.id);

    const alertas = await gerarAlertasVisaoGeral(30, resumoOk);
    const alerta = alertas.find(a => a.tipo === 'dev_atrasado');
    expect(alerta).toBeDefined();
    expect(alerta!.nivel).toBe('critico');
  });

  it('não quebra sem dados', async () => {
    const alertas = await gerarAlertasVisaoGeral(7, resumoOk);
    expect(Array.isArray(alertas)).toBe(true);
  });
});