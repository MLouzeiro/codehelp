import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser } from './users.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', authorize('admin'), listUsers);
router.post('/', authorize('admin'), createUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

export default router;
