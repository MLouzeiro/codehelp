import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { listTasks, createTask, updateTask, deleteTask, getKanban, reorderTasks } from './kanban.controller';

const router = Router();
router.use(authenticate);

router.get('/tasks', listTasks);
router.post('/tasks', authorize('admin', 'gerente'), createTask);
router.put('/tasks/:id', authorize('admin', 'gerente', 'tecnico'), updateTask);
router.delete('/tasks/:id', authorize('admin'), deleteTask);
router.patch('/tasks/reorder', authenticate, reorderTasks);
router.get('/board', getKanban);

export default router;
