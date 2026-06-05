import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { getKpis } from './dashboard.controller';

const router = Router();
router.use(authenticate);

router.get('/kpis', getKpis);

export default router;
