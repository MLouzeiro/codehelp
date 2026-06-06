import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { listAuditLogs, getTicketAuditLogs } from './audit.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize('admin', 'gerente', 'supervisor'), listAuditLogs);
router.get('/ticket/:ticketId', authorize('admin', 'gerente', 'supervisor'), getTicketAuditLogs);

export default router;
