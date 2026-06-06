import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getKanban,
  getEtapas,
  updateEtapaConfig,
  moveTicketEtapa,
  atribuirTicket,
  getDashboard,
  getTicketHistory,
  setAgentPresence,
  getTickets,
} from './helpdesk.controller';
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

const router = Router();
router.use(authenticate);

router.get('/kanban', getKanban);
router.get('/tickets', getTickets);
router.get('/dashboard', authorize('admin', 'gerente'), getDashboard);
router.get('/etapas', getEtapas);
router.patch('/etapas/:id', authorize('admin', 'gerente'), updateEtapaConfig);
router.post('/tickets/:id/move', moveTicketEtapa);
router.patch('/tickets/:id/atribuir', atribuirTicket);
router.get('/tickets/:id/history', getTicketHistory);
router.post('/presence', setAgentPresence);

router.get('/tickets/:id/sla', getTicketSla);
router.post('/tickets/:id/atribuir-sla', postAtribuirSla);
router.post('/tickets/:id/escalar', postEscalarTicket);
router.post('/tickets/:id/resolver', postResolverTicket);
router.post('/sla/processar-alertas', authorize('admin', 'gerente', 'supervisor'), postProcessarAlertasSla);
router.get('/filas', getFilas);
router.get('/sla-configs', getSlaConfigs);
router.get('/categorias', getCategorias);
router.get('/metrics', authorize('admin', 'gerente', 'supervisor'), getMetrics);

export default router;
