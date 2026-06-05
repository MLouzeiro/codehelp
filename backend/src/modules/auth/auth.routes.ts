import { Router } from 'express';
import { login, refreshToken, me, listUsers, createUser, updateUser } from './auth.controller';
import { authenticate, authorize } from '../../shared/middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, me);
router.get('/users', authenticate, authorize('admin', 'gerente'), listUsers);
router.post('/users', authenticate, authorize('admin', 'gerente'), createUser);
router.put('/users/:id', authenticate, authorize('admin', 'gerente'), updateUser);

export default router;
