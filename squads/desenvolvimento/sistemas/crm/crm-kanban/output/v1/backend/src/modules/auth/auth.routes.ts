import { Router } from 'express';
import { login, refreshToken, me } from './auth.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, me);

export default router;
