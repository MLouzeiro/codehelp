import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import * as emailController from './email.controller';

const router = Router();

router.use(authenticate);

// ── Email Operations ──────────────────────────────────────────────────
router.post('/send', emailController.sendEmail);
router.get('/fetch/:channelId', emailController.fetchEmails);
router.get('/config/:channelId', emailController.getConfig);
router.post('/test/:channelId', emailController.testConnection);

export default router;
