import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { env } from '../../../config/env';
import { AuthRequest } from '../../../shared/middleware/auth';
import {
  isClientConnected, getQrCodeData, getConnectionError,
  initializeClient, disconnectClient, clearSession,
  sendWhatsAppMessage, generateProtocolo, getChatsList,
  getClient, sendProtocolReply, SUBJECTS, classifyMessage, getSubjectLabel,
  getLastMessageAt, pingHeartbeat, getWhatsAppState,
} from './whatsapp.service';
import { whatsappConnectionManager } from './whatsapp.service';
import { baileysProviderService } from './baileys-provider.service';
import { whatsappWebJSProviderService } from './whatsapp-webjs.service';
import { evolutionApiService } from './evolution-api.service';
import { unifiedWhatsAppService } from './unified-whatsapp.service';
import path from 'path';
import { registrarInteracaoAgente } from '../../helpdesk/fcr.service';
import { avaliarMensagemAgente } from '../../ai/aiAgentMonitor.service';

async function autoMoveTicketOnAgentReply(ticketId: string, userId: string): Promise<void> {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { etapa: true, assigneeId: true } });
    if (!ticket) return;

    if (ticket.etapa === 'fila' || ticket.etapa === 'aguardando_cliente') {
      const updateData: any = {
        etapa: 'em_atendimento',
        dataInicioAtendimento: ticket.etapa === 'fila' ? new Date() : undefined,
        lastAgentMessageAt: new Date(),
        filaOrder: null,
      };
      if (!ticket.assigneeId) {
        updateData.assigneeId = userId;
        updateData.usuarioId = userId;
      }

      await prisma.ticket.update({ where: { id: ticketId }, data: updateData });

      await prisma.ticketStageEvent.create({
        data: {
          ticketId,
          etapaAnterior: ticket.etapa,
          etapaNova: 'em_atendimento',
          origem: 'automatico',
          usuarioId: userId,
        },
      });
    } else if (ticket.etapa === 'em_atendimento') {
      await prisma.ticket.update({ where: { id: ticketId }, data: { lastAgentMessageAt: new Date() } });
    }

    registrarInteracaoAgente({
      ticketId,
      usuarioId: userId,
      tipo: 'resposta_whatsapp',
    }).catch((e) => console.warn('[WhatsApp] FCR tracking falhou:', e?.message || e));
  } catch (err) {
    console.error('[WhatsApp] Erro auto-move:', err);
  }
}

function triggerAgentAIAudit(
  ticketId: string,
  userId: string,
  messageDbId: string,
  conteudoMensagem: string
): void {
  avaliarMensagemAgente(ticketId, userId, messageDbId, conteudoMensagem).catch((e) =>
    console.warn('[WhatsApp] AI audit falhou:', e?.message || e)
  );
}

export async function getStatus(req: Request, res: Response) {
  pingHeartbeat();
  const state = await getWhatsAppState();
  
  // Check Evolution API health
  let evolutionAvailable = false;
  let evolutionHealthy = false;
  try {
    evolutionAvailable = !!env.evolutionApiUrl;
    if (evolutionAvailable) {
      evolutionHealthy = await evolutionApiService.checkHealth();
    }
  } catch { /* ignore */ }

  // Check Cloud API availability
  const cloudAvailable = !!(env.whatsappCloudPhoneNumberId && env.whatsappCloudAccessToken);

  // Check WhatsAppWebJS health
  let whatsappWebJSConnected = false;
  try {
    const allWebJSStates = whatsappWebJSProviderService.getAllMultiStates();
    for (const [, state] of allWebJSStates) {
      if (state.connected) { whatsappWebJSConnected = true; break; }
    }
  } catch { /* ignore */ }

  return res.json({
    connected: isClientConnected(),
    qrCode: getQrCodeData(),
    error: getConnectionError(),
    ultimaMensagem: getLastMessageAt(),
    state,
    providers: {
      'baileys': { available: true, connected: isClientConnected() },
      'whatsapp-webjs': { available: true, connected: whatsappWebJSConnected },
      'evolution': { available: evolutionAvailable, connected: evolutionHealthy },
      'cloud': { available: cloudAvailable, connected: cloudAvailable },
    },
    activeProvider: unifiedWhatsAppService.getActiveProvider(),
  });
}

export async function getQrCode(req: Request, res: Response) {
  const qr = getQrCodeData();
  if (!qr) return res.json({ qrCode: null, message: isClientConnected() ? 'Cliente já conectado' : 'QR Code ainda não gerado' });
  return res.json({ qrCode: qr, message: 'Escaneie o QR Code com o WhatsApp' });
}

