import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { auditLog } from '../../shared/middleware/audit';
import {
  listClients, getClient, createClient, updateClient, deleteClient,
  listContacts, createContact,
  listOpportunities, createOpportunity, updateOpportunity,
  getPipeline
} from './crm.controller';

const router = Router();
router.use(authenticate);

router.get('/clients', listClients);
router.get('/clients/:id', getClient);
router.post('/clients', authorize('admin', 'gerente', 'comercial'), auditLog('criar_cliente', 'Client'), createClient);
router.put('/clients/:id', authorize('admin', 'gerente', 'comercial'), auditLog('editar_cliente', 'Client'), updateClient);
router.delete('/clients/:id', authorize('admin'), auditLog('deletar_cliente', 'Client'), deleteClient);

router.get('/clients/:clientId/contacts', listContacts);
router.post('/contacts', auditLog('criar_contato', 'Contact'), createContact);

router.get('/opportunities', listOpportunities);
router.post('/opportunities', authorize('admin', 'gerente', 'comercial'), auditLog('criar_oportunidade', 'Opportunity'), createOpportunity);
router.put('/opportunities/:id', authorize('admin', 'gerente', 'comercial'), auditLog('editar_oportunidade', 'Opportunity'), updateOpportunity);

router.get('/pipeline', getPipeline);

export default router;
