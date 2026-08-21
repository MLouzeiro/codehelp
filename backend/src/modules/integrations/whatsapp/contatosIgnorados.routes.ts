import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import {
  getListaContatosIgnorados,
  getResumoContatosIgnoradosHandler,
  postCriarContatoIgnorado,
  patchAtualizarContatoIgnorado,
  postReativarContatoIgnorado,
  postAlternarStatusContatoIgnorado,
  deleteContatoIgnorado,
} from './contatosIgnorados.controller';

// ── Contatos e grupos ignorados do Helpdesk ────────────────────────────
// Acesso restrito a admin/gerente. A regra em si (isOrigemIgnorada) é
// aplicada no handler compartilhado ANTES de criar ticket/saudação.

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'gerente'));

router.get('/', getListaContatosIgnorados);
router.get('/resumo', getResumoContatosIgnoradosHandler);
router.post('/', postCriarContatoIgnorado);
router.patch('/:id', patchAtualizarContatoIgnorado);
router.post('/:id/reativar', postReativarContatoIgnorado);
router.post('/:id/toggle', postAlternarStatusContatoIgnorado);
router.delete('/:id', deleteContatoIgnorado);

export default router;