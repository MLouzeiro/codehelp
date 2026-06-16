import { Router } from 'express';
import { authenticate, authorize, authorizeMaster } from '../../shared/middleware/auth';
import { requireTicketAccess } from '../../shared/middleware/ticketAccess';
import {
  getKanban,
  getStatusBoard,
  getEtapas,
  updateEtapaConfig,
  moveTicketEtapa,
  atribuirTicket,
  updateTicketClient,
  getDashboard,
  getTicketHistory,
  setAgentPresence,
  getTickets,
  triageTicket,
  assumeTicket,
  getTicketPosition,
  recalcQueue,
} from './helpdesk.controller';
import {
  getStages,
  getEtapaInicialSlug,
  postStage,
  putStage,
  patchReorder,
  deleteStageHandler,
  restoreStageHandler,
} from './stages.controller';
import {
  getTicketSla,
  postProcessarAlertasSla,
  postAtribuirSla,
  postEscalarTicket,
  postResolverTicket,
  getFilas,
  getSlaConfigs,
  getCategorias,
} from './sla.controller';
import { getMetrics } from './metrics.controller';
import {
  listAutoMessagesHandler,
  updateAutoMessageHandler,
  resetAutoMessageHandler,
} from './autoMessages.controller';

const router = Router();
router.use(authenticate);

router.get('/kanban', getKanban);
router.get('/status-board', getStatusBoard);
router.get('/tickets', getTickets);
router.get('/dashboard', authorize('admin', 'gerente'), getDashboard);
router.get('/etapas', getEtapas);
router.patch('/etapas/:id', authorize('admin', 'gerente'), updateEtapaConfig);
router.post('/tickets/:id/move', requireTicketAccess('edit'), moveTicketEtapa);
router.patch('/tickets/:id/atribuir', requireTicketAccess('assign'), atribuirTicket);
router.post('/tickets/:id/triage', requireTicketAccess('edit'), triageTicket);
router.post('/tickets/:id/assume', requireTicketAccess('edit'), assumeTicket);
router.patch('/tickets/:id/client', requireTicketAccess('edit'), updateTicketClient);
router.get('/tickets/:id/history', requireTicketAccess('view'), getTicketHistory);
router.get('/tickets/:id/position', requireTicketAccess('view'), getTicketPosition);
router.post('/queue/recalc', authorize('admin', 'gerente', 'supervisor'), recalcQueue);
router.post('/presence', setAgentPresence);

router.get('/stages', getStages);
router.get('/stages/inicial', getEtapaInicialSlug);
router.post('/stages', authorizeMaster, postStage);
router.put('/stages/:id', authorizeMaster, putStage);
router.patch('/stages/reorder', authorizeMaster, patchReorder);
router.delete('/stages/:id', authorizeMaster, deleteStageHandler);
router.post('/stages/:id/restore', authorizeMaster, restoreStageHandler);

router.get('/tickets/:id/sla', requireTicketAccess('view'), getTicketSla);
router.post('/tickets/:id/atribuir-sla', requireTicketAccess('assign'), postAtribuirSla);
router.post('/tickets/:id/escalar', requireTicketAccess('edit'), postEscalarTicket);
router.post('/tickets/:id/resolver', requireTicketAccess('edit'), postResolverTicket);
router.post('/sla/processar-alertas', authorize('admin', 'gerente', 'supervisor'), postProcessarAlertasSla);
router.get('/filas', getFilas);
router.get('/sla-configs', getSlaConfigs);
router.get('/categorias', getCategorias);
router.get('/metrics', authorize('admin', 'gerente', 'supervisor'), getMetrics);

router.get('/auto-messages', authorize('admin', 'gerente'), listAutoMessagesHandler);
router.put('/auto-messages/:slug', authorize('admin', 'gerente'), updateAutoMessageHandler);
router.post('/auto-messages/:slug/reset', authorize('admin', 'gerente'), resetAutoMessageHandler);

export default router;
