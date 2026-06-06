import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import {
  getNotificacoes,
  getNaoLidasCount,
  postMarcarLida,
  postMarcarTodasLidas,
} from './notificacoes.controller';

const router = Router();
router.use(authenticate);

router.get('/', getNotificacoes);
router.get('/nao-lidas/count', getNaoLidasCount);
router.post('/:id/lida', postMarcarLida);
router.post('/marcar-todas', postMarcarTodasLidas);

export default router;
