import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getRelatorioAnalitico,
  getRelatorioCsv,
  getRelatorioPdf,
  getRelatorioExcel,
  getRelatorioHtml,
  getOpcoesFiltros,
} from './relatorios.controller';

const router = Router();
router.use(authenticate);

router.get('/relatorios', authorize('admin', 'gerente'), getRelatorioAnalitico);
router.get('/relatorios/csv', authorize('admin', 'gerente'), getRelatorioCsv);
router.get('/relatorios/pdf', authorize('admin', 'gerente'), getRelatorioPdf);
router.get('/relatorios/excel', authorize('admin', 'gerente'), getRelatorioExcel);
router.get('/relatorios/html', authorize('admin', 'gerente'), getRelatorioHtml);
router.get('/relatorios/opcoes', authorize('admin', 'gerente'), getOpcoesFiltros);

export default router;