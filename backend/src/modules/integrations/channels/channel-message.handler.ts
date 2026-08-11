import prisma from '../../../config/database';

export interface ChannelMessageInput {
  channelId: string;
  ticketId?: string;
  externalId?: string;
  fromMe: boolean;
  contactName?: string;
  contactId?: string;
  content?: string;
  mediaUrl?: string;
  mimeType?: string;
  status?: string;
  rawPayload?: string;
}

export async function processIncomingMessage(input: ChannelMessageInput): Promise<{ ticketId: string; messageId: string }> {
  const channel = await prisma.channel.findUnique({ where: { id: input.channelId } });
  if (!channel) throw new Error('Canal nao encontrado');

  // Find or create ticket
  let ticket;
  if (input.ticketId) {
    ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId } });
  }

  if (!ticket && input.externalId) {
    ticket = await prisma.ticket.findFirst({
      where: {
        channelId: input.channelId,
        externalId: input.externalId,
      },
    });
  }

  if (!ticket) {
    // Create new ticket
    ticket = await prisma.ticket.create({
      data: {
        canal: channel.tipo,
        channelId: input.channelId,
        externalId: input.externalId,
        contactName: input.contactName || `Contact ${input.contactId || 'Unknown'}`,
        contactPhone: input.contactId,
        status: 'aberto',
        etapa: 'fila',
        prioridade: 'media',
      },
    });
  }

  // Store message
  const message = await prisma.channelMessage.create({
    data: {
      channelId: input.channelId,
      ticketId: ticket.id,
      externalId: input.externalId,
      fromMe: input.fromMe,
      contactName: input.contactName,
      contactId: input.contactId,
      content: input.content,
      mediaUrl: input.mediaUrl,
      mimeType: input.mimeType,
      status: input.status || (input.fromMe ? 'sent' : 'received'),
      rawPayload: input.rawPayload,
    },
  });

  // Update ticket last message timestamp
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });

  console.log(`[ChannelHandler] Mensagem processada: canal=${channel.tipo}, ticket=${ticket.id}, fromMe=${input.fromMe}`);

  return { ticketId: ticket.id, messageId: message.id };
}

export async function sendMessage(channelId: string, ticketId: string, content: string, mediaUrl?: string): Promise<{ messageId: string; success: boolean }> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error('Canal nao encontrado');

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket nao encontrado');

  // Route to appropriate provider based on channel type
  switch (channel.tipo) {
    case 'email':
      return sendEmailMessage(channelId, ticket, content, mediaUrl);
    case 'instagram':
      return sendInstagramMessage(channelId, ticket, content, mediaUrl);
    case 'facebook':
      return sendFacebookMessage(channelId, ticket, content, mediaUrl);
    case 'whatsapp':
      return sendWhatsAppMessage(channelId, ticket, content, mediaUrl);
    case 'telegram':
      return sendTelegramMessage(channelId, ticket, content, mediaUrl);
    default:
      throw new Error(`Canal ${channel.tipo} nao suportado para envio`);
  }
}

async function sendEmailMessage(channelId: string, ticket: any, content: string, mediaUrl?: string) {
  // Import email service dynamically
  const { sendEmail } = await import('../email/email.service');
  
  const result = await sendEmail({
    channelId,
    to: ticket.contactPhone || ticket.externalId || '',
    subject: ticket.assunto || `Re: Ticket ${ticket.protocolo}`,
    text: content,
    ticketId: ticket.id,
  });

  return { messageId: result.messageId, success: result.success };
}

async function sendInstagramMessage(channelId: string, ticket: any, content: string, mediaUrl?: string) {
  const { sendInstagramMessage } = await import('../instagram/instagram.service');
  
  const result = await sendInstagramMessage({
    channelId,
    recipientId: ticket.externalId || '',
    text: content,
    mediaUrl,
    ticketId: ticket.id,
  });

  return { messageId: result.messageId, success: result.success };
}

async function sendFacebookMessage(channelId: string, ticket: any, content: string, mediaUrl?: string) {
  const { sendFacebookMessage } = await import('../facebook/facebook.service');
  
  const result = await sendFacebookMessage({
    channelId,
    recipientId: ticket.externalId || '',
    text: content,
    mediaUrl,
    ticketId: ticket.id,
  });

  return { messageId: result.messageId, success: result.success };
}

async function sendWhatsAppMessage(channelId: string, ticket: any, content: string, mediaUrl?: string) {
  // Use existing WhatsApp unified service
  const { unifiedWhatsAppService } = await import('../whatsapp/unified-whatsapp.service');
  
  const phone = ticket.contactPhone || ticket.externalId;
  if (!phone) throw new Error('Telefone do contato nao encontrado');

  let result;
  if (mediaUrl) {
    const mediaResult = await unifiedWhatsAppService.sendMedia(phone, mediaUrl, content);
    result = { success: mediaResult.success, messageId: '' };
  } else {
    result = await unifiedWhatsAppService.sendMessage({
      to: phone,
      message: content,
    });
  }

  return { messageId: result.messageId || '', success: result.success };
}

async function sendTelegramMessage(channelId: string, ticket: any, content: string, mediaUrl?: string) {
  const { sendTelegramMessage } = await import('../telegram/telegram.service');
  
  const chatId = ticket.externalId || ticket.contactPhone;
  if (!chatId) throw new Error('Chat ID do contato nao encontrado');

  const result = await sendTelegramMessage({
    channelId,
    chatId,
    text: content,
    mediaUrl,
    ticketId: ticket.id,
  });

  return { messageId: result.messageId, success: result.success };
}

export async function getChannelMessages(channelId: string, ticketId?: string, limit = 50, offset = 0) {
  const where: any = { channelId };
  if (ticketId) where.ticketId = ticketId;

  const [messages, total] = await Promise.all([
    prisma.channelMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.channelMessage.count({ where }),
  ]);

  return { messages, total, hasMore: offset + limit < total };
}

export async function updateMessageStatus(messageId: string, status: string) {
  return prisma.channelMessage.update({
    where: { id: messageId },
    data: { status },
  });
}

export async function getChannelStats(channelId: string) {
  const [totalMessages, messagesByType, recentMessages] = await Promise.all([
    prisma.channelMessage.count({ where: { channelId } }),
    prisma.channelMessage.groupBy({
      by: ['status'],
      where: { channelId },
      _count: { id: true },
    }),
    prisma.channelMessage.count({
      where: {
        channelId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    totalMessages,
    messagesByStatus: messagesByType.reduce((acc, item) => {
      acc[item.status || 'unknown'] = item._count.id;
      return acc;
    }, {} as Record<string, number>),
    messagesLast24h: recentMessages,
  };
}
