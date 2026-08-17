import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  postAuditarTicket,
  getAuditoriaTicket,
  getAuditoriaByIdHandler,
  getListarAuditorias,
  postRevisarAuditoria,
  getMetaAuditoria,
  getPanoramaHandler,
  getEvolucaoHandler,
  getTomadaDecisaoHandler,
  getFilaAuditoriaHandler,
  postAuditarAmostraHandler,
  getRelatorioTicketHandler,
  getRelatorioConsolidadoHandler,
  getExportarAuditoriaCsvHandler,
  getExportarAuditoriaExcelHandler,
} from './auditoriaProfissional.controller';

const router = Router();

router.use(authenticate);

router.post('/ticket/:id', authorize('admin', 'gerente'), postAuditarTicket);
router.get('/ticket/:ticketId', authorize('admin', 'gerente'), getAuditoriaTicket);
router.get('/list', authorize('admin', 'gerente'), getListarAuditorias);
router.get('/meta', authorize('admin', 'gerente'), getMetaAuditoria);
router.get('/panorama', authorize('admin', 'gerente'), getPanoramaHandler);
router.get('/decisao', authorize('admin', 'gerente'), getTomadaDecisaoHandler);
router.get('/fila', authorize('admin', 'gerente'), getFilaAuditoriaHandler);
router.post('/amostra', authorize('admin', 'gerente'), postAuditarAmostraHandler);
router.get('/relatorio/consolidado', authorize('admin', 'gerente'), getRelatorioConsolidadoHandler);
router.get('/relatorio/:id', authorize('admin', 'gerente'), getRelatorioTicketHandler);
router.get('/exportar/csv', authorize('admin', 'gerente'), getExportarAuditoriaCsvHandler);
router.get('/exportar/excel', authorize('admin', 'gerente'), getExportarAuditoriaExcelHandler);
router.get('/evolucao/:id', authorize('admin', 'gerente'), getEvolucaoHandler);
router.get('/:id', authorize('admin', 'gerente'), getAuditoriaByIdHandler);
router.post('/:id/revisar', authorize('admin', 'gerente'), postRevisarAuditoria);

export default router;
