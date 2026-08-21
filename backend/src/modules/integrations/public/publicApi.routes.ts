import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { apiKeyAuth, requireWriteScope } from './publicApiAuth';
import {
  getClientes, getCliente, getEmpresas, getContratos,
  getTickets, getTicket, getAgentes, patchTicketStatus, patchCliente,
} from './publicApi.controller';

// ── API Pública de Integração — Rotas ───────────────────────────────────
// Permite que um sistema externo (ex.: CRM) consuma dados do Helpdesk.
// Auth: header `x-api-key` (INTEGRATION_API_KEYS). Rate limit dedicado.
// Escrita requer chave com sufixo ':rw'.

const router = Router();

const integracaoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições — limite de 120/min para a API de integração.' },
});

router.use(integracaoLimiter);
router.use(apiKeyAuth);

// ── Leitura ─────────────────────────────────────────────────────────────
router.get('/customers', getClientes);
router.get('/customers/:id', getCliente);
router.get('/companies', getEmpresas);
router.get('/contracts', getContratos);
router.get('/tickets', getTickets);
router.get('/tickets/:id', getTicket);
router.get('/agents', getAgentes);

// ── Escrita (requer chave :rw) ──────────────────────────────────────────
router.patch('/tickets/:id/status', requireWriteScope, patchTicketStatus);
router.patch('/customers/:id', requireWriteScope, patchCliente);

export default router;