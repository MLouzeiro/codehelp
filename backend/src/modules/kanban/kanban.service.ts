import prisma from '../../config/database';
import path from 'path';
import fs from 'fs';

export interface BoardCreateInput {
  nome: string;
  descricao?: string | null;
  icone?: string | null;
  cor?: string | null;
  criadorId?: string | null;
  templateId?: string | null;
  columns?: ColumnCreateInput[];
}

export interface BoardUpdateInput {
  nome?: string;
  descricao?: string | null;
  icone?: string | null;
  cor?: string | null;
  ativo?: boolean;
}

export interface ColumnCreateInput {
  nome: string;
  cor?: string | null;
  icone?: string | null;
  ordem?: number;
  wipLimit?: number | null;
}

export interface ColumnUpdateInput {
  nome?: string;
  cor?: string | null;
  icone?: string | null;
  ordem?: number;
  wipLimit?: number | null;
  hidden?: boolean;
}

export interface TaskCreateInput {
  titulo: string;
  descricao?: string | null;
  columnId: string;
  responsavelId?: string | null;
  clientId?: string | null;
  ticketId?: string | null;
  prioridade?: string;
  categoria?: string | null;
  classificacao?: string | null;
  dataInicio?: Date | null;
  prazoEntrega?: Date | null;
  estimativaHoras?: number | null;
  tags?: string[];
}

export interface TaskUpdateInput {
  titulo?: string;
  descricao?: string | null;
  responsavelId?: string | null;
  clientId?: string | null;
  ticketId?: string | null;
  prioridade?: string;
  categoria?: string | null;
  classificacao?: string | null;
  dataInicio?: Date | null;
  prazoEntrega?: Date | null;
  dataConclusao?: Date | null;
  estimativaHoras?: number | null;
  horasTrabalhadas?: number | null;
  ativo?: boolean;
  tags?: string[];
}

export interface SubtaskCreateInput {
  titulo: string;
  responsavelId?: string | null;
}

const DEFAULT_COLUMNS: ColumnCreateInput[] = [
  { nome: 'A Fazer', cor: '#6b7280', icone: 'circle', ordem: 0 },
  { nome: 'Em Andamento', cor: '#3b82f6', icone: 'play', ordem: 1 },
  { nome: 'Aguardando', cor: '#f59e0b', icone: 'clock', ordem: 2 },
  { nome: 'Concluído', cor: '#10b981', icone: 'check-circle', ordem: 3 },
];

export async function listBoards(userId: string, userRole: string) {
  try {
    if (userRole === 'tecnico') {
      const boardsWithTasks = await prisma.kanbanBoard.findMany({
        where: {
          ativo: true,
          OR: [
            { criadorId: userId },
            { tasks: { some: { responsavelId: userId } } },
          ],
        },
        include: {
          _count: {
            select: { columns: true, tasks: { where: { ativo: true } } },
          },
        },
        orderBy: { ordem: 'asc' },
      });
      return boardsWithTasks.map((b) => ({
        id: b.id,
        nome: b.nome,
        descricao: b.descricao,
        icone: b.icone,
        cor: b.cor,
        ordem: b.ordem,
        criadorId: b.criadorId,
        ativo: b.ativo,
        templateId: b.templateId,
        columnCount: b._count.columns,
        taskCount: b._count.tasks,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }));
    }

    const boards = await prisma.kanbanBoard.findMany({
      where: { ativo: true },
      include: {
        _count: {
          select: { columns: true, tasks: { where: { ativo: true } } },
        },
      },
      orderBy: { ordem: 'asc' },
    });
    return boards.map((b) => ({
      id: b.id,
      nome: b.nome,
      descricao: b.descricao,
      icone: b.icone,
      cor: b.cor,
      ordem: b.ordem,
      criadorId: b.criadorId,
      ativo: b.ativo,
      templateId: b.templateId,
      columnCount: b._count.columns,
      taskCount: b._count.tasks,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  } catch (error: any) {
    throw new Error(`Erro ao listar boards: ${error.message}`);
  }
}

export async function getBoard(boardId: string) {
  try {
    const board = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          orderBy: { ordem: 'asc' },
          include: {
            tasks: {
              where: { ativo: true },
              orderBy: { ordem: 'asc' },
              include: {
                responsavel: { select: { id: true, name: true, email: true } },
                tags: { include: { tag: true } },
                client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
                subtasks: {
                  orderBy: { ordem: 'asc' },
                  select: { id: true, titulo: true, concluida: true, ordem: true },
                },
                attachments: {
                  orderBy: { createdAt: 'desc' },
                  select: { id: true, nomeArquivo: true, url: true, tipoMime: true, tamanho: true, createdAt: true },
                },
                _count: { select: { subtasks: true } },
                activities: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { createdAt: true },
                },
              },
            },
          },
        },
        tags: { orderBy: { nome: 'asc' } },
      },
    });
    if (!board) throw new Error('Board nao encontrado');
    return board;
  } catch (error: any) {
    throw new Error(`Erro ao buscar board: ${error.message}`);
  }
}

