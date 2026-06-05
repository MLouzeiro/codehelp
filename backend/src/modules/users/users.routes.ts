import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser } from './users.controller';
import { authenticate, authorize } from '../../shared/middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
