import prisma from '../../../config/database';

export interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  user: string;
  password: string;
  fromName?: string;
  fromAddress?: string;
}

export interface SendEmailInput {
  channelId: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
  ticketId?: string;
  inReplyTo?: string;
  references?: string[];
}

export async function getEmailConfig(channelId: string): Promise<EmailConfig | null> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.tipo !== 'email' || !channel.config) return null;

  try {
    return JSON.parse(channel.config) as EmailConfig;
  } catch {
    return null;
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string; success: boolean }> {
  const config = await getEmailConfig(input.channelId);
  if (!config) throw new Error('Configuracao de email nao encontrada');

  const fromAddress = input.channelId
    ? `${config.fromName || config.user} <${config.fromAddress || config.user}>`
    : config.user;

  try {
    // Import nodemailer dynamically
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    const mailOptions = {
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
      ...(input.inReplyTo && {
        headers: {
          'In-Reply-To': input.inReplyTo,
          'References': input.references?.join(' ') || input.inReplyTo,
        },
      }),
    };

    const info = await transporter.sendMail(mailOptions);

    // Store sent message
    await prisma.channelMessage.create({
      data: {
        channelId: input.channelId,
        ticketId: input.ticketId,
        fromMe: true,
        contactName: input.to,
        content: input.text || input.html || '',
        status: 'sent',
        externalId: info.messageId,
      },
    });

    return { messageId: info.messageId, success: true };
  } catch (error: any) {
    console.error('[Email] Erro ao enviar:', error.message);
    throw new Error(`Falha ao enviar email: ${error.message}`);
  }
}

export async function fetchEmails(channelId: string, lastSync?: Date): Promise<any[]> {
  const config = await getEmailConfig(channelId);
  if (!config) throw new Error('Configuracao de email nao encontrada');

  try {
    const Imap = (await import('imap')).default;

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.user,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort,
        tls: config.imapSecure,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: any, box: any) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          const searchCriteria = lastSync
            ? ['SINCE', lastSync.toISOString()]
            : ['ALL'];

          imap.search(searchCriteria, (err: any, results: any[]) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results.length) {
              imap.end();
              return resolve([]);
            }

            const messages: any[] = [];
            const fetch = imap.fetch(results, { bodies: '', markSeen: false });

            fetch.on('message', (msg: any, seqno: number) => {
              let buffer = '';
              msg.on('body', (stream: any) => {
                stream.on('data', (chunk: any) => {
                  buffer += chunk.toString('utf8');
                });
              });
              msg.on('attributes', (attrs: any) => {
                messages.push({
                  seqno,
                  uid: attrs.uid,
                  date: attrs.date,
                  flags: attrs.flags,
                  body: buffer,
                });
              });
            });

            fetch.once('end', () => {
              imap.end();
              resolve(messages);
            });

            fetch.once('error', (err: any) => {
              imap.end();
              reject(err);
            });
          });
        });
      });

      imap.once('error', (err: any) => reject(err));
      imap.connect();
    });
  } catch (error: any) {
    console.error('[Email] Erro ao buscar emails:', error.message);
    throw new Error(`Falha ao buscar emails: ${error.message}`);
  }
}

export async function testConnection(channelId: string): Promise<{ success: boolean; message: string }> {
  const config = await getEmailConfig(channelId);
  if (!config) return { success: false, message: 'Configuracao nao encontrada' };

  try {
    const Imap = (await import('imap')).default;

    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.user,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort,
        tls: config.imapSecure,
        tlsOptions: { rejectUnauthorized: false },
      });

      const timeout = setTimeout(() => {
        imap.end();
        resolve({ success: false, message: 'Timeout na conexao IMAP' });
      }, 10000);

      imap.once('ready', () => {
        clearTimeout(timeout);
        imap.end();
        resolve({ success: true, message: 'Conexao IMAP estabelecida com sucesso' });
      });

      imap.once('error', (err: any) => {
        clearTimeout(timeout);
        resolve({ success: false, message: `Erro IMAP: ${err.message}` });
      });

      imap.connect();
    });
  } catch (error: any) {
    return { success: false, message: `Erro ao testar conexao: ${error.message}` };
  }
}
