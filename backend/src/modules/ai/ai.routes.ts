import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getVendasSugestoes,
  runClassificarTickets,
  getOsAlerts,
  getTarefasSugestoes,
  getRobosStatus,
  updateRobot,
  createRobot,
  deleteRobot,
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
} from './ai.controller';

const router = Router();
router.use(authenticate);

router.get('/sugestoes-vendas', authorize('admin', 'gerente', 'comercial'), getVendasSugestoes);
router.post('/classificar-tickets', authorize('admin', 'gerente'), runClassificarTickets);
router.get('/os-alerts', authorize('admin', 'gerente'), getOsAlerts);
router.get('/sugestoes-tarefas', authorize('admin', 'gerente'), getTarefasSugestoes);
router.get('/status', getRobosStatus);

router.post('/robos', authorize('admin', 'gerente'), createRobot);
router.patch('/robos/:id', authorize('admin', 'gerente'), updateRobot);
router.delete('/robos/:id', authorize('admin', 'gerente'), deleteRobot);
router.post('/robos/:robotId/rules', authorize('admin', 'gerente'), createRule);
router.patch('/rules/:id', authorize('admin', 'gerente'), updateRule);
router.delete('/rules/:id', authorize('admin', 'gerente'), deleteRule);
router.post('/rules/reorder', authorize('admin', 'gerente'), reorderRules);

export default router;
