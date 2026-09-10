import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import {
  getSnapshotHandler,
  getAnalystTimelineHandler,
  getAnalystSummaryHandler,
  startPauseHandler,
  endPauseHandler,
  sseHandler,
} from './operacao.controller';

const router = Router();
router.use(authenticate);

router.get('/snapshot', authorize('admin', 'gerente', 'supervisor'), getSnapshotHandler);
router.get('/sse', authorize('admin', 'gerente', 'supervisor'), sseHandler);
router.get('/analista/:id/timeline', authorize('admin', 'gerente', 'supervisor'), getAnalystTimelineHandler);
router.get('/analista/:id/resumo', authorize('admin', 'gerente', 'supervisor'), getAnalystSummaryHandler);
router.post('/pausa/iniciar', startPauseHandler);
router.post('/pausa/finalizar', endPauseHandler);

export default router;
