import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  listBoards, getBoard, createBoard, updateBoard, deleteBoard,
  createColumn, updateColumn, deleteColumn, reorderColumns,
  createTask, getTask, updateTask, deleteTask, moveTask, reorderTasks,
  createSubtask, toggleSubtask, deleteSubtask,
  addComment, getActivityLog,
  listTemplates, createBoardFromTemplate, createTemplate,
  createTag, deleteTag,
  createTaskFromTicket, transferTask, duplicateTask,
  autoCategorize,
} from './kanban.controller';
import uploadRouter from './upload.routes';

const router = Router();
router.use(authenticate);

// Boards
router.get('/boards', listBoards);
router.post('/boards', authorize('admin', 'gerente'), createBoard);
router.get('/boards/:boardId', getBoard);
router.patch('/boards/:boardId', authorize('admin', 'gerente'), updateBoard);
router.delete('/boards/:boardId', authorize('admin'), deleteBoard);

// Columns
router.post('/boards/:boardId/columns', authorize('admin', 'gerente'), createColumn);
router.patch('/columns/:columnId', authorize('admin', 'gerente'), updateColumn);
router.delete('/columns/:columnId', authorize('admin', 'gerente'), deleteColumn);
router.patch('/boards/:boardId/columns/reorder', authorize('admin', 'gerente'), reorderColumns);

// Tasks
router.post('/boards/:boardId/tasks', createTask);
router.get('/tasks/:taskId', getTask);
router.patch('/tasks/:taskId', updateTask);
router.delete('/tasks/:taskId', authorize('admin', 'gerente'), deleteTask);
router.patch('/tasks/:taskId/move', moveTask);
router.patch('/columns/:columnId/tasks/reorder', authorize('admin', 'gerente'), reorderTasks);

// Subtasks
router.post('/tasks/:taskId/subtasks', createSubtask);
router.patch('/subtasks/:subtaskId/toggle', toggleSubtask);
router.delete('/subtasks/:subtaskId', deleteSubtask);

// Activity
router.post('/tasks/:taskId/comments', addComment);
router.get('/tasks/:taskId/activity', getActivityLog);

// Templates
router.get('/templates', listTemplates);
router.post('/boards/from-template/:templateId', authorize('admin', 'gerente'), createBoardFromTemplate);
router.post('/templates', authorize('admin'), createTemplate);

// Tags
router.post('/boards/:boardId/tags', authorize('admin', 'gerente'), createTag);
router.delete('/tags/:tagId', authorize('admin', 'gerente'), deleteTag);

// Ticket -> Kanban
router.post('/boards/:boardId/tickets/:ticketId', createTaskFromTicket);

// Transfer & Duplicate
router.patch('/tasks/:taskId/transfer', transferTask);
router.post('/tasks/:taskId/duplicate', duplicateTask);

// AI Categorize
router.post('/tasks/:taskId/auto-categorize', autoCategorize);

// Attachments (upload routes handle their own multer middleware)
router.use(uploadRouter);

export default router;
