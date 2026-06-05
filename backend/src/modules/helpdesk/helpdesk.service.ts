import prisma from '../../config/database';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';

export const ETAPAS_PADRAO = [
  { slug: 'fila', nome: 'Fila de Espera', descricao: 'Tickets recém-chegados aguardando triagem', cor: '#f59e0b', icone: 'inbox', ordem: 0, enviarAuto: true, notificarEquipe: false },
  { slug: 'triagem', nome: 'Em Triagem', descricao: 'Cliente escolheu opção do menu, aguardando atendente humano abrir o chamado', cor: '#8b5cf6', icone: 'bot', ordem: 1, enviarAuto: false, notificarEquipe: false, tempoInatividadeMin: 5 },
  { slug: 'aguardando_confirmacao', nome: 'Aguardando Confirmação', descricao: 'Cliente respondeu o menu, aguardando atendente abrir o chamado', cor: '#eab308', icone: 'user-check', ordem: 2, enviarAuto: false, notificarEquipe: true },
  { slug: 'em_atendimento', nome: 'Em Atendimento', descricao: 'Analista responsável conduzindo o atendimento', cor: '#10b981', icone: 'headphones', ordem: 3, enviarAuto: true, notificarEquipe: true },
  { slug: 'aguardando_cliente', nome: 'Aguardando Cliente', descricao: 'Aguardando retorno do cliente', cor: '#0ea5e9', icone: 'clock', ordem: 4, enviarAuto: false, notificarEquipe: false },
  { slug: 'aguardando_os', nome: 'Aguardando OS', descricao: 'Necessária geração de Ordem de Serviço', cor: '#ec4899', icone: 'file-text', ordem: 5, enviarAuto: true, notificarEquipe: false },
  { slug: 'concluido', nome: 'Concluído', descricao: 'Atendimento finalizado', cor: '#64748b', icone: 'check-circle', ordem: 6, enviarAuto: true, notificarEquipe: false },
];

const MENSAGENS_PADRAO: Record<string, string> = {
  fila: 'Olá {{nome_contato}}! 👋\n\nRecebemos sua mensagem e seu chamado foi aberto com sucesso.\n📋 Protocolo: *{{numero_protocolo}}*\n⏱️ Em breve um de nossos analistas irá te atender.\n\nAguarde um instante, por favor.\n\nAtenciosamente,\nEquipe Codemed',
  triagem: 'Olá {{nome_contato}}! 🤖\n\nEstou analisando sua solicitação para direcioná-la ao analista mais adequado.\n📋 Protocolo: *{{numero_protocolo}}*\n\nIsso leva apenas alguns segundos...\n\nEquipe Codemed',
  em_atendimento: 'Olá {{nome_contato}}! 👨‍💻\n\nVocê foi atendido por *{{tecnico}}* e seu atendimento já está em andamento.\n📋 Protocolo: *{{numero_protocolo}}*\n\nCaso precise de algo, é só responder por aqui mesmo.\n\nAtenciosamente,\nEquipe Codemed',
  aguardando_cliente: 'Olá {{nome_contato}}! ⏳\n\nEstamos aguardando um retorno seu para dar continuidade ao atendimento do protocolo *{{numero_protocolo}}*.\n\nQuando puder, responda esta mensagem. Seu chamado continua aberto.\n\nAtenciosamente,\nEquipe Codemed',
  aguardando_os: 'Olá {{nome_contato}}! 📄\n\nVamos gerar a Ordem de Serviço referente ao seu atendimento.\n📋 Protocolo: *{{numero_protocolo}}*\n\nEm breve enviaremos o link para assinatura.\n\nAtenciosamente,\nEquipe Codemed',
  concluido: 'Olá {{nome_contato}}! ✅\n\nSeu atendimento do protocolo *{{numero_protocolo}}* foi concluído com sucesso.\n\nAgradecemos pelo contato! Caso precise de algo, é só nos chamar.\n\nAtenciosamente,\nEquipe Codemed',
};

const FOLLOWUP_PADRAO = 'Olá {{nome_contato}}! 👋\n\nNotei que você ficou offline após nos enviar uma mensagem. Ainda precisa de ajuda?\n\nQuando quiser, é só responder esta mensagem por aqui mesmo. Seu atendimento continua registrado e um de nossos analistas irá te atender assim que você retornar.\n\nAtenciosamente,\nEquipe Codemed';

