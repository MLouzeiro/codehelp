import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getDashboard, getInsights, getKpis,
  getTicketsByDepartment, getAvgTimeByQueue, getCsatTrending, getStatusByDay,
  getHelpdeskMetrics, getDashboardExecutivo, getDashboardIaHandler, getVisaoGeral,
  getAlertDetailHandler,
} from './analytics.controller';

const router = Router();
router.use(authenticate);

router.get('/visao-geral', getVisaoGeral);
router.get('/executivo', getDashboardExecutivo);
router.get('/dashboard-ia', authorize('admin', 'gerente'), getDashboardIaHandler);
router.get('/alert-detail', authorize('admin', 'gerente'), getAlertDetailHandler);
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
