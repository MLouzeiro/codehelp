import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../config/database';
import { criarTarefaDeRecomendacao } from '../modules/ai/auditoriaDecisao.service';
import { AppError } from '../shared/errors/AppError';

let boardId = '';
let columnId = '';
let ticketId = '';
let auditId = '';

const random = Math.random().toString(36).slice(2, 10);

beforeAll(async () => {
  const board = await prisma.kanbanBoard.create({
    data: { nome: `Board Recomendacao ${random}`, descricao: 'board de teste' },
  });
  boardId = board.id;
  const column = await prisma.kanbanColumn.create({
    data: { boardId, nome: 'A Fazer', ordem: 0 },
  });
  columnId = column.id;

  const ticket = await prisma.ticket.create({
    data: {
      externalId: `rec-${random}`,
      contactName: 'Cliente Recomendacao',
      contactPhone: '85999998888',
      status: 'aberto',
      etapa: 'em_atendimento',
      canal: 'whatsapp_baileys',
    },
  });
  ticketId = ticket.id;

  const audit = await prisma.auditoriaProfissional.create({
    data: {
      ticketId: ticket.id,
      contactName: 'Cliente Recomendacao',
      status: 'ANALISADO',
      notaGeral: 40,
      notaComunicacao: 40,
      notaResolucao: 40,
      classificacao: 'CRITICO',
      classificacaoResolucao: 'NAO_RESOLVIDO',
      classificacaoEncerramento: 'INADEQUADO',
    },
  });
  auditId = audit.id;
});

afterAll(async () => {
  await prisma.kanbanTask.deleteMany({ where: { boardId } });
  await prisma.kanbanColumn.deleteMany({ where: { boardId } });
  await prisma.kanbanBoard.deleteMany({ where: { id: boardId } });
  if (auditId) await prisma.auditoriaProfissional.deleteMany({ where: { id: auditId } });
  if (ticketId) {
    await prisma.message.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
});

describe('criarTarefaDeRecomendacao', () => {
  it('cria uma tarefa no kanban a partir de uma recomendação real', async () => {
    const result = await criarTarefaDeRecomendacao('nota-geral', boardId);
    expect(result.id).toBeTruthy();
    expect(result.titulo).toBeTruthy();

    const task = await prisma.kanbanTask.findUnique({
      where: { id: result.id },
      select: { id: true, titulo: true, boardId: true, columnId: true, tipoTarefa: true, prioridade: true },
    });
    expect(task).toBeTruthy();
    expect(task!.boardId).toBe(boardId);
    expect(task!.columnId).toBe(columnId);
    expect(task!.tipoTarefa).toBe('atendimento');
  });

  it('rejeita recomendação inexistente com 404', async () => {
    await expect(criarTarefaDeRecomendacao('nao-existe', boardId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejeita board inexistente com 404', async () => {
    await expect(criarTarefaDeRecomendacao('nota-geral', 'board-inexistente')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});