export async function createBoard(data: BoardCreateInput) {
  try {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('Nome do board e obrigatorio');
    }

    const columnsData = data.columns && data.columns.length > 0
      ? data.columns.map((col, idx) => ({
          nome: col.nome,
          cor: col.cor ?? '#6b7280',
          icone: col.icone ?? null,
          ordem: col.ordem ?? idx,
          wipLimit: col.wipLimit ?? null,
        }))
      : DEFAULT_COLUMNS.map((col) => ({
          nome: col.nome,
          cor: col.cor!,
          icone: col.icone!,
          ordem: col.ordem!,
          wipLimit: null,
        }));

    const board = await prisma.kanbanBoard.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao ?? null,
        icone: data.icone ?? 'layout',
        cor: data.cor ?? '#3b82f6',
        criadorId: data.criadorId ?? null,
        templateId: data.templateId ?? null,
        columns: { create: columnsData },
      },
      include: { columns: { orderBy: { ordem: 'asc' } } },
    });

    return board;
  } catch (error: any) {
    throw new Error(`Erro ao criar board: ${error.message}`);
  }
}

export async function updateBoard(boardId: string, data: BoardUpdateInput) {
  try {
    const existing = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!existing) throw new Error('Board nao encontrado');

    const updateData: any = {};
    if (data.nome !== undefined) updateData.nome = data.nome.trim();
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.icone !== undefined) updateData.icone = data.icone;
    if (data.cor !== undefined) updateData.cor = data.cor;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    return prisma.kanbanBoard.update({
      where: { id: boardId },
      data: updateData,
    });
  } catch (error: any) {
    throw new Error(`Erro ao atualizar board: ${error.message}`);
  }
}

export async function deleteBoard(boardId: string) {
  try {
    const existing = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!existing) throw new Error('Board nao encontrado');

    await prisma.kanbanBoard.update({
      where: { id: boardId },
      data: { ativo: false },
    });

    return true;
  } catch (error: any) {
    throw new Error(`Erro ao deletar board: ${error.message}`);
  }
}

export async function createColumn(boardId: string, data: ColumnCreateInput) {
  try {
    const board = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) throw new Error('Board nao encontrado');

    if (!data.nome || !data.nome.trim()) {
      throw new Error('Nome da coluna e obrigatorio');
    }

    const maxOrdem = await prisma.kanbanColumn.aggregate({
      where: { boardId },
      _max: { ordem: true },
    });

    const nextOrdem = (maxOrdem._max.ordem ?? -1) + 1;

    return prisma.kanbanColumn.create({
      data: {
        boardId,
        nome: data.nome.trim(),
        cor: data.cor ?? '#6b7280',
        icone: data.icone ?? null,
        ordem: data.ordem ?? nextOrdem,
        wipLimit: data.wipLimit ?? null,
      },
    });
  } catch (error: any) {
    throw new Error(`Erro ao criar coluna: ${error.message}`);
  }
}

export async function updateColumn(columnId: string, data: ColumnUpdateInput) {
  try {
    const existing = await prisma.kanbanColumn.findUnique({
      where: { id: columnId },
      select: { id: true },
    });
    if (!existing) throw new Error('Coluna não encontrada');

    const updateData: any = {};
    if (data.nome !== undefined) updateData.nome = data.nome.trim();
    if (data.cor !== undefined) updateData.cor = data.cor;
    if (data.icone !== undefined) updateData.icone = data.icone;
    if (data.wipLimit !== undefined) updateData.wipLimit = data.wipLimit;
    if (data.ordem !== undefined) updateData.ordem = data.ordem;
    if (data.hidden !== undefined) updateData.hidden = data.hidden;

    return prisma.kanbanColumn.update({
      where: { id: columnId },
      data: updateData,
    });
  } catch (error: any) {
    throw new Error(`Erro ao atualizar coluna: ${error.message}`);
  }
}

