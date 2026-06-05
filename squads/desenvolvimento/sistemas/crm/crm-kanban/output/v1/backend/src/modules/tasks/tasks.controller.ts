import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export async function listTasks(req: AuthRequest, res: Response) {
  try {
    const { status, assigneeId, project, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (project) where.project = project;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { assignee: { select: { id: true, name: true } } },
        skip,
        take: parseInt(limit as string),
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.task.count({ where }),
    ]);
    return res.json({ tasks, total });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar tarefas' });
  }
}

export async function createTask(req: AuthRequest, res: Response) {
  try {
    const { title, description, priority, assigneeId, project, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const maxOrdem = await prisma.task.aggregate({ _max: { order: true } });
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'media',
        assigneeId: assigneeId || req.user?.id,
        project,
        dueDate: dueDate ? new Date(dueDate) : null,
        order: (maxOrdem._max.order || 0) + 1,
      },
    });
    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
}

export async function updateTask(req: AuthRequest, res: Response) {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        ...(req.body.status === 'concluida' ? {} : {}),
      },
    });
    return res.json(task);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
}

export async function deleteTask(req: AuthRequest, res: Response) {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao deletar tarefa' });
  }
}

export async function reorderTasks(req: AuthRequest, res: Response) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Lista de tarefas inválida' });

    await prisma.$transaction(
      items.map((item: { id: string; order: number; status: string }) =>
        prisma.task.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.status ? { status: item.status } : {}),
          },
        })
      )
    );

    return res.json({ message: 'Ordem atualizada' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao reordenar tarefas' });
  }
}

export async function getKanbanBoard(req: AuthRequest, res: Response) {
  try {
    const { project, assigneeId } = req.query;
    const where: any = {};
    if (project) where.project = project;
    if (assigneeId) where.assigneeId = assigneeId;

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: { order: 'asc' },
    });

    const board = {
      aberta: { title: 'A fazer', items: tasks.filter((t) => t.status === 'aberta') },
      em_andamento: { title: 'Em andamento', items: tasks.filter((t) => t.status === 'em_andamento') },
      concluida: { title: 'Concluído', items: tasks.filter((t) => t.status === 'concluida') },
      cancelada: { title: 'Cancelado', items: tasks.filter((t) => t.status === 'cancelada') },
    };

    return res.json(board);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar kanban' });
  }
}
