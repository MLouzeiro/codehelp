import prisma from '../../../config/database';

export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  allowedChatIds?: string[];
}

export interface SendTelegramMessageInput {
  channelId: string;
  chatId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'audio' | 'document';
  ticketId?: string;
}

export async function getTelegramConfig(channelId: string): Promise<TelegramConfig | null> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.tipo !== 'telegram' || !channel.config) return null;

  try {
    return JSON.parse(channel.config) as TelegramConfig;
  } catch {
    return null;
  }
}

export async function sendTelegramMessage(input: SendTelegramMessageInput): Promise<{ messageId: string; success: boolean }> {
  const config = await getTelegramConfig(input.channelId);
  if (!config) throw new Error('Configuracao do Telegram nao encontrada');

  try {
    const baseUrl = `https://api.telegram.org/bot${config.botToken}`;

    let endpoint = '/sendMessage';
    let requestBody: any = {
      chat_id: input.chatId,
      parse_mode: 'HTML',
    };

    if (input.text) {
      requestBody.text = input.text;
    } else if (input.mediaUrl) {
      // Use sendPhoto, sendVideo, sendAudio, or sendDocument based on mediaType
      const mediaType = input.mediaType || 'photo';
      endpoint = `/send${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`;
      requestBody = {
        chat_id: input.chatId,
        [mediaType]: input.mediaUrl,
        caption: input.text || '',
      };
    }

    const response = await fetch(baseUrl + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result: any = await response.json();

    if (!result.ok) {
      throw new Error(result.description || 'Erro ao enviar mensagem Telegram');
    }

    const messageId = String(result.result.message_id);

    // Store sent message
    await prisma.channelMessage.create({
      data: {
        channelId: input.channelId,
        ticketId: input.ticketId,
        fromMe: true,
        contactName: input.chatId,
        contactId: input.chatId,
        content: input.text || `[${input.mediaType || 'media'}]`,
        mediaUrl: input.mediaUrl,
        status: 'sent',
        externalId: messageId,
      },
    });

    return { messageId, success: true };
  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar:', error.message);
    throw new Error(`Falha ao enviar mensagem Telegram: ${error.message}`);
  }
}

export async function verifyWebhook(token: string): Promise<boolean> {
  // Telegram uses the bot token as the webhook secret path
  // The webhook URL would be: https://your-domain.com/api/telegram/webhook/<botToken>
  return true;
}

export async function handleWebhook(payload: any, channelId: string): Promise<void> {
  try {
    // Telegram update object structure
    const update = payload;
    const message = update.message || update.edited_message;
    
    if (!message) return;

    const chatId = String(message.chat.id);
    const userId = String(message.from?.id || '');
    const text = message.text || message.caption || '';
    const messageId = String(message.message_id);

    // Skip messages sent by the bot itself
    if (message.from?.is_bot) return;

    // Skip group/supergroup messages (only handle private chats and configured groups)
    if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
      // Could be configured to handle groups via allowedChatIds
      const config = await getTelegramConfig(channelId);
      if (!config?.allowedChatIds?.includes(chatId)) return;
    }

    const contactName = [
      message.from?.first_name,
      message.from?.last_name,
    ].filter(Boolean).join(' ') || `Telegram User ${userId}`;

    // Find or create ticket
    let ticket = await prisma.ticket.findFirst({
      where: {
        channelId,
        externalId: chatId,
      },
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          canal: 'telegram',
          channelId,
          externalId: chatId,
          contactName,
          contactPhone: userId,
          status: 'aberto',
          etapa: 'fila',
          prioridade: 'media',
        },
      });
    }

    // Handle media
    let mediaUrl: string | undefined;
    let mimeType: string | undefined;

    if (message.photo) {
      // Get the largest photo
      const largest = message.photo[message.photo.length - 1];
      mediaUrl = largest.file_id;
      mimeType = 'image/jpeg';
    } else if (message.video) {
      mediaUrl = message.video.file_id;
      mimeType = message.video.mime_type || 'video/mp4';
    } else if (message.document) {
      mediaUrl = message.document.file_id;
      mimeType = message.document.mime_type;
    } else if (message.voice) {
      mediaUrl = message.voice.file_id;
      mimeType = message.voice.mime_type || 'audio/ogg';
    }

    // Store incoming message
    await prisma.channelMessage.create({
      data: {
        channelId,
        ticketId: ticket.id,
        externalId: messageId,
        fromMe: false,
        contactName,
        contactId: userId,
        content: text,
        mediaUrl,
        mimeType,
        status: 'received',
        rawPayload: JSON.stringify(update),
      },
    });

    console.log(`[Telegram] Mensagem recebida de ${contactName} (${chatId}) para ticket ${ticket.id}`);
  } catch (error: any) {
    console.error('[Telegram] Erro ao processar webhook:', error.message);
  }
}

export async function testConnection(channelId: string): Promise<{ success: boolean; message: string; botInfo?: any }> {
  const config = await getTelegramConfig(channelId);
  if (!config) return { success: false, message: 'Configuracao nao encontrada' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
    const result: any = await response.json();

    if (!result.ok) {
      return { success: false, message: result.description || 'Erro ao conectar' };
    }

    const bot = result.result;
    return {
      success: true,
      message: `Conectado como @${bot.username}`,
      botInfo: {
        id: bot.id,
        username: bot.username,
        firstName: bot.first_name,
        canJoinGroups: bot.can_join_groups,
        canReadAllGroupMessages: bot.can_read_all_group_messages,
      },
    };
  } catch (error: any) {
    return { success: false, message: `Erro ao testar conexao: ${error.message}` };
  }
}

export async function setWebhook(channelId: string, webhookUrl: string): Promise<{ success: boolean; message: string }> {
  const config = await getTelegramConfig(channelId);
  if (!config) return { success: false, message: 'Configuracao nao encontrada' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
        drop_pending_updates: true,
      }),
    });

    const result: any = await response.json();

    if (!result.ok) {
      return { success: false, message: result.description || 'Erro ao configurar webhook' };
    }

    return { success: true, message: 'Webhook configurado com sucesso' };
  } catch (error: any) {
    return { success: false, message: `Erro ao configurar webhook: ${error.message}` };
  }
}

export async function deleteWebhook(channelId: string): Promise<{ success: boolean; message: string }> {
  const config = await getTelegramConfig(channelId);
  if (!config) return { success: false, message: 'Configuracao nao encontrada' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`);
    const result: any = await response.json();

    if (!result.ok) {
      return { success: false, message: result.description || 'Erro ao remover webhook' };
    }

    return { success: true, message: 'Webhook removido com sucesso' };
  } catch (error: any) {
    return { success: false, message: `Erro ao remover webhook: ${error.message}` };
  }
}