export async function deleteColumn(columnId: string) {
  try {
    const column = await prisma.kanbanColumn.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });
    if (!column) throw new Error('Coluna nao encontrada');

    const taskCount = await prisma.kanbanTask.count({
      where: { columnId, ativo: true },
    });

    if (taskCount > 0) {
      const firstColumn = await prisma.kanbanColumn.findFirst({
        where: { boardId: column.boardId, NOT: { id: columnId } },
        orderBy: { ordem: 'asc' },
      });

      if (firstColumn) {
        await prisma.kanbanTask.updateMany({
          where: { columnId },
          data: { columnId: firstColumn.id },
        });
      }
    }

    await prisma.kanbanColumn.delete({ where: { id: columnId } });
    return true;
  } catch (error: any) {
    throw new Error(`Erro ao deletar coluna: ${error.message}`);
  }
}

export async function reorderColumns(boardId: string, columnIds: string[]) {
  try {
    const board = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) throw new Error('Board nao encontrado');

    const updates = columnIds.map((colId, idx) =>
      prisma.kanbanColumn.update({
        where: { id: colId },
        data: { ordem: idx },
      })
    );

    await prisma.$transaction(updates);
    return true;
  } catch (error: any) {
    throw new Error(`Erro ao reordenar colunas: ${error.message}`);
  }
}

export async function createTask(boardId: string, data: TaskCreateInput) {
  try {
    const board = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) throw new Error('Board nao encontrado');

    const column = await prisma.kanbanColumn.findUnique({
      where: { id: data.columnId },
      select: { id: true, boardId: true },
    });
    if (!column) throw new Error('Coluna nao encontrada');
    if (column.boardId !== boardId) throw new Error('Coluna nao pertence a este board');

    if (!data.titulo || !data.titulo.trim()) {
      throw new Error('Titulo da tarefa e obrigatorio');
    }

    const maxNumero = await prisma.kanbanTask.aggregate({
      where: { boardId },
      _max: { numero: true },
    });

    const nextNumero = (maxNumero._max.numero ?? 0) + 1;

    const maxOrdem = await prisma.kanbanTask.aggregate({
      where: { columnId: data.columnId },
      _max: { ordem: true },
    });

    const nextOrdem = (maxOrdem._max.ordem ?? -1) + 1;

    const tagsConnect = data.tags?.map((tagId) => ({
      tag: { connect: { id: tagId } },
    })) ?? [];

    const task = await prisma.kanbanTask.create({
      data: {
        boardId,
        columnId: data.columnId,
        numero: nextNumero,
        titulo: data.titulo.trim(),
        descricao: data.descricao ?? null,
        responsavelId: data.responsavelId ?? null,
        clientId: data.clientId ?? null,
        ticketId: data.ticketId ?? null,
        prioridade: data.prioridade ?? 'media',
        categoria: data.categoria ?? null,
        classificacao: data.classificacao ?? null,
        dataInicio: data.dataInicio ?? null,
        prazoEntrega: data.prazoEntrega ?? null,
        estimativaHoras: data.estimativaHoras ?? null,
        ordem: nextOrdem,
        tags: tagsConnect.length > 0 ? { create: tagsConnect } : undefined,
      },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
      },
    });

    await prisma.kanbanActivity.create({
      data: {
        taskId: task.id,
        usuarioId: data.responsavelId ?? null,
        tipo: 'criou',
        descricao: `Tarefa #${task.numero} criada`,
      },
    });

    return task;
  } catch (error: any) {
    throw new Error(`Erro ao criar tarefa: ${error.message}`);
  }
}

export async function getTask(taskId: string) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
        subtasks: {
          orderBy: { ordem: 'asc' },
          include: {
            responsavel: { select: { id: true, name: true, email: true } },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: { select: { id: true, name: true, email: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: { select: { id: true, name: true } },
          },
        },
        column: true,
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
    });
    if (!task) throw new Error('Tarefa nao encontrada');
    return task;
  } catch (error: any) {
    throw new Error(`Erro ao buscar tarefa: ${error.message}`);
  }
}

