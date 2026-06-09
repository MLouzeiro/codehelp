import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../../shared/middleware/auth';
import {
  listConnections, getConnection, createConnection,
  updateConnection, toggleConnection,
} from './whatsapp-connections.controller';

const router = Router();
router.use(authenticate);

router.get('/connections', listConnections);
router.get('/connections/:id', getConnection);
router.post('/connections', authorizeMaster, createConnection);
router.put('/connections/:id', authorizeMaster, updateConnection);
router.patch('/connections/:id/toggle', authorizeMaster, toggleConnection);

export default router;
