import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../shared/middleware/auth';
import {
  startTimer, stopTimer, getRunningTimer,
  pauseTimer, resumeTimer,
  createEntry, updateEntry, deleteEntry,
  listEntries, getSummary, syncOrderHours,
  getConsumptionByClient, getTicketTimeBlocks,
  getTaskTimeSummary, adjustTime,
} from './timetracking.controller';

const router = Router();
router.use(authenticate);

// ── Timer ────────────────────────────────────────────────────────────
router.post('/start', startTimer);
router.post('/:id/stop', stopTimer);
router.post('/:id/pause', pauseTimer);
router.post('/:id/resume', resumeTimer);
router.get('/running', getRunningTimer);

// ── Task time ────────────────────────────────────────────────────────
router.get('/task/:tarefaId/summary', getTaskTimeSummary);
router.post('/:id/adjust', authorizeMaster, adjustTime);

// ── CRUD ─────────────────────────────────────────────────────────────
router.get('/', listEntries);
router.post('/', createEntry);
router.put('/:id', updateEntry);
router.delete('/:id', authorizeMaster, deleteEntry);

// ── Summary / Dashboard ──────────────────────────────────────────────
router.get('/summary', getSummary);

// ── Sync order hours ─────────────────────────────────────────────────
router.post('/sync-order/:orderId', syncOrderHours);

// ── Relatorio / Timeline ─────────────────────────────────────────────
router.get('/consumption/client', getConsumptionByClient);
router.get('/ticket/:ticketId/blocks', getTicketTimeBlocks);

export default router;
