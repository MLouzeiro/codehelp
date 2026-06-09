import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../shared/middleware/auth';
import { getFilasList, postFila, putFila, toggleFilaHandler } from './filas.controller';

const router = Router();
router.use(authenticate);

router.get('/filas', getFilasList);
router.post('/filas', authorizeMaster, postFila);
router.put('/filas/:id', authorizeMaster, putFila);
router.patch('/filas/:id/toggle', authorizeMaster, toggleFilaHandler);

export default router;
