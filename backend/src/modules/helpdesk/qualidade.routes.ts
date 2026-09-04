import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getQualidadeHandler,
  getReaberturaDetalheHandler,
  getRecorrenciaDetalheHandler,
  getRetrabalhoDetalheHandler,
  getDiagnosticoIaHandler,
  getQualidadeClienteHandler,
} from './qualidade.controller';

const router = Router();
router.use(authenticate);

router.get('/qualidade', authorize('admin', 'gerente', 'supervisor'), getQualidadeHandler);
router.get('/qualidade/reaberturas', authorize('admin', 'gerente', 'supervisor'), getReaberturaDetalheHandler);
router.get('/qualidade/recorrencia', authorize('admin', 'gerente', 'supervisor'), getRecorrenciaDetalheHandler);
router.get('/qualidade/retrabalho', authorize('admin', 'gerente', 'supervisor'), getRetrabalhoDetalheHandler);
router.get('/qualidade/diagnostico/:tipo', authorize('admin', 'gerente', 'supervisor'), getDiagnosticoIaHandler);
router.get('/qualidade/cliente/:clientId', authorize('admin', 'gerente', 'supervisor'), getQualidadeClienteHandler);

export default router;
