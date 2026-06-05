import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { auditLog } from '../../shared/middleware/audit';
import {
  listOrders, getOrder, createOrder, updateOrder, deleteOrder,
  sendForSignature, signOrder, getSignatureByToken, getPdfOrder, updateOrderStatus
} from './orders.controller';

const router = Router();

router.get('/', authenticate, listOrders);
router.get('/:id', authenticate, getOrder);
router.post('/', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('criar_os', 'ServiceOrder'), createOrder);
router.put('/:id', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('editar_os', 'ServiceOrder'), updateOrder);
router.delete('/:id', authenticate, authorize('admin'), auditLog('deletar_os', 'ServiceOrder'), deleteOrder);
router.patch('/:id/status', authenticate, authorize('admin', 'gerente'), auditLog('alterar_status_os', 'ServiceOrder'), updateOrderStatus);
router.post('/:id/send-signature', authenticate, authorize('admin', 'gerente', 'tecnico'), auditLog('enviar_assinatura', 'ServiceOrder'), sendForSignature);

router.get('/sign/:token', getSignatureByToken);
router.post('/sign/:token', signOrder);
router.get('/:id/pdf', authenticate, getPdfOrder);

export default router;