export async function connect(req: Request, res: Response) {
  if (isClientConnected()) return res.json({ message: 'WhatsApp ja conectado' });
  
  // Check if Evolution API is available and healthy
  const evolutionAvailable = !!env.evolutionApiUrl;
  let evolutionHealthy = false;
  try {
    if (evolutionAvailable) {
      evolutionHealthy = await evolutionApiService.checkHealth();
    }
  } catch { /* ignore */ }

  if (evolutionAvailable && evolutionHealthy) {
    return res.json({ 
      message: 'Use a Evolution API para conectar. Acesse /api/whatsapp/evolution/instance/connect/:instanceName',
      provider: 'evolution',
      hint: 'Evolution API detectada e saudavel. Use o endpoint Evolution para conectar.'
    });
  }

  try {
    await disconnectClient();
  } catch { /* ignore */ }
  initializeClient().catch(console.error);
  return res.json({ 
    message: 'Conexao WhatsApp iniciada via Baileys. Escaneie o QR Code.',
    provider: 'baileys'
  });
}

export async function disconnect(req: Request, res: Response) {
  await disconnectClient();
  return res.json({ message: 'WhatsApp desconectado' });
}

export async function clearSessionEndpoint(req: Request, res: Response) {
  await clearSession();
  return res.json({ message: 'Sessao WhatsApp limpa. Reconecte escaneando o QR Code.' });
}

