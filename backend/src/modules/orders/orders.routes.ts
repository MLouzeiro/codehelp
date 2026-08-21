import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { auditLog } from '../../shared/middleware/audit';
import {
  listOrders, getOrder, createOrder, updateOrder, deleteOrder,
  sendForSignature, signOrder, getSignatureByToken, getPdfOrder, updateOrderStatus,
  getOrderTimeline, listOrdersByTicket, createOrderFromTicket,
  getOrdersDashboard, exportOrdersCsvHandler,
  resendSignature, cancelSignatureRequest, refuseSignature,
} from './orders.controller';

const router = Router();

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

router.get('/sign/:token', getSignatureByToken);
router.post('/sign/:token', signOrder);
router.post('/sign/:token/recusar', refuseSignature);
router.get('/:id/pdf', authenticate, getPdfOrder);

export default router;
