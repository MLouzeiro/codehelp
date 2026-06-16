import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  solicitarAprovacaoHandler,
  decidirAprovacaoHandler,
  listarAprovacoesHandler,
  obterAprovacaoHandler,
  contarPendentesHandler,
} from './aprovacao.controller';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin', 'gerente', 'tecnico', 'vendedor'), solicitarAprovacaoHandler);
router.get('/', authorize('admin', 'gerente'), listarAprovacoesHandler);
router.get('/pendentes', authorize('admin', 'gerente'), contarPendentesHandler);
router.get('/:id', authorize('admin', 'gerente', 'tecnico', 'vendedor'), obterAprovacaoHandler);
router.post('/:id/decidir', authorize('admin', 'gerente'), decidirAprovacaoHandler);

export default router;
