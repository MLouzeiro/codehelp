import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getChecklistTemplates,
  createChecklistTemplateHandler,
  updateChecklistTemplateHandler,
  deleteChecklistTemplateHandler,
  importarTemplateTicketHandler,
  importarTemplateKanbanHandler,
} from './checklist-template.controller';

const router = Router();
router.use(authenticate);

router.get('/checklist-templates', getChecklistTemplates);
router.post('/checklist-templates', authorize('admin', 'gerente', 'tecnico'), createChecklistTemplateHandler);
router.put('/checklist-templates/:id', authorize('admin', 'gerente'), updateChecklistTemplateHandler);
router.delete('/checklist-templates/:id', authorize('admin', 'gerente'), deleteChecklistTemplateHandler);
router.post('/checklist-templates/:templateId/import-ticket', importarTemplateTicketHandler);
router.post('/checklist-templates/:templateId/import-kanban', importarTemplateKanbanHandler);

export default router;
