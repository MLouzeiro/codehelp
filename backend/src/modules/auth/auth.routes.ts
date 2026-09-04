import { Router } from 'express';
import { login, refreshToken, me, logout, listUsers, createUser, updateUser, archiveUser, bulkArchiveUsers, deleteUserPermanently } from './auth.controller';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { validate, loginSchema, refreshTokenSchema, createUserSchema, updateUserSchema } from '../../shared/validation/schemas';
import { rateLimiter } from '../../shared/middleware/rateLimiter';

const router = Router();

// Brute-force protection: 5 tentativas por minuto no login
const loginRateLimit = rateLimiter({ windowMs: 60 * 1000, max: 5, keyPrefix: 'auth_login', message: 'Muitas tentativas de login. Aguarde 1 minuto.' });
// Refresh: 20 por minuto (normal para multi-aba)
const refreshRateLimit = rateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: 'auth_refresh', message: 'Muitas requisicoes de refresh. Aguarde.' });

router.post('/login', loginRateLimit, validate(loginSchema), login);
router.post('/refresh', refreshRateLimit, validate(refreshTokenSchema), refreshToken);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);
router.get('/users', authenticate, authorize('admin', 'gerente'), listUsers);
router.post('/users', authenticate, authorize('admin', 'gerente'), validate(createUserSchema), createUser);
router.post('/users/bulk-archive', authenticate, authorize('admin', 'gerente'), bulkArchiveUsers);
router.put('/users/:id', authenticate, authorize('admin', 'gerente'), validate(updateUserSchema), updateUser);
router.delete('/users/:id', authenticate, authorize('admin', 'gerente'), archiveUser);
router.delete('/users/:id/permanently', authenticate, authorize('admin', 'gerente'), deleteUserPermanently);

export default router;
