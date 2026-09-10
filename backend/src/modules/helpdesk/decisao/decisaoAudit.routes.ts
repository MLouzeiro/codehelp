import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import {
  getResumoHandler,
  listarDecisoesHandler,
  gerarDecisoesHandler,
  atualizarStatusHandler,
  revisarDecisaoHandler,
  gerarReaberturaHandler,
  gerarSLAHandler,
  gerarCSATHandler,
  gerarOciosidadeHandler,
  gerarRetrabalhoHandler,
} from './decisaoAudit.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'gerente', 'supervisor'));

// Resumo do dashboard
router.get('/resumo', getResumoHandler);

// Listar decisões com filtros
router.get('/', listarDecisoesHandler);

// Gerar decisões para um período
router.post('/gerar', gerarDecisoesHandler);

// Gerar decisão individual por tipo
router.get('/reabertura', gerarReaberturaHandler);
router.get('/sla', gerarSLAHandler);
router.get('/csat', gerarCSATHandler);
router.get('/ociosidade', gerarOciosidadeHandler);
router.get('/retrabalho', gerarRetrabalhoHandler);

// Atualizar status de uma decisão
router.patch('/:id/status', atualizarStatusHandler);

// Revisar decisão (humano)
router.post('/:id/revisar', revisarDecisaoHandler);

export default router;
