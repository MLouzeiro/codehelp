import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { getDashboard, getInsights, getKpis } from './analytics.controller';

const router = Router();
router.use(authenticate);

router.get('/dashboard', getDashboard);
router.get('/insights', getInsights);
router.get('/kpis', getKpis);

export default router;