export async function updateTask(taskId: string, data: TaskUpdateInput) {
  try {
    const existing = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true, boardId: true, titulo: true, numero: true },
    });
    if (!existing) throw new Error('Tarefa nao encontrada');

    const updateData: any = {};
    if (data.titulo !== undefined) updateData.titulo = data.titulo.trim();
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.responsavelId !== undefined) updateData.responsavelId = data.responsavelId;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.ticketId !== undefined) updateData.ticketId = data.ticketId;
    if (data.prioridade !== undefined) updateData.prioridade = data.prioridade;
    if (data.categoria !== undefined) updateData.categoria = data.categoria;
    if (data.classificacao !== undefined) updateData.classificacao = data.classificacao;
    if (data.dataInicio !== undefined) updateData.dataInicio = data.dataInicio;
    if (data.prazoEntrega !== undefined) updateData.prazoEntrega = data.prazoEntrega;
    if (data.dataConclusao !== undefined) updateData.dataConclusao = data.dataConclusao;
    if (data.estimativaHoras !== undefined) updateData.estimativaHoras = data.estimativaHoras;
    if (data.horasTrabalhadas !== undefined) updateData.horasTrabalhadas = data.horasTrabalhadas;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    if (data.tags !== undefined) {
      await prisma.kanbanTaskTag.deleteMany({ where: { taskId } });
      if (data.tags.length > 0) {
        const tagsConnect = data.tags.map((tagId) => ({
          taskId,
          tagId,
        }));
        await prisma.kanbanTaskTag.createMany({ data: tagsConnect });
      }
    }

    const task = await prisma.kanbanTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
      },
    });

    await prisma.kanbanActivity.create({
      data: {
        taskId,
        usuarioId: data.responsavelId ?? null,
        tipo: 'editou',
        descricao: `Tarefa #${existing.numero} editada`,
      },
    });

    return task;
  } catch (error: any) {
    throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
  }
}

export async function deleteTask(taskId: string) {
  try {
    const existing = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!existing) throw new Error('Tarefa nao encontrada');

    await prisma.kanbanTask.update({
      where: { id: taskId },
      data: { ativo: false },
    });

    return true;
  } catch (error: any) {
    throw new Error(`Erro ao deletar tarefa: ${error.message}`);
  }
}

export async function moveTask(taskId: string, targetColumnId: string, targetOrdem?: number) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true, columnId: true, ordem: true, boardId: true, numero: true },
    });
    if (!task) throw new Error('Tarefa nao encontrada');

    const targetColumn = await prisma.kanbanColumn.findUnique({
      where: { id: targetColumnId },
      select: { id: true, boardId: true },
    });
    if (!targetColumn) throw new Error('Coluna de destino nao encontrada');
    if (targetColumn.boardId !== task.boardId) throw new Error('Coluna de destino nao pertence ao mesmo board');

    const sourceColumn = await prisma.kanbanColumn.findUnique({
      where: { id: task.columnId },
      select: { nome: true },
    });
    const destColumn = await prisma.kanbanColumn.findUnique({
      where: { id: targetColumnId },
      select: { nome: true },
    });

    let newOrdem: number;
    if (targetOrdem !== undefined) {
      newOrdem = targetOrdem;
    } else {
      const maxOrdem = await prisma.kanbanTask.aggregate({
        where: { columnId: targetColumnId, NOT: { id: taskId } },
        _max: { ordem: true },
      });
      newOrdem = (maxOrdem._max.ordem ?? -1) + 1;
    }

    const updated = await prisma.kanbanTask.update({
      where: { id: taskId },
      data: {
        columnId: targetColumnId,
        ordem: newOrdem,
      },
    });

    await prisma.kanbanActivity.create({
      data: {
        taskId,
        tipo: 'moveu',
        descricao: `Tarefa #${task.numero} movida`,
        deColuna: sourceColumn?.nome ?? null,
        paraColuna: destColumn?.nome ?? null,
      },
    });

    return updated;
  } catch (error: any) {
    throw new Error(`Erro ao mover tarefa: ${error.message}`);
  }
}

