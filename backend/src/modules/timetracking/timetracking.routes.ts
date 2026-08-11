import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../shared/middleware/auth';
import {
  startTimer, stopTimer, getRunningTimer,
  createEntry, updateEntry, deleteEntry,
  listEntries, getSummary, syncOrderHours,
} from './timetracking.controller';

const router = Router();
router.use(authenticate);

// ── Timer ────────────────────────────────────────────────────────────
router.post('/start', startTimer);
router.post('/:id/stop', stopTimer);
router.get('/running', getRunningTimer);

// ── CRUD ─────────────────────────────────────────────────────────────
router.get('/', listEntries);
router.post('/', createEntry);
router.put('/:id', updateEntry);
router.delete('/:id', authorizeMaster, deleteEntry);

// ── Summary / Dashboard ──────────────────────────────────────────────
router.get('/summary', getSummary);

// ── Sync order hours ─────────────────────────────────────────────────
router.post('/sync-order/:orderId', syncOrderHours);

export default router;
