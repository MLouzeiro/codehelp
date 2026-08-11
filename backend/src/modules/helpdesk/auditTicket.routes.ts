import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { requireTicketAccess } from '../../shared/middleware/ticketAccess';
import {
  createEvent,
  listEvents,
  addTimeline,
  closeTimeline,
  listTimeline,
  getMetrics,
  recalculateMetrics,
  createSlaLog,
  listSlaLogs,
  createActivity,
  listActivities,
  startWaiting,
  endWaiting,
  listWaitTimes,
  createAiLog,
  listAiLogs,
  getReplay,
  exportData,
  getPerformance,
} from './auditTicket.controller';

const router = Router();

// Todas as rotas requerem autenticacao
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════
// ── EVENTS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.post(
  '/tickets/:ticketId/events',
  requireTicketAccess('edit'),
  createEvent
);

router.get(
  '/tickets/:ticketId/events',
  requireTicketAccess('view'),
  listEvents
);

// ══════════════════════════════════════════════════════════════════
// ── TIMELINE ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.post(
  '/tickets/:ticketId/timeline',
  requireTicketAccess('edit'),
  addTimeline
);

router.patch(
  '/tickets/:ticketId/timeline/close',
  requireTicketAccess('edit'),
  closeTimeline
);

router.get(
  '/tickets/:ticketId/timeline',
  requireTicketAccess('view'),
  listTimeline
);

// ══════════════════════════════════════════════════════════════════
// ── METRICS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.get(
  '/tickets/:ticketId/metrics',
  requireTicketAccess('view'),
  getMetrics
);

router.post(
  '/tickets/:ticketId/metrics/recalculate',
  requireTicketAccess('edit'),
  recalculateMetrics
);

// ══════════════════════════════════════════════════════════════════
// ── SLA LOGS ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.post(
  '/tickets/:ticketId/sla',
  requireTicketAccess('edit'),
  createSlaLog
);

router.get(
  '/tickets/:ticketId/sla',
  requireTicketAccess('view'),
  listSlaLogs
);

// ══════════════════════════════════════════════════════════════════
// ── ACTIVITY ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.post(
  '/tickets/:ticketId/activity',
  requireTicketAccess('edit'),
  createActivity
);

router.get(
  '/tickets/:ticketId/activity',
  requireTicketAccess('view'),
  listActivities
);

// ══════════════════════════════════════════════════════════════════
// ── WAIT TIMES ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.post(
  '/tickets/:ticketId/wait/start',
  requireTicketAccess('edit'),
  startWaiting
);

router.post(
  '/tickets/:ticketId/wait/end',
  requireTicketAccess('edit'),
  endWaiting
);

router.get(
  '/tickets/:ticketId/wait',
  requireTicketAccess('view'),
  listWaitTimes
);

// ══════════════════════════════════════════════════════════════════
// ── AI LOGS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.post(
  '/tickets/:ticketId/ai-logs',
  requireTicketAccess('edit'),
  createAiLog
);

router.get(
  '/tickets/:ticketId/ai-logs',
  requireTicketAccess('view'),
  listAiLogs
);

// ══════════════════════════════════════════════════════════════════
// ── REPLAY / EXPORT ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.get(
  '/tickets/:ticketId/replay',
  requireTicketAccess('view'),
  getReplay
);

router.get(
  '/tickets/:ticketId/export',
  requireTicketAccess('view'),
  exportData
);

// ══════════════════════════════════════════════════════════════════
// ── PERFORMANCE ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

router.get(
  '/performance',
  getPerformance
);

export default router;
