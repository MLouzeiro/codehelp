import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { listTaskAlerts, marcarAlertaLida, contarAlertasNaoLidas, verificarAlertas } from './taskAlert.service';

export async function listAlerts(req: AuthRequest, res: Response) {
  try {
    const q = req.query as Record<string, string>;
    const alerts = await listTaskAlerts({
      lida: q.lida !== undefined ? q.lida === 'true' : undefined,
      tipo: q.tipo,
      taskId: q.taskId,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return res.json(alerts);
  } catch (error) {
    console.error('Erro ao listar alertas:', error);
    return res.status(500).json({ error: 'Erro ao listar alertas' });
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const total = await contarAlertasNaoLidas();
    return res.json({ total });
  } catch (error) {
    console.error('Erro ao contar alertas:', error);
    return res.status(500).json({ error: 'Erro ao contar alertas' });
  }
}

export async function markAlertRead(req: AuthRequest, res: Response) {
  try {
    const alert = await marcarAlertaLida(req.params.alertaId);
    return res.json(alert);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erro ao marcar alerta:', error);
    return res.status(500).json({ error: 'Erro ao marcar alerta' });
  }
}

export async function runAlertCheck(req: AuthRequest, res: Response) {
  try {
    const criados = await verificarAlertas();
    return res.json({ criados });
  } catch (error) {
    console.error('Erro ao verificar alertas:', error);
    return res.status(500).json({ error: 'Erro ao verificar alertas' });
  }
}