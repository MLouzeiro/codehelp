import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import {
  postRegra,
  getRegrasList,
  getRegraById,
  patchRegra,
  deleteRegraRoute,
  postTestarRegra,
} from './automations.controller';

const router = Router();
router.use(authenticate);

router.get('/', getRegrasList);
router.get('/:id', getRegraById);
router.post('/', postRegra);
router.patch('/:id', patchRegra);
router.delete('/:id', deleteRegraRoute);
router.post('/testar', postTestarRegra);

export default router;
