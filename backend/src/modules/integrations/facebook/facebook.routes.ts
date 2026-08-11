import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import * as facebookController from './facebook.controller';

const router = Router();

// ── Webhook (no auth required) ────────────────────────────────────────
router.get('/webhook/:channelId', facebookController.verifyWebhook);
router.post('/webhook/:channelId', facebookController.handleWebhook);

// ── Protected routes ──────────────────────────────────────────────────
router.use(authenticate);

router.post('/send', facebookController.sendMessage);
router.post('/test/:channelId', facebookController.testConnection);
router.get('/page/:channelId', facebookController.getPageInfo);

export default router;
