import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../shared/middleware/auth';
import {
  getList,
  getOne,
  postCreate,
  putUpdate,
  delRemove,
  postSeed,
} from './feriados.controller';

const router = Router();
router.use(authenticate);

router.get('/', getList);
router.get('/seed', postSeed);
router.get('/:id', getOne);

router.post('/', authorizeMaster, postCreate);
router.put('/:id', authorizeMaster, putUpdate);
router.delete('/:id', authorizeMaster, delRemove);
router.post('/seed', authorizeMaster, postSeed);

export default router;
