import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import { auditLog } from '../../shared/middleware/audit';
import { auditLog as auditLogGeneric } from '../../shared/middleware/audit';
import {
  listClients, getClient, createClient, updateClient, deleteClient,
  listContacts, createContact,
  listOpportunities, createOpportunity, updateOpportunity,
  getPipeline,
  listThemes, createTheme, updateTheme, deleteTheme,
} from './crm.controller';
import {
  getColaboradoresPorCliente,
  postColaborador,
  putColaborador,
  deleteColaborador,
  postMarcarPrincipal,
} from './colaboradores.controller';

const router = Router();
router.use(authenticate);

router.get('/clients', listClients);
router.get('/clients/:id', getClient);
router.post('/clients', authorize('admin', 'gerente', 'comercial'), auditLog('criar_cliente', 'Client'), createClient);
router.put('/clients/:id', authorize('admin', 'gerente', 'comercial'), auditLog('editar_cliente', 'Client'), updateClient);
router.delete('/clients/:id', authorize('admin'), auditLog('deletar_cliente', 'Client'), deleteClient);

router.get('/clients/:clientId/contacts', listContacts);
router.post('/contacts', auditLog('criar_contato', 'Contact'), createContact);

router.get('/clients/:clientId/colaboradores', getColaboradoresPorCliente);
router.post('/clients/:clientId/colaboradores', authorize('admin', 'gerente', 'comercial'), auditLog('criar_colaborador', 'Colaborador'), postColaborador);
router.put('/colaboradores/:id', authorize('admin', 'gerente', 'comercial'), auditLog('editar_colaborador', 'Colaborador'), putColaborador);
router.delete('/colaboradores/:id', authorize('admin', 'gerente'), auditLog('deletar_colaborador', 'Colaborador'), deleteColaborador);
router.post('/colaboradores/:id/principal', postMarcarPrincipal);

router.get('/opportunities', listOpportunities);
router.post('/opportunities', authorize('admin', 'gerente', 'comercial'), auditLog('criar_oportunidade', 'Opportunity'), createOpportunity);
router.put('/opportunities/:id', authorize('admin', 'gerente', 'comercial'), auditLog('editar_oportunidade', 'Opportunity'), updateOpportunity);

router.get('/pipeline', getPipeline);

router.get('/temas', listThemes);
router.post('/temas', authorize('admin', 'gerente'), auditLogGeneric('criar_tema', 'HelpdeskConfig'), createTheme);
router.put('/temas/:id', authorize('admin', 'gerente'), auditLogGeneric('editar_tema', 'HelpdeskConfig'), updateTheme);
router.delete('/temas/:id', authorize('admin'), auditLogGeneric('deletar_tema', 'HelpdeskConfig'), deleteTheme);

export default router;
