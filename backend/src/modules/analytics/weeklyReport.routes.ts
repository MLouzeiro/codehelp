import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getRelatorioSemanal,
  getRelatorioSemanalMensagem,
  postEnviarRelatorio,
} from './weeklyReport.controller';

const router = Router();
router.use(authenticate);

router.get('/relatorio-semanal', authorize('admin', 'gerente'), getRelatorioSemanal);
router.get('/relatorio-semanal/mensagem', authorize('admin', 'gerente'), getRelatorioSemanalMensagem);
router.post('/relatorio-semanal/enviar', authorize('admin'), postEnviarRelatorio);

export default router;
