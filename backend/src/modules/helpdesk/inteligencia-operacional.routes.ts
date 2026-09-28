import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  getInteligenciaCompleta,
  getResumoExecutivo,
  getAnaliseAssuntos,
  getRiscoClientes,
  getChamadosParados,
  getEscalonamento,
  getOportunidadesAutomacao,
  getPossiveisBugs,
  postSugerirClassificacao,
  postConfirmarClassificacao,
} from './inteligencia-operacional.controller';

const router = Router();
const adminOrManager = authorize('admin', 'gerente');

// ── Inteligência Operacional ────────────────────────────────────────────
// GET /api/helpdesk/inteligencia/completa       → Tudo junto (orquestrador)
// GET /api/helpdesk/inteligencia/resumo         → Resumo executivo
// GET /api/helpdesk/inteligencia/assuntos       → Análise por assunto
// GET /api/helpdesk/inteligencia/clientes       → Risco de clientes
// GET /api/helpdesk/inteligencia/progresso      → Chamados parados
// GET /api/helpdesk/inteligencia/escalonamento  → N1→N2→N3
// GET /api/helpdesk/inteligencia/automacao      → Oportunidades de automação
// GET /api/helpdesk/inteligencia/bugs           → Possíveis bugs
// POST /api/helpdesk/inteligencia/sugerir-nivel → Sugerir N1/N2/N3
// POST /api/helpdesk/inteligencia/confirmar-nivel → Confirmar classificação

router.get('/completa', authenticate, adminOrManager, getInteligenciaCompleta);
router.get('/resumo', authenticate, adminOrManager, getResumoExecutivo);
router.get('/assuntos', authenticate, adminOrManager, getAnaliseAssuntos);
router.get('/clientes', authenticate, adminOrManager, getRiscoClientes);
router.get('/progresso', authenticate, adminOrManager, getChamadosParados);
router.get('/escalonamento', authenticate, adminOrManager, getEscalonamento);
router.get('/automacao', authenticate, adminOrManager, getOportunidadesAutomacao);
router.get('/bugs', authenticate, adminOrManager, getPossiveisBugs);
router.post('/sugerir-nivel', authenticate, adminOrManager, postSugerirClassificacao);
router.post('/confirmar-nivel', authenticate, adminOrManager, postConfirmarClassificacao);

export default router;
