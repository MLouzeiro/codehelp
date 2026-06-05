import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { AuthRequest } from '../../../shared/middleware/auth';
import {
  isClientConnected, getQrCodeData, getConnectionError,
  initializeClient, disconnectClient,
  sendWhatsAppMessage, generateProtocolo, getChatsList,
  getClient, sendProtocolReply, SUBJECTS, classifyMessage, getSubjectLabel,
  getLastMessageAt, pingHeartbeat, getWhatsAppState,
} from './whatsapp.service';
import path from 'path';

export async function getStatus(req: Request, res: Response) {
  pingHeartbeat();
  const state = await getWhatsAppState();
  return res.json({
    connected: isClientConnected(),
    qrCode: getQrCodeData(),
    error: getConnectionError(),
    ultimaMensagem: getLastMessageAt(),
    state,
  });
}

export async function getQrCode(req: Request, res: Response) {
  const qr = getQrCodeData();
  if (!qr) return res.json({ qrCode: null, message: isClientConnected() ? 'Cliente já conectado' : 'QR Code ainda não gerado' });
  return res.json({ qrCode: qr, message: 'Escaneie o QR Code com o WhatsApp' });
}

export async function connect(req: Request, res: Response) {
  if (isClientConnected()) return res.json({ message: 'WhatsApp já conectado' });
  try {
    await disconnectClient();
  } catch { /* ignore */ }
  initializeClient().catch(console.error);
  return res.json({ message: 'Iniciando conexão WhatsApp. Verifique o QR Code.' });
}

export async function disconnect(req: Request, res: Response) {
  await disconnectClient();
  return res.json({ message: 'WhatsApp desconectado' });
}

export async function listTickets(req: AuthRequest, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (req.user?.role === 'tecnico') where.usuarioId = req.user.id;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          client: { select: { razaoSocial: true, nomeFantasia: true, telefone: true } },
          usuario: { select: { name: true } },
          _count: { select: { messages: true } },
          messages: { orderBy: { sentAt: 'desc' }, take: 1 },
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.ticket.count({ where }),
    ]);
    return res.json({ tickets, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar tickets' });
  }
}

export async function getTicket(req: AuthRequest, res: Response) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        usuario: { select: { name: true } },
        messages: { orderBy: { sentAt: 'asc' } },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const serviceOrders = await prisma.serviceOrder.findMany({
      where: { ticketId: ticket.id },
      select: { id: true, numeroOs: true, status: true },
    });

    return res.json({ ...ticket, serviceOrders });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar ticket' });
  }
}

export async function createTicketFromChat(req: AuthRequest, res: Response) {
  try {
    const { contactName, contactPhone, clientId, assunto, usuarioId } = req.body;
    if (!contactName || !contactPhone) return res.status(400).json({ error: 'Nome e telefone do contato são obrigatórios' });

    const phoneDigits = contactPhone.replace(/[^\d]/g, '');
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { contactPhone: phoneDigits },
          { contactPhone: { contains: phoneDigits.slice(-11) } },
        ],
        status: { not: 'fechado' },
      },
    });
    if (existingTicket) return res.status(409).json({ error: 'Já existe um ticket aberto para este contato', ticket: existingTicket });

    const protocolo = await generateProtocolo();
    const categoria = assunto ? classifyMessage(assunto) : 'outro';
    const ticket = await prisma.ticket.create({
      data: {
        protocolo, contactName, contactPhone: phoneDigits, clientId,
        assunto: assunto || getSubjectLabel(categoria),
        categoria,
        usuarioId: usuarioId || req.user?.id,
        status: 'aberto',
        etapa: 'fila',
        canal: 'whatsapp',
      },
    });

    sendProtocolReply(ticket.contactPhone || '', protocolo, 'abertura').catch(console.error);

    return res.status(201).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar ticket' });
  }
}

export async function getDebugStatus(req: Request, res: Response) {
  let state: string | null = null;
  try {
    const c = getClient();
    if (c) state = await c.getState();
  } catch (err: any) {
    state = `erro: ${err?.message || err}`;
  }
  return res.json({
    connected: isClientConnected(),
    qrCode: getQrCodeData() ? 'QR code present' : null,
    error: getConnectionError(),
    chromePath: env.whatsappChromePath || '(auto)',
    sessionPath: path.resolve(__dirname, '../../../../whatsapp-session'),
    clientExists: getClient() !== null,
    state,
    ultimaMensagem: getLastMessageAt(),
    whatsappWebJsVersion: (() => { try { return require('whatsapp-web.js/package.json').version; } catch { return 'unknown'; } })(),
  });
}

