import { Router } from 'express';
import { authenticate, authorizeMaster } from '../../../shared/middleware/auth';
import * as whatsappController from './whatsapp.controller';
import baileysRoutes from './baileys.routes';
import { validate, sendWhatsAppMessageSchema } from '../../../shared/validation/schemas';

const router = Router();
router.use(authenticate);

// ── Baileys Provider (WebSocket, sem Chrome/Puppeteer) ───────────────
router.use('/baileys', baileysRoutes);

// ── Legacy single-connection status/ops ───────────────────────────────
router.get('/status', whatsappController.getStatus);
router.get('/qrcode', whatsappController.getQrCode);
router.get('/debug', authorizeMaster, whatsappController.getDebugStatus);
router.get('/subjects', whatsappController.getSubjects);
router.post('/connect', authorizeMaster, whatsappController.connect);
router.post('/disconnect', authorizeMaster, whatsappController.disconnect);
router.post('/clear-session', authorizeMaster, whatsappController.clearSessionEndpoint);
router.post('/reconnect', authorizeMaster, whatsappController.reconnectWhatsApp);

// ── Send message (used by Helpdesk, WhatsApp page, TicketDetail) ─────
router.post('/send', authorizeMaster, validate(sendWhatsAppMessageSchema), whatsappController.sendMessage);

// ── Tickets (WhatsApp-originated) ─────────────────────────────────────
router.get('/tickets', whatsappController.listTickets);
router.get('/tickets/:id', whatsappController.getTicket);
router.post('/tickets', whatsappController.createTicketFromChat);
router.post('/tickets/:id/close', authorizeMaster, whatsappController.closeTicket);
router.patch('/tickets/:id', authorizeMaster, whatsappController.updateTicket);
router.post('/tickets/:id/abrir', authorizeMaster, whatsappController.abrirChamado);
router.post('/tickets/:id/transferir', authorizeMaster, whatsappController.transferirTicket);
router.post('/tickets/:id/descartar', authorizeMaster, whatsappController.descartarTicket);
router.post('/tickets/:id/send', authorizeMaster, validate(sendWhatsAppMessageSchema), whatsappController.sendMessage);
router.get('/chats', whatsappController.listChats);

export default router;