export async function reorderTasks(columnId: string, taskIds: string[]) {
  try {
    const column = await prisma.kanbanColumn.findUnique({
      where: { id: columnId },
      select: { id: true },
    });
    if (!column) throw new Error('Coluna nao encontrada');

    const updates = taskIds.map((tId, idx) =>
      prisma.kanbanTask.update({
        where: { id: tId },
        data: { ordem: idx },
      })
    );

    await prisma.$transaction(updates);
    return true;
  } catch (error: any) {
    throw new Error(`Erro ao reordenar tarefas: ${error.message}`);
  }
}

export async function createSubtask(taskId: string, data: SubtaskCreateInput) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true, numero: true },
    });
    if (!task) throw new Error('Tarefa nao encontrada');

    if (!data.titulo || !data.titulo.trim()) {
      throw new Error('Titulo da subtarefa e obrigatorio');
    }

    const maxOrdem = await prisma.kanbanSubtask.aggregate({
      where: { taskId },
      _max: { ordem: true },
    });

    const nextOrdem = (maxOrdem._max.ordem ?? -1) + 1;

    const subtask = await prisma.kanbanSubtask.create({
      data: {
        taskId,
        titulo: data.titulo.trim(),
        responsavelId: data.responsavelId ?? null,
        ordem: nextOrdem,
      },
    });

    await prisma.kanbanActivity.create({
      data: {
        taskId,
        usuarioId: data.responsavelId ?? null,
        tipo: 'adicionou_subtarefa',
        descricao: `Subtarefa "${data.titulo.trim()}" adicionada`,
      },
    });

    return subtask;
  } catch (error: any) {
    throw new Error(`Erro ao criar subtarefa: ${error.message}`);
  }
}

export async function toggleSubtask(subtaskId: string) {
  try {
    const subtask = await prisma.kanbanSubtask.findUnique({
      where: { id: subtaskId },
      select: { id: true, taskId: true, titulo: true, concluida: true },
    });
    if (!subtask) throw new Error('Subtarefa nao encontrada');

    const updated = await prisma.kanbanSubtask.update({
      where: { id: subtaskId },
      data: { concluida: !subtask.concluida },
    });

    const status = updated.concluida ? 'concluida' : 'reaberta';

    await prisma.kanbanActivity.create({
      data: {
        taskId: subtask.taskId,
        tipo: 'subtarefa_toggled',
        descricao: `Subtarefa "${subtask.titulo}" ${status}`,
      },
    });

    return updated;
  } catch (error: any) {
    throw new Error(`Erro ao alternar subtarefa: ${error.message}`);
  }
}

export async function deleteSubtask(subtaskId: string) {
  try {
    const subtask = await prisma.kanbanSubtask.findUnique({
      where: { id: subtaskId },
      select: { id: true },
    });
    if (!subtask) throw new Error('Subtarefa nao encontrada');

    await prisma.kanbanSubtask.delete({ where: { id: subtaskId } });
    return true;
  } catch (error: any) {
    throw new Error(`Erro ao deletar subtarefa: ${error.message}`);
  }
}

export async function addComment(taskId: string, usuarioId: string, texto: string) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true, numero: true },
    });
    if (!task) throw new Error('Tarefa nao encontrada');

    if (!texto || !texto.trim()) {
      throw new Error('Texto do comentario e obrigatorio');
    }

    const activity = await prisma.kanbanActivity.create({
      data: {
        taskId,
        usuarioId,
        tipo: 'comentou',
        descricao: texto.trim(),
      },
      include: {
        usuario: { select: { id: true, name: true, email: true } },
      },
    });

    return activity;
  } catch (error: any) {
    throw new Error(`Erro ao adicionar comentario: ${error.message}`);
  }
}

export async function getActivityLog(taskId: string) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) throw new Error('Tarefa nao encontrada');

    return prisma.kanbanActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (error: any) {
    throw new Error(`Erro ao buscar log de atividades: ${error.message}`);
  }
}

export async function listTemplates() {
  try {
    return prisma.kanbanTemplate.findMany({
      where: { publico: true },
      orderBy: { nome: 'asc' },
    });
  } catch (error: any) {
    throw new Error(`Erro ao listar templates: ${error.message}`);
  }
}