export async function reconnectWhatsApp(req: AuthRequest, res: Response) {
  try {
    await disconnectClient();
    setTimeout(() => {
      initializeClient().catch((e) => console.error('[WhatsApp] reconnect error:', e?.message || e));
    }, 1000);
    return res.json({ message: 'Reconexão iniciada. Verifique o QR Code.' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao reconectar' });
  }
}

export async function listChats(req: Request, res: Response) {
  try {
    const chats = await getChatsList();
    return res.json(chats);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar chats' });
  }
}

export async function closeTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    if (ticket.status === 'fechado') return res.status(400).json({ error: 'Ticket já está fechado' });

    await prisma.ticket.update({
      where: { id },
      data: { status: 'fechado', dataFechamento: new Date(), usuarioId: req.user?.id },
    });

    if (ticket.contactPhone && ticket.protocolo) {
      sendProtocolReply(ticket.contactPhone, ticket.protocolo, 'fechamento').catch(console.error);
    }

    return res.json({ message: 'Ticket fechado com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao fechar ticket' });
  }
}

export async function updateTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { assunto, categoria, usuarioId, status } = req.body;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const data: any = {};
    if (assunto !== undefined) data.assunto = assunto;
    if (categoria !== undefined) data.categoria = categoria;
    if (usuarioId !== undefined) data.usuarioId = usuarioId;
    if (status !== undefined) {
      data.status = status;
      if (status === 'fechado') data.dataFechamento = new Date();
    }

    const updated = await prisma.ticket.update({ where: { id }, data });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar ticket' });
  }
}

export async function abrirChamado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { assunto, categoria, prioridade, tipo, observacoes } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });

    const { abrirChamadoPorAtendente } = await import('../../helpdesk/triagem.service');
    const result = await abrirChamadoPorAtendente(id, req.user.id, {
      assunto,
      categoria,
      prioridade,
      tipo,
      observacoes,
    });
    if (!result.ok) {
      const status = result.error === 'Ticket nao encontrado' ? 404
        : result.error === 'Ticket ja triado' ? 409
        : 400;
      return res.status(status).json({ error: result.error, ticket: (result as any).ticket });
    }
    return res.json(result.ticket);
  } catch (error: any) {
    console.error('[WhatsApp] Erro ao abrir chamado:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao abrir chamado' });
  }
}

export async function transferirTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { paraUsuarioId, motivo } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });
    if (!paraUsuarioId) return res.status(400).json({ error: 'paraUsuarioId obrigatorio' });
    if (paraUsuarioId === req.user.id) {
      return res.status(400).json({ error: 'Voce ja e o responsavel atual' });
    }

    const target = await prisma.user.findUnique({ where: { id: paraUsuarioId } });
    if (!target) return res.status(404).json({ error: 'Usuario destino nao encontrado' });

    const { transferirTicket: doTransferir } = await import('../../helpdesk/triagem.service');
    const result = await doTransferir(id, req.user.id, paraUsuarioId, motivo);
    if (!result.ok) {
      const status = result.error === 'Ticket nao encontrado' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    return res.json(result.ticket);
  } catch (error: any) {
    console.error('[WhatsApp] Erro ao transferir ticket:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao transferir ticket' });
  }
}

export async function getSubjects(req: Request, res: Response) {
  return res.json(SUBJECTS);
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { to, message, ticketId } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'Destinatário e mensagem são obrigatórios' });

    if (!isClientConnected()) {
      return res.status(503).json({ error: 'WhatsApp não está conectado. Conecte-se antes de enviar mensagens.' });
    }

    const result = await sendWhatsAppMessage(to, message);
    if (!result.success) return res.status(500).json({ error: result.error || 'Falha ao enviar mensagem WhatsApp' });

    if (ticketId) {
      await prisma.message.create({
        data: {
          ticketId,
          fromMe: true,
          content: message,
          usuarioId: req.user?.id,
        },
      });
    }

    return res.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}
