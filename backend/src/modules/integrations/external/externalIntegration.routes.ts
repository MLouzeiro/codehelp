import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import controller from './externalIntegration.controller';

const router = Router();

// Rate limit especifico do webhook público (entrada de dados externos)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes de webhook. Tente novamente em 1 minuto.' },
});

// ── Configuração (autenticada) — admin/gerente ────────────────────────
router.get('/', authenticate, authorize('admin', 'gerente'), controller.listIntegrations);
router.get('/:id', authenticate, authorize('admin', 'gerente'), controller.getIntegration);
router.post('/', authenticate, authorize('admin', 'gerente'), controller.createIntegration);
router.put('/:id', authenticate, authorize('admin', 'gerente'), controller.updateIntegration);
router.patch('/:id/toggle', authenticate, authorize('admin', 'gerente'), controller.toggleIntegration);
router.delete('/:id', authenticate, authorize('admin'), controller.deleteIntegration);
router.post('/:id/test', authenticate, authorize('admin', 'gerente'), controller.testIntegrationConnection);
router.get('/:id/logs', authenticate, authorize('admin', 'gerente'), controller.getIntegrationLogs);

// ── Outbound: consultas / sincronização (autenticada) ─────────────────
router.get('/external/clients/:integrationId/:clienteId', authenticate, controller.consultarCliente);
router.get('/external/companies/:integrationId/:empresaId', authenticate, controller.consultarEmpresa);
router.get('/external/clients/:integrationId/:clienteId/contacts', authenticate, controller.consultarContatos);
router.get('/external/clients/:integrationId/:clienteId/contracts', authenticate, controller.consultarContratos);
router.get('/external/clients/:integrationId/:clienteId/services', authenticate, controller.consultarServicos);
router.post('/external/tickets/:integrationId/:ticketId/sync', authenticate, controller.syncTicket);
router.post('/external/tickets/:integrationId/:ticketId/atendimento', authenticate, controller.syncAtendimento);

// ── Webhook público (HMAC) — fora de auth ─────────────────────────────
router.post('/webhook/:slug', webhookLimiter, controller.receberWebhook);

export default router;