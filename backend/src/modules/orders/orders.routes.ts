import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { auditLog } from '../../shared/middleware/audit';
import { rateLimiter } from '../../shared/middleware/rateLimiter';
import {
  listOrders, getOrder, createOrder, updateOrder, deleteOrder,
  sendForSignature, signOrder, signOrderWithoutSignature, getSignatureByToken, getPdfOrder, updateOrderStatus,
  getOrderTimeline, listOrdersByTicket, createOrderFromTicket,
  getOrdersDashboard, exportOrdersCsvHandler,
  resendSignature, cancelSignatureRequest, refuseSignature,
  listOrderItemsHandler, createOrderItemHandler, updateOrderItemHandler, deleteOrderItemHandler,
  previewSignaturePhone, setManualPhone,
  sendOsToClient,
} from './orders.controller';
import signatureConfigRoutes from './os-signature-config.routes';

const router = Router();

// Rate limiter para endpoints publicos de token (brute-force protection)
const tokenRateLimit = rateLimiter({ windowMs: 60 * 1000, max: 10, keyPrefix: 'sign_token', message: 'Muitas tentativas de assinatura. Aguarde 1 minuto.' });

// Configuracao de endereco publico das OS (antes de /:id para evitar conflito)
router.use(signatureConfigRoutes);

router.get('/', authenticate, listOrders);
router.get('/report/dashboard', authenticate, authorize('admin', 'gerente'), getOrdersDashboard);
router.get('/report/export', authenticate, authorize('admin', 'gerente'), exportOrdersCsvHandler);
router.get('/ticket/:ticketId', authenticate, listOrdersByTicket);
router.post('/from-ticket/:ticketId', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('criar_os', 'ServiceOrder'), createOrderFromTicket);
router.get('/:id', authenticate, getOrder);
router.get('/:id/timeline', authenticate, getOrderTimeline);
router.post('/', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('criar_os', 'ServiceOrder'), createOrder);
router.put('/:id', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('editar_os', 'ServiceOrder'), updateOrder);
router.delete('/:id', authenticate, authorize('admin'), auditLog('deletar_os', 'ServiceOrder'), deleteOrder);
router.patch('/:id/status', authenticate, authorize('admin', 'gerente'), auditLog('alterar_status_os', 'ServiceOrder'), updateOrderStatus);
router.post('/:id/send-signature', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('enviar_assinatura', 'ServiceOrder'), sendForSignature);
router.post('/:id/resend-signature', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('reenviar_assinatura', 'ServiceOrder'), resendSignature);
router.post('/:id/cancel-signature', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('cancelar_assinatura', 'ServiceOrder'), cancelSignatureRequest);

// ── Preview e telefone manual para assinatura ──────────────────────
router.get('/:id/preview-phone', authenticate, previewSignaturePhone);
router.patch('/:id/manual-phone', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('definir_telefone_manual', 'ServiceOrder'), setManualPhone);

router.get('/sign/:token', tokenRateLimit, getSignatureByToken);
router.post('/sign/:token', tokenRateLimit, signOrder);
router.post('/sign/:token/without-signature', tokenRateLimit, signOrderWithoutSignature);
router.post('/sign/:token/recusar', tokenRateLimit, refuseSignature);
router.get('/:id/pdf', authenticate, getPdfOrder);
router.post('/:id/send-to-client', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('enviar_os_cliente', 'ServiceOrder'), sendOsToClient);

// ── Itens da OS ────────────────────────────────────────────────────
router.get('/:id/items', authenticate, listOrderItemsHandler);
router.post('/:id/items', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('criar_item_os', 'ServiceOrder'), createOrderItemHandler);
router.put('/:id/items/:itemId', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('editar_item_os', 'ServiceOrder'), updateOrderItemHandler);
router.delete('/:id/items/:itemId', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('deletar_item_os', 'ServiceOrder'), deleteOrderItemHandler);

export default router;
