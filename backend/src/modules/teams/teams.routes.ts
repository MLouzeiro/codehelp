import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  listTeams, getTeam, createTeam, updateTeam, deleteTeam, addMember, removeMember,
} from './teams.controller';

const router = Router();
router.use(authenticate);

router.get('/', listTeams);
router.post('/', authorize('admin', 'gerente'), createTeam);
router.get('/:teamId', getTeam);
router.patch('/:teamId', authorize('admin', 'gerente'), updateTeam);
router.delete('/:teamId', authorize('admin', 'gerente'), deleteTeam);
router.post('/:teamId/membros', authorize('admin', 'gerente'), addMember);
router.delete('/:teamId/membros/:userId', authorize('admin', 'gerente'), removeMember);

export default router;