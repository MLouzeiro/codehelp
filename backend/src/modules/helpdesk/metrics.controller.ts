import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getDashboardMetrics } from './metrics.service';
import { canViewDashboard } from '../auth/rbac';

export async function getMetrics(req: AuthRequest, res: Response) {
  try {
    if (!canViewDashboard(req.user?.role)) {
      return res.status(403).json({ error: 'Acesso nao autorizado' });
    }
    const { dataInicio, dataFim } = req.query;
    const metrics = await getDashboardMetrics(
      dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim ? new Date(dataFim as string) : undefined
    );
    return res.json(metrics);
  } catch (error) {
    console.error('Erro ao buscar metricas:', error);
    return res.status(500).json({ error: 'Erro ao buscar metricas' });
  }
}
