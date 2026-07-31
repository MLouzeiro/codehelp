import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth';
import { requireTicketAccess } from '../../shared/middleware/ticketAccess';
import {
  getChecklist,
  addChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklist,
} from './checklist.controller';

const router = Router();
router.use(authenticate);

router.get('/tickets/:ticketId/checklist', requireTicketAccess('view'), getChecklist);
router.post('/tickets/:ticketId/checklist', requireTicketAccess('edit'), addChecklistItem);
router.put('/tickets/:ticketId/checklist/reorder', requireTicketAccess('edit'), reorderChecklist);
router.patch('/checklist/:id/toggle', requireTicketAccess('edit'), toggleChecklistItem);
router.patch('/checklist/:id', requireTicketAccess('edit'), updateChecklistItem);
router.delete('/checklist/:id', requireTicketAccess('edit'), deleteChecklistItem);

export default router;
