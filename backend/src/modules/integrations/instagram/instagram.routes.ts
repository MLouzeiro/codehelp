import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import * as instagramController from './instagram.controller';

const router = Router();

// ── Webhook (no auth required) ────────────────────────────────────────
router.get('/webhook/:channelId', instagramController.verifyWebhook);
router.post('/webhook/:channelId', instagramController.handleWebhook);

// ── Protected routes ──────────────────────────────────────────────────
router.use(authenticate);

router.post('/send', instagramController.sendMessage);
router.post('/test/:channelId', instagramController.testConnection);
router.get('/profile/:channelId', instagramController.getProfile);

export default router;