export async function createBoardFromTemplate(
  templateId: string,
  userId: string,
  boardName?: string,
) {
  try {
    const template = await prisma.kanbanTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new Error('Template nao encontrado');

    const colunas: ColumnCreateInput[] = JSON.parse(template.colunas || '[]');
    const tags: { nome: string; cor: string }[] = JSON.parse(template.tagsPadrao || '[]');

    const board = await prisma.kanbanBoard.create({
      data: {
        nome: boardName ?? `${template.nome} - ${new Date().toLocaleDateString('pt-BR')}`,
        descricao: template.descricao ?? null,
        icone: template.icone ?? 'layout',
        cor: '#3b82f6',
        criadorId: userId,
        templateId: template.id,
        columns: {
          create: colunas.map((col, idx) => ({
            nome: col.nome,
            cor: col.cor ?? '#6b7280',
            icone: col.icone ?? null,
            ordem: col.ordem ?? idx,
            wipLimit: col.wipLimit ?? null,
          })),
        },
      },
      include: { columns: true },
    });

    if (tags.length > 0) {
      await prisma.kanbanTag.createMany({
        data: tags.map((tag) => ({
          nome: tag.nome,
          cor: tag.cor ?? '#6366f1',
          boardId: board.id,
        })),
      });
    }

    return getBoard(board.id);
  } catch (error: any) {
    throw new Error(`Erro ao criar board a partir do template: ${error.message}`);
  }
}

export async function createTemplate(data: {
  nome: string;
  descricao?: string;
  categoria?: string;
  icone?: string;
  colunas: ColumnCreateInput[];
  tagsPadrao?: { nome: string; cor: string }[];
  publico?: boolean;
  criadorId?: string;
}) {
  try {
    if (!data.nome || !data.nome.trim()) {
      throw new Error('Nome do template e obrigatorio');
    }

    return prisma.kanbanTemplate.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao ?? null,
        categoria: data.categoria ?? null,
        icone: data.icone ?? null,
        colunas: JSON.stringify(data.colunas || []),
        tagsPadrao: JSON.stringify(data.tagsPadrao || []),
        publico: data.publico ?? false,
        criadorId: data.criadorId ?? null,
      },
    });
  } catch (error: any) {
    throw new Error(`Erro ao criar template: ${error.message}`);
  }
}

export async function createTag(boardId: string, data: { nome: string; cor?: string }) {
  try {
    const board = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) throw new Error('Board não encontrado');

    if (!data.nome || !data.nome.trim()) {
      throw new Error('Nome da tag é obrigatório');
    }

    // Check if tag already exists for this board
    const existing = await prisma.kanbanTag.findFirst({
      where: {
        boardId,
        nome: data.nome.trim(),
      },
    });
    if (existing) throw new Error('Tag já existe neste board');

    return prisma.kanbanTag.create({
      data: {
        boardId,
        nome: data.nome.trim(),
        cor: data.cor ?? '#6366f1',
      },
    });
  } catch (error: any) {
    throw new Error(`Erro ao criar tag: ${error.message}`);
  }
}

export async function deleteTag(tagId: string) {
  try {
    const tag = await prisma.kanbanTag.findUnique({
      where: { id: tagId },
      select: { id: true },
    });
    if (!tag) throw new Error('Tag não encontrada');

    // Remove all task-tag associations first
    await prisma.kanbanTaskTag.deleteMany({ where: { tagId } });
    await prisma.kanbanTag.delete({ where: { id: tagId } });
    return true;
  } catch (error: any) {
    throw new Error(`Erro ao deletar tag: ${error.message}`);
  }
}

export async function uploadAttachment(taskId: string, files: Express.Multer.File[], usuarioId?: string) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true, numero: true },
    });
    if (!task) throw new Error('Tarefa nao encontrada');

    const attachments = await Promise.all(
      files.map((file) =>
        prisma.kanbanAttachment.create({
          data: {
            taskId,
            nomeArquivo: file.originalname,
            url: `/uploads/kanban/${file.filename}`,
            tipoMime: file.mimetype,
            tamanho: file.size,
            usuarioId: usuarioId ?? null,
          },
        })
      )
    );

    await prisma.kanbanActivity.create({
      data: {
        taskId,
        usuarioId: usuarioId ?? null,
        tipo: 'anexou',
        descricao: `${files.length > 1 ? files.length + ' arquivos anexados' : 'Arquivo anexado'}`,
      },
    });

    return attachments;
  } catch (error: any) {
    throw new Error(`Erro ao enviar anexo: ${error.message}`);
  }
}

