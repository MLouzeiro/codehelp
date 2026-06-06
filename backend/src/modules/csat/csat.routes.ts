import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  postAgendarCsat,
  postEnviarCsat,
  postResponderCsatPublic,
  getEstatisticasCsatRoute,
  postProcessarCsat,
} from './csat.controller';

const router = Router();

router.post('/responder/:token', postResponderCsatPublic);

router.use(authenticate);
router.post('/ticket/:ticketId/agendar', postAgendarCsat);
router.post('/ticket/:ticketId/enviar', postEnviarCsat);
router.post('/processar', authorize('admin', 'gerente', 'supervisor'), postProcessarCsat);
router.get('/estatisticas', authorize('admin', 'gerente', 'supervisor'), getEstatisticasCsatRoute);

export default router;
