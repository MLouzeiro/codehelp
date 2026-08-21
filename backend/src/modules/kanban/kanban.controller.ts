import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as service from './kanban.service';
import { autoCategorizeTask, applyCategorization } from './ai-categorize.service';

export async function listBoards(req: AuthRequest, res: Response) {
  try {
    const boards = await service.listBoards(req.user?.id ?? '', req.user?.role ?? '');
    return res.json(boards);
  } catch (error) {
    console.error('Erro ao listar boards:', error);
    return res.status(500).json({ error: 'Erro ao listar boards' });
  }
}

export async function getBoard(req: AuthRequest, res: Response) {
  try {
    const board = await service.getBoard(req.params.boardId);
    return res.json(board);
  } catch (error) {
    console.error('Erro ao buscar board:', error);
    return res.status(500).json({ error: 'Erro ao buscar board' });
  }
}

export async function createBoard(req: AuthRequest, res: Response) {
  try {
    const board = await service.createBoard(req.body);
    return res.status(201).json(board);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar board:', error);
    return res.status(500).json({ error: 'Erro ao criar board' });
  }
}

export async function updateBoard(req: AuthRequest, res: Response) {
  try {
    const board = await service.updateBoard(req.params.boardId, req.body);
    return res.json(board);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao atualizar board:', error);
    return res.status(500).json({ error: 'Erro ao atualizar board' });
  }
}

export async function deleteBoard(req: AuthRequest, res: Response) {
  try {
    await service.deleteBoard(req.params.boardId);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao deletar board:', error);
    return res.status(500).json({ error: 'Erro ao deletar board' });
  }
}

export async function createColumn(req: AuthRequest, res: Response) {
  try {
    const column = await service.createColumn(req.params.boardId, req.body);
    return res.status(201).json(column);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar coluna:', error);
    return res.status(500).json({ error: 'Erro ao criar coluna' });
  }
}

export async function updateColumn(req: AuthRequest, res: Response) {
  try {
    const column = await service.updateColumn(req.params.columnId, req.body);
    return res.json(column);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao atualizar coluna:', error);
    return res.status(500).json({ error: 'Erro ao atualizar coluna' });
  }
}

export async function deleteColumn(req: AuthRequest, res: Response) {
  try {
    await service.deleteColumn(req.params.columnId);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao deletar coluna:', error);
    return res.status(500).json({ error: 'Erro ao deletar coluna' });
  }
}

export async function reorderColumns(req: AuthRequest, res: Response) {
  try {
    const columns = await service.reorderColumns(req.params.boardId, req.body.columnIds);
    return res.json(columns);
  } catch (error: any) {
    if (error.message?.includes('obrigatório') || error.message?.includes('inválida')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao reordenar colunas:', error);
    return res.status(500).json({ error: 'Erro ao reordenar colunas' });
  }
}

export async function createTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.createTask(req.params.boardId, {
      ...req.body,
      responsavelId: req.body.responsavelId || req.user?.id,
    }, req.user?.id ?? null);
    return res.status(201).json(task);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
}

export async function getTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.getTask(req.params.taskId);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao buscar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao buscar tarefa' });
  }
}

export async function updateTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.updateTask(req.params.taskId, req.body, req.user?.id ?? null);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao atualizar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
}

export async function deleteTask(req: AuthRequest, res: Response) {
  try {
    await service.deleteTask(req.params.taskId, req.user?.id ?? null, req.body.motivo);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao deletar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao deletar tarefa' });
  }
}

export async function moveTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.moveTask(req.params.taskId, req.body.targetColumnId, req.body.targetOrdem, req.user?.id ?? null, req.body.motivo);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('obrigatório') || error.message?.includes('não encontrad')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao mover tarefa:', error);
    return res.status(500).json({ error: 'Erro ao mover tarefa' });
  }
}

export async function archiveTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.archiveTask(req.params.taskId, req.user?.id ?? null, req.body.motivo);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrada') || error.message?.includes('já está arquivada')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao arquivar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao arquivar tarefa' });
  }
}

export async function restoreTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.restoreTask(req.params.taskId, req.user?.id ?? null);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrada') || error.message?.includes('não está arquivada')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao restaurar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao restaurar tarefa' });
  }
}

export async function reopenTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.reopenTask(req.params.taskId, req.user?.id ?? null, req.body.motivo);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao reabrir tarefa:', error);
    return res.status(500).json({ error: 'Erro ao reabrir tarefa' });
  }
}

export async function deleteTaskDefinitive(req: AuthRequest, res: Response) {
  try {
    await service.deleteTaskDefinitive(req.params.taskId, req.user?.id ?? null, req.body.motivo);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrada') || error.message?.includes('arquivadas')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao excluir tarefa definitivamente:', error);
    return res.status(500).json({ error: 'Erro ao excluir tarefa definitivamente' });
  }
}

