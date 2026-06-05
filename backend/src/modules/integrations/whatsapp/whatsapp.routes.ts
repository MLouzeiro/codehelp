import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import {
  getStatus, getQrCode, connect, disconnect,
  listTickets, getTicket, sendMessage,
  createTicketFromChat, listChats, getDebugStatus,
  closeTicket, updateTicket, getSubjects, reconnectWhatsApp,
  abrirChamado, transferirTicket, descartarTicket,
} from './whatsapp.controller';

const router = Router();

router.get('/status', authenticate, getStatus);
router.get('/qrcode', authenticate, getQrCode);
router.get('/debug', getDebugStatus);
router.get('/subjects', authenticate, getSubjects);
router.post('/connect', authenticate, authorize('admin', 'gerente'), connect);
router.post('/disconnect', authenticate, authorize('admin', 'gerente'), disconnect);
router.post('/reconnect', authenticate, authorize('admin', 'gerente'), reconnectWhatsApp);

router.get('/tickets', authenticate, listTickets);
router.get('/tickets/:id', authenticate, getTicket);
router.post('/tickets', authenticate, createTicketFromChat);
router.post('/tickets/:id/close', authenticate, authorize('admin', 'gerente', 'tecnico'), closeTicket);
router.patch('/tickets/:id', authenticate, authorize('admin', 'gerente', 'tecnico'), updateTicket);
router.post('/tickets/:id/abrir', authenticate, authorize('admin', 'gerente', 'tecnico'), abrirChamado);
router.post('/tickets/:id/transferir', authenticate, authorize('admin', 'gerente', 'tecnico'), transferirTicket);
router.post('/tickets/:id/descartar', authenticate, authorize('admin', 'gerente', 'tecnico'), descartarTicket);
router.get('/chats', authenticate, listChats);
router.post('/send', authenticate, authorize('admin', 'gerente', 'tecnico'), sendMessage);

export default router;
