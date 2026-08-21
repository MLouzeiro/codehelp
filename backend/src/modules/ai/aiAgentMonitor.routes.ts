import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  avaliarMensagemHandler,
  sugestaoRespostaHandler,
  metricasAgenteHandler,
  relatorioAuditoriaHandler,
  rankingAgentesHandler,
  encerramentosAgenteHandler,
  encerramentoTicketHandler,
} from './aiAgentMonitor.controller';

const router = Router();

router.use(authenticate);

router.post('/avaliar', avaliarMensagemHandler);
router.get('/sugestao/:ticketId', sugestaoRespostaHandler);
router.get('/metricas/:agentId', metricasAgenteHandler);
router.get('/relatorio/:ticketId', relatorioAuditoriaHandler);
router.get('/encerramentos/ticket/:ticketId', encerramentoTicketHandler);
router.get('/encerramentos/:agentId', encerramentosAgenteHandler);
router.get('/ranking', authorize('admin', 'gerente'), rankingAgentesHandler);

export default router;