export async function listArchivedTasks(req: AuthRequest, res: Response) {
  try {
    const result = await service.listArchivedTasks({
      busca: req.query.busca as string | undefined,
      responsavelId: req.query.responsavelId as string | undefined,
      clientId: req.query.clientId as string | undefined,
      departamentoId: req.query.departamentoId as string | undefined,
      statusPrazo: req.query.statusPrazo as string | undefined,
      dataArquivadoDe: req.query.dataArquivadoDe as string | undefined,
      dataArquivadoAte: req.query.dataArquivadoAte as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao listar tarefas arquivadas:', error);
    return res.status(500).json({ error: 'Erro ao listar tarefas arquivadas' });
  }
}

export async function reorderTasks(req: AuthRequest, res: Response) {
  try {
    const tasks = await service.reorderTasks(req.params.columnId, req.body.taskIds);
    return res.json(tasks);
  } catch (error: any) {
    if (error.message?.includes('obrigatório') || error.message?.includes('inválida')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao reordenar tarefas:', error);
    return res.status(500).json({ error: 'Erro ao reordenar tarefas' });
  }
}

export async function createSubtask(req: AuthRequest, res: Response) {
  try {
    const subtask = await service.createSubtask(req.params.taskId, req.body);
    return res.status(201).json(subtask);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar subtarefa:', error);
    return res.status(500).json({ error: 'Erro ao criar subtarefa' });
  }
}

export async function toggleSubtask(req: AuthRequest, res: Response) {
  try {
    const subtask = await service.toggleSubtask(req.params.subtaskId);
    return res.json(subtask);
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao alternar subtarefa:', error);
    return res.status(500).json({ error: 'Erro ao alternar subtarefa' });
  }
}

export async function deleteSubtask(req: AuthRequest, res: Response) {
  try {
    await service.deleteSubtask(req.params.subtaskId);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao deletar subtarefa:', error);
    return res.status(500).json({ error: 'Erro ao deletar subtarefa' });
  }
}

export async function addComment(req: AuthRequest, res: Response) {
  try {
    const comment = await service.addComment(req.params.taskId, req.user?.id ?? '', req.body.texto);
    return res.status(201).json(comment);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao adicionar comentário:', error);
    return res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
}

export async function getActivityLog(req: AuthRequest, res: Response) {
  try {
    const log = await service.getActivityLog(req.params.taskId);
    return res.json(log);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}

export async function listTemplates(req: AuthRequest, res: Response) {
  try {
    const templates = await service.listTemplates();
    return res.json(templates);
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    return res.status(500).json({ error: 'Erro ao listar templates' });
  }
}

export async function createBoardFromTemplate(req: AuthRequest, res: Response) {
  try {
    const board = await service.createBoardFromTemplate(
      req.params.templateId,
      req.user?.id ?? '',
      req.body.nome,
    );
    return res.status(201).json(board);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao criar board a partir de template:', error);
    return res.status(500).json({ error: 'Erro ao criar board a partir de template' });
  }
}

export async function createTemplate(req: AuthRequest, res: Response) {
  try {
    const template = await service.createTemplate(req.body);
    return res.status(201).json(template);
  } catch (error: any) {
    if (error.message?.includes('obrigatório')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar template:', error);
    return res.status(500).json({ error: 'Erro ao criar template' });
  }
}

export async function createTag(req: AuthRequest, res: Response) {
  try {
    const tag = await service.createTag(req.params.boardId, req.body);
    return res.status(201).json(tag);
  } catch (error: any) {
    if (error.message?.includes('obrigatório') || error.message?.includes('já existe')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar tag:', error);
    return res.status(500).json({ error: 'Erro ao criar tag' });
  }
}

export async function deleteTag(req: AuthRequest, res: Response) {
  try {
    await service.deleteTag(req.params.tagId);
    return res.status(204).send();
  } catch (error: any) {
    if (error.message?.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao deletar tag:', error);
    return res.status(500).json({ error: 'Erro ao deletar tag' });
  }
}

export async function createTaskFromTicket(req: AuthRequest, res: Response) {
  try {
    const task = await service.createTaskFromTicket(req.params.boardId, req.params.ticketId, {
      ...req.body,
      responsavelId: req.body.responsavelId || req.user?.id,
    });
    return res.status(201).json(task);
  } catch (error: any) {
    if (error.message?.includes('obrigatório') || error.message?.includes('encontrado')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erro ao criar tarefa do ticket:', error);
    return res.status(500).json({ error: 'Erro ao criar tarefa do ticket' });
  }
}

export async function transferTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.transferTask(req.params.taskId, req.body.targetBoardId, req.body.targetColumnId);
    return res.json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrad')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao transferir tarefa:', error);
    return res.status(500).json({ error: 'Erro ao transferir tarefa' });
  }
}

export async function duplicateTask(req: AuthRequest, res: Response) {
  try {
    const task = await service.duplicateTask(req.params.taskId, req.body.targetColumnId);
    return res.status(201).json(task);
  } catch (error: any) {
    if (error.message?.includes('não encontrad')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao duplicar tarefa:', error);
    return res.status(500).json({ error: 'Erro ao duplicar tarefa' });
  }
}

export async function autoCategorize(req: AuthRequest, res: Response) {
  try {
    const { taskId } = req.params;
    const categorization = await autoCategorizeTask(taskId);
    const updated = await applyCategorization(taskId, categorization);
    return res.json({ categorization, task: updated });
  } catch (error: any) {
    if (error.message?.includes('não encontrad')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao auto-categorizar:', error);
    return res.status(500).json({ error: 'Erro ao categorizar com IA' });
  }
}
