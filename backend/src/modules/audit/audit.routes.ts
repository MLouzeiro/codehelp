import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  listAuditLogs, getTicketAuditLogs, getAuditStatsHandler,
  getGlobalAudit, getGlobalAuditStats, getAuditByUser, getTaskAuditLogs,
  getOrderAuditLogs, getClientAuditLogs,
  getSecurityHandler, getAnomaliasHandler,
  getAlertsHandler, getAlertStatsHandler, marcarAlertaHandler, arquivarAlertaHandler,
  getExportFiltersHandler, exportAuditCsvHandler,
  getViolationStatsHandler,
} from './audit.controller';

const router = Router();
router.use(authenticate);

const adminOrManager = authorize('admin', 'gerente', 'supervisor');

router.get('/', adminOrManager, listAuditLogs);
router.get('/global', adminOrManager, getGlobalAudit);
router.get('/global/stats', adminOrManager, getGlobalAuditStats);
router.get('/global/usuario/:userId', adminOrManager, getAuditByUser);
router.get('/stats', adminOrManager, getAuditStatsHandler);
router.get('/ticket/:ticketId', adminOrManager, getTicketAuditLogs);
router.get('/task/:taskId', adminOrManager, getTaskAuditLogs);
router.get('/order/:orderId', adminOrManager, getOrderAuditLogs);
router.get('/client/:clientId', adminOrManager, getClientAuditLogs);

router.get('/security', adminOrManager, getSecurityHandler);
router.get('/anomalias', adminOrManager, getAnomaliasHandler);

router.get('/alerts', adminOrManager, getAlertsHandler);
router.get('/alerts/stats', adminOrManager, getAlertStatsHandler);
router.patch('/alerts/:alertId/analyze', adminOrManager, marcarAlertaHandler);
router.patch('/alerts/:alertId/archive', adminOrManager, arquivarAlertaHandler);

router.get('/export/filters', adminOrManager, getExportFiltersHandler);
router.get('/export/csv', adminOrManager, exportAuditCsvHandler);

router.get('/violations', adminOrManager, getViolationStatsHandler);

export default router;
