import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import {
  postKb,
  getKbList,
  getKbById,
  getKbBySlugRoute,
  patchKb,
  deleteKb,
  postPublicarKb,
  postFeedbackKb,
  getSugerirKb,
} from './kb.controller';

const router = Router();
router.use(authenticate);

router.get('/', getKbList);
router.get('/sugerir/:ticketId', getSugerirKb);
router.get('/slug/:slug', getKbBySlugRoute);
router.get('/:id', getKbById);
router.post('/', postKb);
router.patch('/:id', patchKb);
router.delete('/:id', deleteKb);
router.post('/:id/publicar', postPublicarKb);
router.post('/:id/feedback', postFeedbackKb);

export default router;
