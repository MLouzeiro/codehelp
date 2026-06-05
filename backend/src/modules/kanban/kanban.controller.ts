import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';

export async function listTasks(req: AuthRequest, res: Response) {
  try {
    const { status, responsavelId, projeto, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (responsavelId) where.responsavelId = responsavelId;
    if (projeto) where.projeto = projeto;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { responsavel: { select: { name: true } } },
        skip,
        take: parseInt(limit as string),
        orderBy: [{ ordem: 'asc' }, { createdAt: 'desc' }],
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
    const { titulo, descricao, prioridade, responsavelId, projeto, sprint, dataVencimento } = req.body;
    if (!titulo) return res.status(400).json({ error: 'Título é obrigatório' });

    const maxOrdem = await prisma.task.aggregate({ _max: { ordem: true } });
    const task = await prisma.task.create({
      data: {
        titulo,
        descricao,
        prioridade: prioridade || 'media',
        responsavelId: responsavelId || req.user?.id,
        projeto,
        sprint,
        dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
        ordem: (maxOrdem._max.ordem || 0) + 1,
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
        ...(req.body.status === 'concluida' ? { dataConclusao: new Date() } : {}),
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
      items.map((item: { id: string; ordem: number; status: string }) =>
        prisma.task.update({
          where: { id: item.id },
          data: {
            ordem: item.ordem,
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

export async function getKanban(req: AuthRequest, res: Response) {
  try {
    const { projeto, responsavelId } = req.query;
    const where: any = {};
    if (projeto) where.projeto = projeto;
    if (responsavelId) where.responsavelId = responsavelId;

    const tasks = await prisma.task.findMany({
      where,
      include: { responsavel: { select: { id: true, name: true } } },
      orderBy: { ordem: 'asc' },
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
