import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getTaskDashboard, listTasksForReport, exportTasksCsv, exportTasksExcel } from './taskReport.service';

export async function getTaskDashboardHandler(req: AuthRequest, res: Response) {
  try {
    const q = req.query as Record<string, string>;
    const dashboard = await getTaskDashboard({
      boardId: q.boardId,
      responsavelId: q.responsavelId,
      equipeId: q.equipeId,
      departamentoId: q.departamentoId,
      clientId: q.clientId,
      ticketId: q.ticketId,
      statusPrazo: q.statusPrazo,
      tipoTarefa: q.tipoTarefa,
    });
    return res.json(dashboard);
  } catch (error) {
    console.error('Erro ao buscar dashboard de tarefas:', error);
    return res.status(500).json({ error: 'Erro ao buscar dashboard de tarefas' });
  }
}

export async function getTaskReportHandler(req: AuthRequest, res: Response) {
  try {
    const q = req.query as Record<string, string>;
    const tasks = await listTasksForReport({
      boardId: q.boardId,
      responsavelId: q.responsavelId,
      equipeId: q.equipeId,
      departamentoId: q.departamentoId,
      clientId: q.clientId,
      ticketId: q.ticketId,
      statusPrazo: q.statusPrazo,
      tipoTarefa: q.tipoTarefa,
      arquivado: q.arquivado ? q.arquivado === 'true' : undefined,
    });
    return res.json({ total: tasks.length, tasks });
  } catch (error) {
    console.error('Erro ao gerar relatório de tarefas:', error);
    return res.status(500).json({ error: 'Erro ao gerar relatório de tarefas' });
  }
}

export async function exportTaskReport(req: AuthRequest, res: Response) {
  try {
    const q = req.query as Record<string, string>;
    const tasks = await listTasksForReport({
      boardId: q.boardId,
      responsavelId: q.responsavelId,
      equipeId: q.equipeId,
      departamentoId: q.departamentoId,
      clientId: q.clientId,
      ticketId: q.ticketId,
      statusPrazo: q.statusPrazo,
      tipoTarefa: q.tipoTarefa,
      arquivado: q.arquivado ? q.arquivado === 'true' : undefined,
    });

    const formato = q.formato === 'xlsx' ? 'xlsx' : 'csv';

    if (formato === 'xlsx') {
      const buffer = await exportTasksExcel(tasks);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="tarefas-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.send(buffer);
    }

    const csv = exportTasksCsv(tasks);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tarefas-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar relatório de tarefas:', error);
    return res.status(500).json({ error: 'Erro ao exportar relatório de tarefas' });
  }
}