export async function deleteAttachment(attachmentId: string) {
  try {
    const attachment = await prisma.kanbanAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, url: true, taskId: true, nomeArquivo: true },
    });
    if (!attachment) throw new Error('Anexo nao encontrado');

    const filePath = path.resolve(__dirname, '../../..', attachment.url);
    try {
      await fs.promises.access(filePath);
      await fs.promises.unlink(filePath);
    } catch {
      // file doesn't exist, ignore
    }

    await prisma.kanbanAttachment.delete({ where: { id: attachmentId } });

    await prisma.kanbanActivity.create({
      data: {
        taskId: attachment.taskId,
        tipo: 'anexou',
        descricao: `Anexo "${attachment.nomeArquivo}" removido`,
      },
    });

    return true;
  } catch (error: any) {
    throw new Error(`Erro ao deletar anexo: ${error.message}`);
  }
}

export async function createTaskFromTicket(boardId: string, ticketId: string, data: {
  titulo?: string;
  columnId?: string;
  responsavelId?: string;
  prioridade?: string;
  descricao?: string;
}) {
  try {
    const board = await prisma.kanbanBoard.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) throw new Error('Board nao encontrado');

    let targetColumnId = data.columnId;
    if (!targetColumnId) {
      const firstColumn = await prisma.kanbanColumn.findFirst({
        where: { boardId },
        orderBy: { ordem: 'asc' },
      });
      if (!firstColumn) throw new Error('Board nao tem colunas');
      targetColumnId = firstColumn.id;
    }

    const maxNumero = await prisma.kanbanTask.aggregate({
      where: { boardId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero ?? 0) + 1;

    const maxOrdem = await prisma.kanbanTask.aggregate({
      where: { columnId: targetColumnId },
      _max: { ordem: true },
    });
    const nextOrdem = (maxOrdem._max.ordem ?? -1) + 1;

    const task = await prisma.kanbanTask.create({
      data: {
        boardId,
        columnId: targetColumnId,
        numero: nextNumero,
        titulo: data.titulo ?? `Ticket #${ticketId.slice(0, 8)}`,
        descricao: data.descricao ?? null,
        responsavelId: data.responsavelId ?? null,
        ticketId,
        prioridade: data.prioridade ?? 'media',
        ordem: nextOrdem,
      },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        _count: { select: { subtasks: true } },
      },
    });

    await prisma.kanbanActivity.create({
      data: {
        taskId: task.id,
        usuarioId: data.responsavelId ?? null,
        tipo: 'criou',
        descricao: `Tarefa #${task.numero} criada a partir do ticket`,
      },
    });

    return task;
  } catch (error: any) {
    throw new Error(`Erro ao criar tarefa do ticket: ${error.message}`);
  }
}

export async function transferTask(taskId: string, targetBoardId: string, targetColumnId?: string) {
  try {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { id: true, boardId: true, numero: true, titulo: true },
    });
    if (!task) throw new Error('Tarefa nao encontrada');

    const targetBoard = await prisma.kanbanBoard.findUnique({
      where: { id: targetBoardId },
      select: { id: true },
    });
    if (!targetBoard) throw new Error('Board de destino nao encontrado');

    let destColumnId = targetColumnId;
    if (!destColumnId) {
      const firstColumn = await prisma.kanbanColumn.findFirst({
        where: { boardId: targetBoardId },
        orderBy: { ordem: 'asc' },
      });
      if (!firstColumn) throw new Error('Board de destino nao tem colunas');
      destColumnId = firstColumn.id;
    }

    const targetColumn = await prisma.kanbanColumn.findUnique({
      where: { id: destColumnId },
      select: { id: true, boardId: true },
    });
    if (!targetColumn) throw new Error('Coluna de destino nao encontrada');
    if (targetColumn.boardId !== targetBoardId) throw new Error('Coluna de destino nao pertence ao board de destino');

    const maxNumero = await prisma.kanbanTask.aggregate({
      where: { boardId: targetBoardId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero ?? 0) + 1;

    const maxOrdem = await prisma.kanbanTask.aggregate({
      where: { columnId: destColumnId },
      _max: { ordem: true },
    });
    const nextOrdem = (maxOrdem._max.ordem ?? -1) + 1;

    const sourceBoard = await prisma.kanbanBoard.findUnique({
      where: { id: task.boardId },
      select: { nome: true },
    });
    const destBoard = await prisma.kanbanBoard.findUnique({
      where: { id: targetBoardId },
      select: { nome: true },
    });

    await prisma.kanbanTaskTag.deleteMany({ where: { taskId } });

    const updated = await prisma.kanbanTask.update({
      where: { id: taskId },
      data: {
        boardId: targetBoardId,
        columnId: destColumnId,
        numero: nextNumero,
        ordem: nextOrdem,
      },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        _count: { select: { subtasks: true } },
      },
    });

    await prisma.kanbanActivity.create({
      data: {
        taskId,
        tipo: 'moveu',
        descricao: `Tarefa transferida de "${sourceBoard?.nome}" para "${destBoard?.nome}"`,
        deColuna: sourceBoard?.nome ?? null,
        paraColuna: destBoard?.nome ?? null,
      },
    });

    return updated;
  } catch (error: any) {
    throw new Error(`Erro ao transferir tarefa: ${error.message}`);
  }
}

