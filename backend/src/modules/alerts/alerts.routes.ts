import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { listRecipients, addRecipient, updateRecipient, deleteRecipient, listHistory, triggerNow } from './alerts.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'gerente'));

router.get('/recipients', listRecipients);
router.post('/recipients', addRecipient);
router.put('/recipients/:id', updateRecipient);
router.delete('/recipients/:id', deleteRecipient);
router.get('/history', listHistory);
router.post('/trigger', triggerNow);

export default router;
