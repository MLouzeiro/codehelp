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
  getTicketAnalytics,
  getTicketTagsController,
  addTicketTagController,
  removeTicketTagController,
  setTicketTagsController,
  getTicketFCR,
  getTicketDepartmentTime,
  criarKanbanTaskHandler,
  getMetricasFCR,
  getDetailedDashboard,
  getAgentAuditHandler,
} from './helpdesk.controller';
import {
  getAuditarEncerramento,
  getListarEncerrados,
  getAuditarLote,
  getResumoAuditoria,
  getExportarAuditoria,
  getExportarAuditoriaExcel,
} from './closureAudit.controller';
import { getRelatorioAnalista, getReplayAnalista, getResumoTodosAnalistas } from './agentReport.controller';
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
} from './sla.controller';
import {
  getCategoriasHandler,
  postCategoria,
  putCategoria,
  patchCategoriaAtivo,
  deleteCategoria,
  getAssuntosHandler,
  postAssunto,
  putAssunto,
  patchAssuntoAtivo,
  getConfigClassificacao,
  putConfigClassificacao,
  postSugerirClassificacao,
  patchTicketClassificacao,
  getCategoriasOptions,
} from './categorias.controller';
import { getMetrics } from './metrics.controller';
import {
  getIndicadoresHandler,
  getMetasHandler,
  putMetasHandler,
  getSlaTicketHandler,
  getAlertasHandler,
  getIndicadoresCsvHandler,
} from './indicadores.controller';
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
router.get('/tickets/:id/analytics', requireTicketAccess('view'), getTicketAnalytics);
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

// ── Categorias e Assuntos (hierarquia CATEGORIA -> ASSUNTO) ───────────
router.get('/categorias', getCategoriasHandler);
router.get('/categorias/options', getCategoriasOptions);
router.get('/categorias/config', getConfigClassificacao);
router.put('/categorias/config', authorize('admin'), putConfigClassificacao);
router.post('/categorias', authorize('admin', 'gerente'), postCategoria);
router.put('/categorias/:id', authorize('admin', 'gerente'), putCategoria);
router.patch('/categorias/:id/ativar', authorize('admin', 'gerente'), patchCategoriaAtivo);
router.delete('/categorias/:id', authorize('admin', 'gerente'), deleteCategoria);
router.get('/assuntos', getAssuntosHandler);
router.post('/assuntos', authorize('admin', 'gerente'), postAssunto);
router.put('/assuntos/:id', authorize('admin', 'gerente'), putAssunto);
router.patch('/assuntos/:id/ativar', authorize('admin', 'gerente'), patchAssuntoAtivo);
router.post('/tickets/:id/classificacao/sugerir', requireTicketAccess('view'), postSugerirClassificacao);
router.patch('/tickets/:id/classificacao', requireTicketAccess('edit'), patchTicketClassificacao);

router.get('/metrics', authorize('admin', 'gerente', 'supervisor'), getMetrics);

// ── Indicadores de atendimento (TMR / TME / PR / SLA) ──────────────────
router.get('/indicadores', authorize('admin', 'gerente', 'supervisor'), getIndicadoresHandler);
router.get('/indicadores/metas', authorize('admin', 'gerente'), getMetasHandler);
router.put('/indicadores/metas', authorize('admin'), putMetasHandler);
router.get('/indicadores/sla/:id', requireTicketAccess('view'), getSlaTicketHandler);
router.get('/indicadores/alertas', authorize('admin', 'gerente', 'supervisor'), getAlertasHandler);
router.get('/indicadores/exportar-csv', authorize('admin', 'gerente', 'supervisor'), getIndicadoresCsvHandler);

router.get('/auto-messages', authorize('admin', 'gerente'), listAutoMessagesHandler);
router.put('/auto-messages/:slug', authorize('admin', 'gerente'), updateAutoMessageHandler);
router.post('/auto-messages/:slug/reset', authorize('admin', 'gerente'), resetAutoMessageHandler);

router.get('/tickets/:id/tags', requireTicketAccess('view'), getTicketTagsController);
router.post('/tickets/:id/tags', requireTicketAccess('edit'), addTicketTagController);
router.delete('/tickets/:id/tags/:tag', requireTicketAccess('edit'), removeTicketTagController);
router.put('/tickets/:id/tags', requireTicketAccess('edit'), setTicketTagsController);

router.get('/tickets/:id/fcr', requireTicketAccess('view'), getTicketFCR);
router.get('/tickets/:id/department-time', requireTicketAccess('view'), getTicketDepartmentTime);
router.post('/tickets/:id/criar-kanban', requireTicketAccess('edit'), criarKanbanTaskHandler);
router.get('/fcr/metricas', authorize('admin', 'gerente'), getMetricasFCR);
router.get('/dashboard/detalhado', authorize('admin', 'gerente'), getDetailedDashboard);
router.get('/audit/agent-performance', authorize('admin', 'gerente'), getAgentAuditHandler);

// ── Auditoria de encerramento (prematuro / resolução real / reabertura) ──
router.get('/closure-audit/resumo', authorize('admin', 'gerente'), getResumoAuditoria);
router.get('/closure-audit/encerrados', authorize('admin', 'gerente'), getListarEncerrados);
router.get('/closure-audit/lote', authorize('admin', 'gerente'), getAuditarLote);
router.get('/closure-audit/exportar', authorize('admin', 'gerente'), getExportarAuditoria);
router.get('/closure-audit/exportar-excel', authorize('admin', 'gerente'), getExportarAuditoriaExcel);
router.get('/closure-audit/:id', authorize('admin', 'gerente'), getAuditarEncerramento);

// ── Auditoria individual por analista (relatório + replay de conversa) ──
router.get('/audit/agent/:id', authorize('admin', 'gerente'), getRelatorioAnalista);
router.get('/audit/agent/:id/ticket/:ticketId', authorize('admin', 'gerente'), getReplayAnalista);
router.get('/audit/analistas/resumo', authorize('admin', 'gerente'), getResumoTodosAnalistas);

export default router;