export async function duplicateTask(taskId: string, targetColumnId?: string) {
  try {
    const original = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        subtasks: true,
        tags: { include: { tag: true } },
      },
    });
    if (!original) throw new Error('Tarefa nao encontrada');

    const destColumnId = targetColumnId ?? original.columnId;

    const targetColumn = await prisma.kanbanColumn.findUnique({
      where: { id: destColumnId },
      select: { id: true, boardId: true },
    });
    if (!targetColumn) throw new Error('Coluna de destino nao encontrada');

    const maxNumero = await prisma.kanbanTask.aggregate({
      where: { boardId: original.boardId },
      _max: { numero: true },
    });
    const nextNumero = (maxNumero._max.numero ?? 0) + 1;

    const maxOrdem = await prisma.kanbanTask.aggregate({
      where: { columnId: destColumnId },
      _max: { ordem: true },
    });
    const nextOrdem = (maxOrdem._max.ordem ?? -1) + 1;

    const newTask = await prisma.kanbanTask.create({
      data: {
        boardId: original.boardId,
        columnId: destColumnId,
        numero: nextNumero,
        titulo: `${original.titulo} (Copia)`,
        descricao: original.descricao,
        responsavelId: original.responsavelId,
        clientId: original.clientId,
        ticketId: original.ticketId,
        prioridade: original.prioridade,
        categoria: original.categoria,
        classificacao: original.classificacao,
        estimativaHoras: original.estimativaHoras,
        ordem: nextOrdem,
      },
      include: {
        responsavel: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
        client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        _count: { select: { subtasks: true } },
      },
    });

    if (original.subtasks.length > 0) {
      const subtasksData = original.subtasks.map((st, idx) => ({
        taskId: newTask.id,
        titulo: st.titulo,
        concluida: false,
        ordem: idx,
        responsavelId: st.responsavelId,
      }));
      await prisma.kanbanSubtask.createMany({ data: subtasksData });
    }

    const tagIds = original.tags.map(t => t.tagId);
    if (tagIds.length > 0) {
      const targetBoardTags = await prisma.kanbanTag.findMany({
        where: { boardId: original.boardId },
        select: { id: true, nome: true },
      });
      const matchingTags = tagIds.filter(tagId =>
        targetBoardTags.some(bt => bt.id === tagId)
      );
      if (matchingTags.length > 0) {
        await prisma.kanbanTaskTag.createMany({
          data: matchingTags.map(tagId => ({ taskId: newTask.id, tagId })),
        });
      }
    }

    await prisma.kanbanActivity.create({
      data: {
        taskId: newTask.id,
        tipo: 'criou',
        descricao: `Tarefa duplicada de #${original.numero}`,
      },
    });

    return newTask;
  } catch (error: any) {
    throw new Error(`Erro ao duplicar tarefa: ${error.message}`);
  }
}

export async function getLastActivityAt(taskId: string): Promise<Date | null> {
  try {
    const lastActivity = await prisma.kanbanActivity.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return lastActivity?.createdAt ?? null;
  } catch {
    return null;
  }
}
