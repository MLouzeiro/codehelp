import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import * as channelController from './channel.controller';

const router = Router();

router.use(authenticate);

// ── Types ─────────────────────────────────────────────────────────────
router.get('/types', channelController.getChannelTypes);

// ── CRUD ──────────────────────────────────────────────────────────────
router.get('/', channelController.listChannels);
router.get('/:id', channelController.getChannel);
router.post('/', channelController.createChannel);
router.put('/:id', channelController.updateChannel);
router.patch('/:id/toggle', channelController.toggleChannel);
router.delete('/:id', channelController.deleteChannel);

// ── Stats ─────────────────────────────────────────────────────────────
router.get('/:id/stats', channelController.getChannelStats);

// ── Risk Logs ─────────────────────────────────────────────────────────
router.get('/:id/risks', channelController.getRiskLogs);
router.post('/:id/risks', channelController.createRiskLog);
router.patch('/:id/risks/:logId/resolve', channelController.resolveRiskLog);

// ── By Departamento ───────────────────────────────────────────────────
router.get('/departamento/:departamentoId', channelController.getChannelsByDepartamento);

export default router;
