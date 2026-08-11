import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import {
  listEnquetes,
  getEnquete,
  createEnquete,
  updateEnquete,
  deleteEnquete,
  enviarEnquete,
} from './enquetes.controller';

const router = Router();

router.use(authenticate);

router.get('/', listEnquetes);
router.get('/:id', getEnquete);
router.post('/', createEnquete);
router.put('/:id', updateEnquete);
router.delete('/:id', deleteEnquete);
router.post('/:id/enviar', enviarEnquete);

export default router;
