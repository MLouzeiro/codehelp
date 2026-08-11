import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import {
  listBillings,
  upsertBillingHandler,
  getBillingHistoryHandler,
  calcularHandler,
  gerarPendenciasHandler,
  listPendenciasHandler,
  resolverPendenciaHandler,
  dashboardHandler,
} from './billing.controller';

const router = Router();
router.use(authenticate);

// ── CRUD por Cliente ───────────────────────────────────────────────
router.get('/clients/:clientId/billing', listBillings);
router.post('/clients/:clientId/billing', authorize('admin', 'financeiro', 'gerente'), upsertBillingHandler);
router.get('/clients/:clientId/billing/history', getBillingHistoryHandler);

// ── Calculo Mensal ─────────────────────────────────────────────────
router.get('/billing/calcular', calcularHandler);
router.post('/billing/gerar-pendencias', authorize('admin', 'financeiro'), gerarPendenciasHandler);

// ── Pendencias ─────────────────────────────────────────────────────
router.get('/billing/pendencias', listPendenciasHandler);
router.post('/billing/pendencias/:id/resolver', authorize('admin', 'financeiro', 'gerente'), resolverPendenciaHandler);

// ── Dashboard ──────────────────────────────────────────────────────
router.get('/billing/dashboard', dashboardHandler);

export default router;
