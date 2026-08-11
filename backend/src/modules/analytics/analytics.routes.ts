import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import {
  getDashboard, getInsights, getKpis,
  getTicketsByDepartment, getAvgTimeByQueue, getCsatTrending, getStatusByDay,
  getHelpdeskMetrics,
} from './analytics.controller';

const router = Router();
router.use(authenticate);

router.get('/dashboard', getDashboard);
router.get('/insights', getInsights);
router.get('/kpis', getKpis);

// ── Novos endpoints de BI ────────────────────────────────────────────
router.get('/tickets-by-department', getTicketsByDepartment);
router.get('/avg-time-by-queue', getAvgTimeByQueue);
router.get('/csat-trending', getCsatTrending);
router.get('/status-by-day', getStatusByDay);

// ── Métricas de Helpdesk e Implantação ───────────────────────────────
router.get('/helpdesk-metrics', getHelpdeskMetrics);

export default router;
