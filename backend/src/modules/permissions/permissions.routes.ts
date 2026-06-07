import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../shared/middleware/auth';
import {
  getMatriz,
  getCatalog,
  getByRole,
  getEffectiveMine,
  putRole,
  patchPermission,
  deletePermission,
  postReset,
  postCheck,
} from './permissions.controller';

const router = Router();
router.use(authenticate);

router.get('/catalog', getCatalog);
router.get('/matriz', getMatriz);
router.get('/me', getEffectiveMine);
router.get('/check', postCheck);
router.get('/:role', getByRole);

router.put('/:role', authorizeMaster, putRole);
router.patch('/:role/:resource/:action', authorizeMaster, patchPermission);
router.delete('/:role/:resource/:action', authorizeMaster, deletePermission);
router.post('/:role/reset', authorizeMaster, postReset);

export default router;
