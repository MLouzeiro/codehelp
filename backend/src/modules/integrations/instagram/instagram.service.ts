import prisma from '../../../config/database';

export interface InstagramConfig {
  accessToken: string;
  instagramAccountId: string;
  webhookVerifyToken: string;
  appSecret?: string;
}

export interface SendInstagramMessageInput {
  channelId: string;
  recipientId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  ticketId?: string;
}

export async function getInstagramConfig(channelId: string): Promise<InstagramConfig | null> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.tipo !== 'instagram' || !channel.config) return null;

  try {
    return JSON.parse(channel.config) as InstagramConfig;
  } catch {
    return null;
  }
}

export async function sendInstagramMessage(input: SendInstagramMessageInput): Promise<{ messageId: string; success: boolean }> {
  const config = await getInstagramConfig(input.channelId);
  if (!config) throw new Error('Configuracao do Instagram nao encontrada');

  try {
    const baseUrl = 'https://graph.facebook.com/v18.0';

    let requestBody: any = {
      recipient: { id: input.recipientId },
      messaging_type: 'RESPONSE',
      access_token: config.accessToken,
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

    const response = await fetch(baseUrl + '/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result: any = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao enviar mensagem Instagram');
    }

    // Store sent message
    await (prisma as any).channelMessage.create({
      data: {
        channelId: input.channelId,
        ticketId: input.ticketId,
        fromMe: true,
        contactName: input.recipientId,
        content: input.text || ('[' + (input.mediaType || 'media') + ']'),
        mediaUrl: input.mediaUrl,
        status: 'sent',
        externalId: result.message_id,
      },
    });

    return { messageId: result.message_id, success: true };
  } catch (error: any) {
    console.error('[Instagram] Erro ao enviar:', error.message);
    throw new Error('Falha ao enviar mensagem Instagram: ' + error.message);
  }
}

export async function verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
  if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
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
          // Create new ticket from Instagram DM
          ticket = await prisma.ticket.create({
            data: {
              canal: 'instagram',
              channelId,
              externalId: senderId,
              contactName: 'Instagram User ' + senderId,
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
            contactName: 'Instagram User ' + senderId,
            contactId: senderId,
            content: message.text || '',
            mediaUrl: message.attachments?.[0]?.payload?.url,
            mimeType: message.attachments?.[0]?.type,
            status: 'received',
            rawPayload: JSON.stringify(event),
          },
        });

        console.log('[Instagram] Mensagem recebida de ' + senderId + ' para ticket ' + ticket.id);
      }
    }
  } catch (error: any) {
    console.error('[Instagram] Erro ao processar webhook:', error.message);
  }
}

export async function testConnection(channelId: string): Promise<{ success: boolean; message: string; pageInfo?: any }> {
  const config = await getInstagramConfig(channelId);
  if (!config) return { success: false, message: 'Configuracao nao encontrada' };

  try {
    const response = await fetch(
      'https://graph.facebook.com/v18.0/' + config.instagramAccountId + '?fields=name,username,followers_count&access_token=' + config.accessToken
    );

    const result = await response.json() as {
      error?: { message?: string };
      name?: string;
      username?: string;
      followers_count?: number;
    };

    if (!response.ok) {
      return { success: false, message: result.error?.message || 'Erro ao conectar' };
    }

    return {
      success: true,
      message: 'Conectado como @' + (result.username || result.name),
      pageInfo: {
        name: result.name,
        username: result.username,
        followers: result.followers_count,
      },
    };
  } catch (error: any) {
    return { success: false, message: 'Erro ao testar conexao: ' + error.message };
  }
}

export async function getInstagramProfile(channelId: string): Promise<any> {
  const config = await getInstagramConfig(channelId);
  if (!config) return null;

  try {
    const response = await fetch(
      'https://graph.facebook.com/v18.0/' + config.instagramAccountId + '?fields=name,username,profile_picture_url,followers_count,media_count&access_token=' + config.accessToken
    );

    const result = await response.json() as {
      error?: { message?: string };
      name?: string;
      username?: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
    };

    if (!response.ok) {
      throw new Error(result.error?.message);
    }

    return result;
  } catch (error: any) {
    console.error('[Instagram] Erro ao buscar perfil:', error.message);
    return null;
  }
}
