import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../shared/middleware/auth';
import {
  getDepartamentos, postDepartamento, putDepartamento, toggleDepartamentoHandler,
  getNiveis, postNivel, putNivel, toggleNivelHandler,
} from './departamentos.controller';

const router = Router();
router.use(authenticate);

// ── Departamentos ──────────────────────────────────────────────
router.get('/departamentos', getDepartamentos);
router.post('/departamentos', authorizeMaster, postDepartamento);
router.put('/departamentos/:id', authorizeMaster, putDepartamento);
router.patch('/departamentos/:id/toggle', authorizeMaster, toggleDepartamentoHandler);

// ── Níveis de Suporte ──────────────────────────────────────────
router.get('/niveis', getNiveis);
router.post('/niveis', authorizeMaster, postNivel);
router.put('/niveis/:id', authorizeMaster, putNivel);
router.patch('/niveis/:id/toggle', authorizeMaster, toggleNivelHandler);

export default router;
