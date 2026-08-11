import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import * as telegramController from './telegram.controller';

const router = Router();

// ── Webhook (public — Telegram sends updates here) ──────────────────────
router.post('/webhook/:channelId', telegramController.handleWebhook);

// ── Protected routes ────────────────────────────────────────────────────
router.use(authenticate);

// ── Connection Test ─────────────────────────────────────────────────────
router.post('/test/:channelId', telegramController.testConnection);

// ── Send Message ────────────────────────────────────────────────────────
router.post('/send/:channelId', telegramController.sendMessage);

// ── Webhook Management ──────────────────────────────────────────────────
router.post('/webhook/set/:channelId', telegramController.setWebhook);
router.post('/webhook/delete/:channelId', telegramController.deleteWebhook);

export default router;
