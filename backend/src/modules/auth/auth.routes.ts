import { Router } from 'express';
import { login, refreshToken, me, listUsers, createUser, updateUser, archiveUser } from './auth.controller';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { validate, loginSchema, refreshTokenSchema, createUserSchema, updateUserSchema } from '../../shared/validation/schemas';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);
router.get('/me', authenticate, me);
router.get('/users', authenticate, authorize('admin', 'gerente'), listUsers);
router.post('/users', authenticate, authorize('admin', 'gerente'), validate(createUserSchema), createUser);
router.put('/users/:id', authenticate, authorize('admin', 'gerente'), validate(updateUserSchema), updateUser);
router.delete('/users/:id', authenticate, authorize('admin', 'gerente'), archiveUser);

export default router;
