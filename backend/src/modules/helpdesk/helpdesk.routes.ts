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

export default router;
