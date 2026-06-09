import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { searchHandler, suggestionsHandler } from './search.controller';

const router = Router();
router.use(authenticate);

router.get('/search', searchHandler);
router.get('/search/suggestions', suggestionsHandler);

export default router;
