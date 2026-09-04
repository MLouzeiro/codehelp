import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getSignatureConfigHandler,
  updateSignatureConfigHandler,
  testSignatureUrlHandler,
} from './os-signature-config.controller';

const router = Router();

const adminOrManager = authorize('admin', 'gerente');

router.get('/signature-config', authenticate, adminOrManager, getSignatureConfigHandler);
router.put('/signature-config', authenticate, adminOrManager, updateSignatureConfigHandler);
router.post('/signature-config/test', authenticate, adminOrManager, testSignatureUrlHandler);

export default router;
