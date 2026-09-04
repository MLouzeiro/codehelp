import prisma from '../../../config/database';

export interface FacebookConfig {
  pageAccessToken: string;
  pageId: string;
  appSecret: string;
  verifyToken: string;
}

export interface SendFacebookMessageInput {
  channelId: string;
  recipientId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  ticketId?: string;
}

export async function getFacebookConfig(channelId: string): Promise<FacebookConfig | null> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.tipo !== 'facebook' || !channel.config) return null;

  try {
    return JSON.parse(channel.config) as FacebookConfig;
  } catch {
    return null;
  }
}

export async function sendFacebookMessage(input: SendFacebookMessageInput): Promise<{ messageId: string; success: boolean }> {
  const config = await getFacebookConfig(input.channelId);
  if (!config) throw new Error('Configuracao do Facebook nao encontrada');

  try {
    const baseUrl = 'https://graph.facebook.com/v18.0/me/messages';

    let requestBody: any = {
      recipient: { id: input.recipientId },
      messaging_type: 'RESPONSE',
      access_token: config.pageAccessToken,
    };

    if (input.text) {
      requestBody.message = { text: input.text };
    } else if (input.mediaUrl) {
      requestBody.message = {
        attachment: {
          type: input.mediaType || 'image',
          payload: { url: input.mediaUrl },
        },
      };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json() as {
      error?: { message?: string };
      message_id?: string;
    };

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao enviar mensagem Facebook');
    }

    // Store sent message
    await prisma.channelMessage.create({
      data: {
        channelId: input.channelId,
        ticketId: input.ticketId,
        fromMe: true,
        contactName: input.recipientId,
        content: input.text || `[${input.mediaType || 'media'}]`,
        mediaUrl: input.mediaUrl,
        status: 'sent',
        externalId: result.message_id,
      },
    });

    return { messageId: result.message_id!, success: true };
  } catch (error: any) {
    console.error('[Facebook] Erro ao enviar:', error.message);
    throw new Error(`Falha ao enviar mensagem Facebook: ${error.message}`);
  }
}

export async function verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

export async function handleWebhook(payload: any, channelId: string): Promise<void> {
  try {
    const entries = payload.entry || [];

    for (const entry of entries) {
      const messagingEvents = entry.messaging || [];

      for (const event of messagingEvents) {
        const senderId = event.sender?.id;
        const message = event.message;

        if (!senderId || !message) continue;

        // Check if message was sent by us
        if (message.is_echo) continue;

        // Find or create ticket
        let ticket = await prisma.ticket.findFirst({
          where: {
            channelId,
            externalId: senderId,
          },
        });

        if (!ticket) {
          // Create new ticket from Facebook Messenger
          ticket = await prisma.ticket.create({
            data: {
              canal: 'facebook',
              channelId,
              externalId: senderId,
              contactName: `Facebook User ${senderId}`,
              status: 'aberto',
              etapa: 'fila',
              prioridade: 'media',
            },
          });
        }

        // Store incoming message
        await prisma.channelMessage.create({
          data: {
            channelId,
            ticketId: ticket.id,
            externalId: message.mid,
            fromMe: false,
            contactName: `Facebook User ${senderId}`,
            contactId: senderId,
            content: message.text || '',
            mediaUrl: message.attachments?.[0]?.payload?.url,
            mimeType: message.attachments?.[0]?.type,
            status: 'received',
            rawPayload: JSON.stringify(event),
          },
        });

        console.log(`[Facebook] Mensagem recebida de ${senderId} para ticket ${ticket.id}`);
      }
    }
  } catch (error: any) {
    console.error('[Facebook] Erro ao processar webhook:', error.message);
  }
}

export async function testConnection(channelId: string): Promise<{ success: boolean; message: string; pageInfo?: any }> {
  const config = await getFacebookConfig(channelId);
  if (!config) return { success: false, message: 'Configuracao nao encontrada' };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.pageId}?fields=name,fan_count,link&access_token=${config.pageAccessToken}`
    );

    const result = await response.json() as {
      error?: { message?: string };
      name?: string;
      fan_count?: number;
      link?: string;
    };

    if (!response.ok) {
      return { success: false, message: result.error?.message || 'Erro ao conectar' };
    }

    return {
      success: true,
      message: `Conectado como ${result.name}`,
      pageInfo: {
        name: result.name,
        likes: result.fan_count,
        link: result.link,
      },
    };
  } catch (error: any) {
    return { success: false, message: `Erro ao testar conexao: ${error.message}` };
  }
}

export async function getPageInfo(channelId: string): Promise<any> {
  const config = await getFacebookConfig(channelId);
  if (!config) return null;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.pageId}?fields=name,fan_count,link,cover,picture&access_token=${config.pageAccessToken}`
    );

    const result = await response.json() as {
      error?: { message?: string };
      name?: string;
      fan_count?: number;
      link?: string;
      cover?: any;
      picture?: any;
    };

    if (!response.ok) {
      throw new Error(result.error?.message);
    }

    return result;
  } catch (error: any) {
    console.error('[Facebook] Erro ao buscar info da pagina:', error.message);
    return null;
  }
}
