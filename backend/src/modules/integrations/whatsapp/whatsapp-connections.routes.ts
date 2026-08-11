import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../../shared/middleware/auth';
import {
  listConnections, getConnection, createConnection,
  updateConnection, toggleConnection, deleteConnection,
  connectConnection, disconnectConnection,
  getConnectionStatus, getQrCode, regenerateQrCode,
  getAllConnectionsStatus, forceReconnect,
} from './whatsapp-connections.controller';

const router = Router();
router.use(authenticate);

// ── CRUD ──────────────────────────────────────────────────────────────
router.get('/connections', listConnections);
router.get('/connections/status', getAllConnectionsStatus);
router.get('/connections/:id', getConnection);
router.post('/connections', authorizeMaster, createConnection);
router.put('/connections/:id', authorizeMaster, updateConnection);
router.delete('/connections/:id', authorizeMaster, deleteConnection);
router.patch('/connections/:id/toggle', authorizeMaster, toggleConnection);

// ── Runtime Operations ────────────────────────────────────────────────
router.post('/connections/:id/connect', authorizeMaster, connectConnection);
router.post('/connections/:id/disconnect', authorizeMaster, disconnectConnection);
router.get('/connections/:id/status', getConnectionStatus);
router.get('/connections/:id/qrcode', getQrCode);
router.post('/connections/:id/regenerate-qr', authorizeMaster, regenerateQrCode);
router.post('/connections/:id/force-reconnect', authorizeMaster, forceReconnect);

export default router;