export async function listTickets(req: AuthRequest, res: Response) {
  try {
    const { status, page = '1', limit = '20', orderBy = 'updatedAt_desc' } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (req.user?.role === 'tecnico') where.usuarioId = req.user.id;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const includeLastCliente = orderBy === 'lastMessageCliente_desc';
    const includeAny: any = {
      client: { select: { razaoSocial: true, nomeFantasia: true, telefone: true } },
      usuario: { select: { name: true } },
      _count: { select: { messages: true } },
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
    };

    const orderByMap: Record<string, any> = {
      updatedAt_desc: { updatedAt: 'desc' },
      updatedAt_asc: { updatedAt: 'asc' },
      dataAbertura_desc: { dataAbertura: 'desc' },
      dataAbertura_asc: { dataAbertura: 'asc' },
      contactName_asc: { contactName: 'asc' },
      contactName_desc: { contactName: 'desc' },
    };
    const prismaOrderBy = orderByMap[orderBy as string] || orderByMap.updatedAt_desc;

    const findArgs: any = {
      where,
      include: includeAny,
      skip,
      take: parseInt(limit as string),
      orderBy: prismaOrderBy,
    };

    let tickets = await prisma.ticket.findMany(findArgs);

    if (orderBy === 'lastMessage_desc' || orderBy === 'lastMessageCliente_desc') {
      const isCliente = orderBy === 'lastMessageCliente_desc';
      const enriched = await Promise.all(
        tickets.map(async (t) => {
          const msg = await prisma.message.findFirst({
            where: { ticketId: t.id, ...(isCliente ? { fromMe: false } : {}) },
            orderBy: { sentAt: 'desc' },
            select: { sentAt: true },
          });
          return { t, lastAt: msg?.sentAt?.getTime() || 0 };
        })
      );
      enriched.sort((a, b) => b.lastAt - a.lastAt);
      tickets = enriched.map((e) => e.t);
    }

    const total = await prisma.ticket.count({ where });
    return res.json({ tickets, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    console.error('[WhatsApp] Erro ao listar tickets:', error);
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
    const { contactName, contactPhone, clientId, assunto, usuarioId, departamentoId } = req.body;
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
        etapa: departamentoId ? 'fila' : 'triagem',
        canal: 'whatsapp',
        departamentoId: departamentoId || null,
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
    if (c) state = typeof c.getState === 'function' ? await c.getState() : 'connected';
  } catch (err: any) {
    state = `erro: ${err?.message || err}`;
  }
  return res.json({
    connected: isClientConnected(),
    qrCode: getQrCodeData() ? 'QR code present' : null,
    error: getConnectionError(),
    clientExists: getClient() !== null,
    state,
    ultimaMensagem: getLastMessageAt(),
    provider: 'baileys',
  });
}

export async function reconnectWhatsApp(req: AuthRequest, res: Response) {
  try {
    await disconnectClient();
    initializeClient().catch((e) => console.error('[WhatsApp] reconnect error:', e?.message || e));
    return res.json({ message: 'Reconexao iniciada. Verifique o QR Code.' });
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

    const etapaAnterior = ticket.etapa;
    await prisma.ticket.update({
      where: { id },
      data: {
        status: 'fechado',
        etapa: 'concluido',
        dataFechamento: new Date(),
        dataConclusao: new Date(),
        usuarioId: req.user?.id,
      },
    });

    await prisma.ticketStageEvent.create({
      data: {
        ticketId: id,
        etapaAnterior,
        etapaNova: 'concluido',
        origem: 'manual',
        usuarioId: req.user?.id,
      },
    });

    if (ticket.contactPhone && ticket.protocolo) {
      sendProtocolReply(ticket.contactPhone, ticket.protocolo, 'fechamento').catch(console.error);
    }

    const { enviarCsatImediatamente } = await import('../../csat/csat.service');
    enviarCsatImediatamente(id).catch((e) =>
      console.warn('[WhatsApp] Falha ao enviar CSAT imediatamente:', e?.message || e)
    );

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
    const { assunto, categoria, prioridade, tipo, observacoes, clientId, departamentoId } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });

    console.log(`[WhatsApp] abrirChamado chamado: ticket=${id}, user=${req.user.id}, assunto=${assunto}`);
    const { abrirChamadoPorAtendente } = await import('../../helpdesk/triagem.service');
    const result = await abrirChamadoPorAtendente(id, req.user.id, {
      assunto,
      categoria,
      prioridade,
      tipo,
      observacoes,
      clientId,
      departamentoId,
    });
    console.log(`[WhatsApp] abrirChamado resultado: ok=${result.ok}, error=${(result as any).error || 'nenhum'}`);
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

export async function descartarTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket nao encontrado' });
    if (ticket.etapa === 'descartado') {
      return res.status(409).json({ error: 'Ticket ja foi descartado' });
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        etapa: 'descartado',
        status: 'cancelado',
        dataConclusao: new Date(),
        usuarioId: req.user.id,
      },
    });

    await prisma.ticketStageEvent.create({
      data: {
        ticketId: id,
        etapaAnterior: ticket.etapa,
        etapaNova: 'descartado',
        origem: 'manual',
        usuarioId: req.user.id,
        mensagemAutomatica: 'nao_enviada',
      },
    });

    return res.json({ ticket: updated, autoMessage: { sent: false, reason: 'ticket_descartado_sem_mensagem' } });
  } catch (error: any) {
    console.error('[WhatsApp] Erro ao descartar ticket:', error?.message || error);
    return res.status(500).json({ error: 'Erro ao descartar ticket' });
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
    const { to, message: rawMessage, ticketId, whatsappConnectionId } = req.body;
    if (!rawMessage || !rawMessage.trim()) return res.status(400).json({ error: 'Mensagem é obrigatória' });

    // Fetch agent signature and append to message
    let message = rawMessage;
    if (req.user?.id) {
      const agent = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true, signature: true },
      });
      if (agent?.signature) {
        message = `${rawMessage}\n\n_${agent.name}\n${agent.signature}_`;
      }
    }

    // Resolve phone from ticket if not provided
    let phone = to;
    let contactJid: string | null = null;
    if (!phone && ticketId) {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { contactPhone: true, contactJid: true } });
      if (ticket?.contactPhone) {
        phone = ticket.contactPhone.replace(/[^\d]/g, '');
      }
      contactJid = ticket?.contactJid || null;
    } else if (ticketId) {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { contactJid: true } });
      contactJid = ticket?.contactJid || null;
    }
    if (!phone) return res.status(400).json({ error: 'Destinatário é obrigatório (to ou ticketId com telefone)' });

    // Try Baileys first (WebSocket, no Chrome needed)
    if (whatsappConnectionId) {
      const baileysState = baileysProviderService.getMultiState(whatsappConnectionId);
      if (baileysState?.connected && baileysState.socket) {
        const result = await baileysProviderService.sendTextMulti(whatsappConnectionId, phone, message, contactJid || undefined);
        if (!result.success) return res.status(500).json({ error: result.error || 'Falha ao enviar via Baileys' });

        if (ticketId) {
          const msgDb = await prisma.message.create({
            data: {
              ticketId,
              fromMe: true,
              content: rawMessage,
              source: 'agent',
              usuarioId: req.user?.id,
            },
          });
          if (req.user?.id) await autoMoveTicketOnAgentReply(ticketId, req.user.id);
          if (req.user?.id && ticketId) triggerAgentAIAudit(ticketId, req.user.id, msgDb.id, rawMessage);
        }
        return res.json({ success: true, message: 'Mensagem enviada com sucesso', provider: 'baileys' });
      }

      // Fallback to Baileys multi-connection
      const rt = whatsappConnectionManager.getConnectionRuntime(whatsappConnectionId);
      if (!rt?.connected) {
        return res.status(503).json({ error: 'A conexao WhatsApp selecionada nao esta conectada.' });
      }
    } else {
      // No specific connection — try Baileys legacy first
      if (baileysProviderService.isLegacyConnected()) {
        const result = await baileysProviderService.sendTextLegacy(phone, message, contactJid || undefined);
        if (!result.success) return res.status(500).json({ error: result.error || 'Falha ao enviar via Baileys' });

        if (ticketId) {
          const msgDb = await prisma.message.create({
            data: {
              ticketId,
              fromMe: true,
              content: rawMessage,
              source: 'agent',
              usuarioId: req.user?.id,
            },
          });
          if (req.user?.id) await autoMoveTicketOnAgentReply(ticketId, req.user.id);
          if (req.user?.id && ticketId) triggerAgentAIAudit(ticketId, req.user.id, msgDb.id, rawMessage);
        }
        return res.json({ success: true, message: 'Mensagem enviada com sucesso', provider: 'baileys' });
      }

      // Try any connected Baileys multi-connection
      const allBaileysStates = baileysProviderService.getAllMultiStates();
      for (const [connId, state] of allBaileysStates) {
        if (state.connected && state.socket) {
          const result = await baileysProviderService.sendTextMulti(connId, phone, message, contactJid || undefined);
          if (!result.success) continue;

          if (ticketId) {
            const msgDb = await prisma.message.create({
              data: {
                ticketId,
                fromMe: true,
                content: rawMessage,
                source: 'agent',
                usuarioId: req.user?.id,
              },
            });
            if (req.user?.id) await autoMoveTicketOnAgentReply(ticketId, req.user.id);
            if (req.user?.id && ticketId) triggerAgentAIAudit(ticketId, req.user.id, msgDb.id, rawMessage);
          }
          return res.json({ success: true, message: 'Mensagem enviada com sucesso', provider: 'baileys', connectionId: connId });
        }
      }

      // Try any connected WhatsAppWebJS multi-connection
      const allWebJSStates = whatsappWebJSProviderService.getAllMultiStates();
      for (const [connId, state] of allWebJSStates) {
        if (state.connected && state.client) {
          const result = await whatsappWebJSProviderService.sendTextMulti(connId, phone, message);
          if (!result.success) continue;

          if (ticketId) {
            const msgDb = await prisma.message.create({
              data: {
                ticketId,
                fromMe: true,
                content: rawMessage,
                source: 'agent',
                usuarioId: req.user?.id,
              },
            });
            if (req.user?.id) await autoMoveTicketOnAgentReply(ticketId, req.user.id);
            if (req.user?.id && ticketId) triggerAgentAIAudit(ticketId, req.user.id, msgDb.id, rawMessage);
          }
          return res.json({ success: true, message: 'Mensagem enviada com sucesso', provider: 'whatsapp-webjs', connectionId: connId });
        }
      }

      // Fallback to Baileys legacy
      if (!isClientConnected()) {
        const allStatus = whatsappConnectionManager.getAllConnectionsStatus();
        const connected = allStatus.find(c => c.connected);
        if (!connected) {
          return res.status(503).json({ error: 'WhatsApp não está conectado. Conecte-se antes de enviar mensagens.' });
        }
      }
    }

    const result = await sendWhatsAppMessage(phone, message, whatsappConnectionId);
    if (!result.success) return res.status(500).json({ error: result.error || 'Falha ao enviar mensagem WhatsApp' });

    if (ticketId) {
      const msgDb = await prisma.message.create({
        data: {
          ticketId,
          fromMe: true,
          content: message,
          source: 'agent',
          usuarioId: req.user?.id,
        },
      });
      if (req.user?.id) await autoMoveTicketOnAgentReply(ticketId, req.user.id);
      if (req.user?.id && ticketId) triggerAgentAIAudit(ticketId, req.user.id, msgDb.id, rawMessage);
    }

    return res.json({ success: true, message: 'Mensagem enviada com sucesso', provider: 'baileys' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}
