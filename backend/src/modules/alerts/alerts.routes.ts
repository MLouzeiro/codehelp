import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { listRecipients, addRecipient, updateRecipient, deleteRecipient, listHistory, triggerNow } from './alerts.controller';
import {
  getConfigHandler,
  saveConfigHandler,
  getNaoLidosHandler,
  getResumoHandler,
} from './alerts.controller';

const router = Router();
router.use(authenticate);

router.get('/agent/config', getConfigHandler);
router.post('/agent/config', saveConfigHandler);
router.get('/agent/nao-lidos', getNaoLidosHandler);
router.get('/agent/resumo', getResumoHandler);

router.use(authorize('admin', 'gerente'));

router.get('/recipients', listRecipients);
router.post('/recipients', addRecipient);
router.put('/recipients/:id', updateRecipient);
router.delete('/recipients/:id', deleteRecipient);
router.get('/history', listHistory);
router.post('/trigger', triggerNow);

export default router;
