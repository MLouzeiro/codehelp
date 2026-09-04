import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../../shared/middleware/auth';
import prisma from '../../config/database';
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

// ── Custos de IA — monitoramento de uso e custo ──────────────
router.get('/custos/hoje', authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { getCustoHoje } = await import('./aiCost.service');
    const hoje = await getCustoHoje();
    return res.json(hoje);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar custos de hoje' });
  }
});

router.get('/custos', authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { getCustoResumo } = await import('./aiCost.service');
    const dias = parseInt(req.query.dias as string) || 30;
    const resumo = await getCustoResumo(dias);
    return res.json(resumo);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar resumo de custos' });
  }
});

// ── Robot Dashboard — monitoramento de execucoes ──────────────
router.get('/robots/dashboard', authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { getRobotStats, getExecutionLog } = await import('./robot.scheduler');
    const robots = await prisma.robot.findMany({
      include: { rules: { select: { id: true, ativo: true } } },
      orderBy: { ordem: 'asc' },
    });
    const stats = getRobotStats();
    const recentExecutions = getExecutionLog(20);
    const dashboard = robots.map((robot) => ({
      id: robot.id,
      slug: robot.slug,
      nome: robot.nome,
      descricao: robot.descricao,
      icone: robot.icone,
      ativo: robot.ativo,
      inteligente: robot.inteligente,
      horarioAtivo: robot.horarioAtivo,
      horaInicio: robot.horaInicio,
      horaFim: robot.horaFim,
      totalRegras: robot.rules.length,
      regrasAtivas: robot.rules.filter((r) => r.ativo).length,
      stats: stats[robot.slug] || { executions: 0, success: 0, failed: 0, lastExecution: null },
    }));
    return res.json({
      robots: dashboard,
      recentExecutions,
      summary: {
        totalRobots: robots.length,
        activeRobots: robots.filter((r) => r.ativo).length,
        totalExecutions: Object.values(stats).reduce((acc, s) => acc + s.executions, 0),
        totalSuccess: Object.values(stats).reduce((acc, s) => acc + s.success, 0),
        totalFailed: Object.values(stats).reduce((acc, s) => acc + s.failed, 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dashboard de robôs' });
  }
});

router.get('/robots/logs', authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { getExecutionLog } = await import('./robot.scheduler');
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = getExecutionLog(limit);
    return res.json({ logs });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar logs de execução' });
  }
});

router.post('/robots/:slug/execute', authorize('admin', 'gerente'), async (req, res) => {
  try {
    const { slug } = req.params;
    const { executarRobot } = await import('./robot.scheduler');
    const robot = await prisma.robot.findFirst({ where: { slug } });
    if (!robot) return res.status(404).json({ error: 'Robô não encontrado' });
    const robotFunctions: Record<string, () => Promise<any>> = {
      'vendas': async () => { const { gerarSugestoesVendas } = await import('./ai.service'); return gerarSugestoesVendas(); },
      'classificador': async () => { const { classificarTicketsPendentes } = await import('./ai.service'); return classificarTicketsPendentes(); },
      'os-analyst': async () => { const { analisarOsAtrasadas } = await import('./ai.service'); const alerts = await analisarOsAtrasadas(); return { alerts }; },
      'tarefas': async () => { const { sugerirPrioridadesTarefas } = await import('./ai.service'); const sugestoes = await sugerirPrioridadesTarefas(); return { sugestoes }; },
    };
    const robotFn = robotFunctions[slug];
    if (!robotFn) return res.status(400).json({ error: 'Robô não suporta execução manual' });
    await executarRobot(slug, robot.nome, robotFn);
    return res.json({ success: true, message: `Robô "${robot.nome}" executado com sucesso` });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao executar robô' });
  }
});

export default router;
