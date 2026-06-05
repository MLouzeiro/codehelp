import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export async function getKpis(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const isVendedor = req.user!.role === 'vendedor';

    const clientFilter = isVendedor ? { sellerId: userId } : {};
    const taskFilter = isVendedor ? { assigneeId: userId } : {};

    const [totalClients, tasksPendentes, tasksConcluidas] = await Promise.all([
      prisma.client.count({ where: clientFilter }),
      prisma.task.count({ where: { ...taskFilter, status: { in: ['aberta', 'em_andamento'] } } }),
      prisma.task.count({ where: { ...taskFilter, status: 'concluida' } }),
    ]);

    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      _count: true,
      where: taskFilter,
    });

    const tasksByPerid = await prisma.task.findMany({
      where: {
        ...taskFilter,
        createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const tasksPerDay: Record<string, { total: number; concluidas: number }> = {};
    tasksByPerid.forEach((t) => {
      const day = t.createdAt.toISOString().split('T')[0];
      if (!tasksPerDay[day]) tasksPerDay[day] = { total: 0, concluidas: 0 };
      tasksPerDay[day].total++;
      if (t.status === 'concluida') tasksPerDay[day].concluidas++;
    });

    return res.json({
      cards: { totalClients, tasksPendentes, tasksConcluidas },
      charts: {
        tasksByStatus,
        tasksPerDay: Object.entries(tasksPerDay).map(([date, data]) => ({ date, ...data })),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar KPIs' });
  }
}