export async function ensureHelpdeskConfigs() {
  for (const etapa of ETAPAS_PADRAO) {
    const existing = await prisma.helpdeskConfig.findUnique({ where: { slug: etapa.slug } });
    if (!existing) {
      await prisma.helpdeskConfig.create({
        data: {
          slug: etapa.slug,
          nome: etapa.nome,
          descricao: etapa.descricao,
          cor: etapa.cor,
          icone: etapa.icone,
          ordem: etapa.ordem,
          enviarAuto: etapa.enviarAuto,
          notificarEquipe: etapa.notificarEquipe,
          autoMessage: MENSAGENS_PADRAO[etapa.slug] || '',
          tempoInatividadeMin: (etapa as any).tempoInatividadeMin,
          mensagemFollowup: etapa.slug === 'triagem' ? FOLLOWUP_PADRAO : null,
        },
      });
    } else if (etapa.slug === 'triagem' && !existing.mensagemFollowup) {
      await prisma.helpdeskConfig.update({
        where: { id: existing.id },
        data: { mensagemFollowup: FOLLOWUP_PADRAO, tempoInatividadeMin: existing.tempoInatividadeMin ?? 5 },
      });
    }
  }
}

export async function migrateLegacyTickets() {
  try {
    const result = await prisma.ticket.updateMany({
      where: {
        status: { not: 'fechado' },
        OR: [
          { etapa: '' },
          { status: 'aberto' },
        ],
      },
      data: { etapa: 'fila' },
    });
    if (result.count > 0) {
      console.log(`[Helpdesk] Migração: ${result.count} tickets legados movidos para a fila`);
    }
  } catch (err: any) {
    console.warn('[Helpdesk] Migração de tickets legados falhou (não-crítico):', err?.message || err);
  }
}

export function getSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function interpolate(template: string, vars: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export interface TicketContext {
  protocolo?: string | null;
  contactName?: string | null;
  clientName?: string | null;
  tecnicoNome?: string | null;
}

export function buildMessageVars(ctx: TicketContext): Record<string, string> {
  return {
    nome_contato: ctx.contactName || ctx.clientName || 'cliente',
    empresa: ctx.clientName || '',
    saudacao: getSaudacao(),
    numero_protocolo: ctx.protocolo || 'N/A',
    categoria: '',
    tecnico: ctx.tecnicoNome || 'Equipe Codemed',
    data: new Date().toLocaleDateString('pt-BR'),
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

export async function getEtapaConfig(slug: string) {
  return prisma.helpdeskConfig.findUnique({ where: { slug } });
}

export async function listEtapas() {
  const configs = await prisma.helpdeskConfig.findMany({ orderBy: { ordem: 'asc' } });
  if (configs.length === 0) {
    await ensureHelpdeskConfigs();
    return prisma.helpdeskConfig.findMany({ orderBy: { ordem: 'asc' } });
  }
  return configs;
}

export async function sendStageAutoMessage(ticketId: string, etapaSlug: string) {
  try {
    const config = await getEtapaConfig(etapaSlug);
    if (!config || !config.enviarAuto || !config.autoMessage) {
      return { sent: false, reason: 'etapa_sem_mensagem_automatica' };
    }
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: true,
        assignee: { select: { name: true } },
      },
    });
    if (!ticket || !ticket.contactPhone) {
      return { sent: false, reason: 'ticket_sem_telefone' };
    }
    const vars = buildMessageVars({
      protocolo: ticket.protocolo,
      contactName: ticket.contactName,
      clientName: ticket.client?.razaoSocial,
      tecnicoNome: ticket.assignee?.name,
    });
    const message = interpolate(config.autoMessage, vars);
    const result = await sendWhatsAppMessage(ticket.contactPhone, message);
    if (result.success) {
      await prisma.message.create({
        data: {
          ticketId: ticket.id,
          fromMe: true,
          content: message,
          mediaUrl: null,
        },
      });
    }
    return { sent: result.success, error: result.error };
  } catch (err: any) {
    console.error('Erro ao enviar mensagem automática:', err?.message || err);
    return { sent: false, error: err?.message };
  }
}

export async function saveConversationSnapshot(ticketId: string, etapa: string, geradoPor: string) {
  const messages = await prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
  const stageEvents = await prisma.ticketStageEvent.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      client: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  const snapshot = {
    ticket,
    messages,
    stageEvents,
    capturedAt: new Date().toISOString(),
  };
  return prisma.ticketHistory.create({
    data: {
      ticketId,
      etapa,
      snapshotJson: JSON.stringify(snapshot),
      totalMensagens: messages.length,
      geradoPor,
    },
  });
}
