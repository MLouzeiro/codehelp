import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { listTasks, createTask, updateTask, deleteTask, reorderTasks, getKanbanBoard } from './tasks.controller';

const router = Router();
router.use(authenticate);

router.get('/', listTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', authorize('admin'), deleteTask);
router.patch('/reorder', reorderTasks);
router.get('/board', getKanbanBoard);

export default router;
