import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  solicitarAprovacaoHandler,
  enviarAprovacaoWhatsAppHandler,
  decidirAprovacaoHandler,
  decidirAprovacaoPorTokenHandler,
  listarAprovacoesHandler,
  obterAprovacaoHandler,
  contarPendentesHandler,
} from './aprovacao.controller';

const router = Router();

// Rota pública por token (link de validação) — NÃO cria ticket, não exige login
router.post('/token/:token/decidir', decidirAprovacaoPorTokenHandler);

router.use(authenticate);

router.post('/', authorize('admin', 'gerente', 'tecnico', 'vendedor'), solicitarAprovacaoHandler);
router.post('/:id/enviar-whatsapp', authorize('admin', 'gerente'), enviarAprovacaoWhatsAppHandler);
router.get('/', authorize('admin', 'gerente'), listarAprovacoesHandler);
router.get('/pendentes', authorize('admin', 'gerente'), contarPendentesHandler);
router.get('/:id', authorize('admin', 'gerente', 'tecnico', 'vendedor'), obterAprovacaoHandler);
router.post('/:id/decidir', authorize('admin', 'gerente'), decidirAprovacaoHandler);

export default router;
