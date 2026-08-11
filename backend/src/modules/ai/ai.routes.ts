import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
import {
  postClassificarTicket,
  postAnaliseContexto,
  postSugerirResposta,
  postNotaEncerramento,
  postAvaliarQualidade,
  postCorrigirResposta,
  postProcessarTicket,
  postAutoAtendimento,
  postRelatorioCompleto,
  postResolverPorIa,
  getMetricasIaRoute,
  getTicketClassificacoes,
  getTicketAvaliacoes,
  getTicketCorrecoes,
} from './aiTicket.controller';
import {
  getConfig,
  updateConfig,
  criarProposta,
  listarPendentes,
  listarTodas,
  validar,
  rejeitar,
  getMetricas,
} from './aiValidation.controller';
import { validate, aiTicketAnalysisSchema, aiValidationSchema } from '../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// ── AI Rate Limiter — prevenir cost amplification ────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes de IA. Aguarde 1 minuto.' },
});

// ── Input length limiter — prevenir payloads enormes ─────────────────
const maxInputLength = 5000;

function validateAILength(req: any, res: any, next: any) {
  const body = req.body;
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' && value.length > maxInputLength) {
        return res.status(400).json({
          error: `Campo "${key}" excede o limite de ${maxInputLength} caracteres`,
        });
      }
    }
  }
  next();
}

// ── Robots (existente) ─────────────────────────────────────────
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

// ── AI Ticket — com rate limiting e validacao de input ──────────
router.get('/metricas', authorize('admin', 'gerente', 'supervisor'), getMetricasIaRoute);
router.post('/ticket/:id/classificar', aiLimiter, validateAILength, postClassificarTicket);
router.post('/ticket/:id/analise-contexto', aiLimiter, validateAILength, postAnaliseContexto);
router.post('/ticket/:id/sugerir-resposta', aiLimiter, validateAILength, postSugerirResposta);
router.post('/ticket/:id/nota-encerramento', aiLimiter, validateAILength, postNotaEncerramento);
router.post('/ticket/:id/avaliar-qualidade', aiLimiter, authorize('admin', 'gerente', 'supervisor'), validateAILength, postAvaliarQualidade);
router.post('/ticket/:id/corrigir', aiLimiter, validateAILength, postCorrigirResposta);
router.post('/ticket/:id/processar', aiLimiter, validateAILength, postProcessarTicket);
router.get('/ticket/:id/classificacoes', getTicketClassificacoes);
router.get('/ticket/:id/avaliacoes', getTicketAvaliacoes);
router.get('/ticket/:id/correcoes', getTicketCorrecoes);

// ── Auto-atendimento e relatorio — com rate limiting ───────────
router.post('/ticket/:id/auto-atender', aiLimiter, validateAILength, postAutoAtendimento);
router.post('/ticket/:id/relatorio-completo', aiLimiter, validateAILength, postRelatorioCompleto);
router.post('/ticket/:id/resolver-por-ia', aiLimiter, authorize('admin', 'gerente', 'supervisor'), validateAILength, postResolverPorIa);

// ── Validacao de Respostas IA — com rate limiting ──────────────
router.get('/validacoes/config', getConfig);
router.patch('/validacoes/config', authorize('admin'), updateConfig);
router.post('/validacoes', aiLimiter, validateAILength, criarProposta);
router.get('/validacoes/pendentes', listarPendentes);
router.get('/validacoes', listarTodas);
router.patch('/validacoes/:id/validar', validar);
router.patch('/validacoes/:id/rejeitar', rejeitar);
router.get('/validacoes/metricas', authorize('admin', 'gerente', 'supervisor'), getMetricas);

export default router;
