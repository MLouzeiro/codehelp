import { Router } from 'express';
import { listClients, getClient, createClient, updateClient, deleteClient } from './clients.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', listClients);
router.get('/:id', getClient);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', authorize('admin'), deleteClient);

export default router;
