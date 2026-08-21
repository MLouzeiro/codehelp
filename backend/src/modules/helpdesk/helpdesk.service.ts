import prisma from '../../config/database';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';
import { getHorarioConfig, isHorarioAtendimento } from './horario';
import { getEstatisticasCsat } from '../csat/csat.service';

export const ETAPAS_PADRAO = [
  { slug: 'triagem', nome: 'Triagem', descricao: 'Tickets aguardando direcionamento para o setor correto', cor: '#8b5cf6', icone: 'filter', ordem: -1, enviarAuto: false, notificarEquipe: true, tempoInatividadeMin: 10 },
  { slug: 'aguardando_expediente', nome: 'Aguardando Expediente', descricao: 'Tickets recebidos fora do horario aguardando inicio do expediente', cor: '#f97316', icone: 'moon', ordem: -0.5, enviarAuto: false, notificarEquipe: false, tempoInatividadeMin: null },
  { slug: 'fila', nome: 'Fila de Espera', descricao: 'Tickets aguardando atendente do setor', cor: '#f59e0b', icone: 'inbox', ordem: 0, enviarAuto: false, notificarEquipe: true, tempoInatividadeMin: 5 },
  { slug: 'em_atendimento', nome: 'Em Atendimento', descricao: 'Analista responsável conduzindo o atendimento', cor: '#10b981', icone: 'headphones', ordem: 1, enviarAuto: true, notificarEquipe: true },
  { slug: 'aguardando_cliente', nome: 'Aguardando Cliente', descricao: 'Aguardando retorno do cliente', cor: '#0ea5e9', icone: 'clock', ordem: 2, enviarAuto: false, notificarEquipe: false },
  { slug: 'aguardando_os', nome: 'Aguardando OS', descricao: 'Necessária geração de Ordem de Serviço', cor: '#ec4899', icone: 'file-text', ordem: 3, enviarAuto: true, notificarEquipe: false },
  { slug: 'concluido', nome: 'Concluído', descricao: 'Atendimento finalizado', cor: '#64748b', icone: 'check-circle', ordem: 4, enviarAuto: true, notificarEquipe: false },
  { slug: 'descartado', nome: 'Descartados', descricao: 'Tickets que não são chamados (spam, fora de contexto, msg acidental)', cor: '#71717a', icone: 'x-circle', ordem: 5, enviarAuto: false, notificarEquipe: false },
];

const MENSAGENS_PADRAO: Record<string, string> = {
  fila: 'Olá {{nome_contato}}! 👋\n\nRecebemos sua mensagem e seu chamado foi aberto com sucesso.\n📋 Protocolo: *{{numero_protocolo}}*\n⏱️ Em breve um de nossos analistas irá te atender.\n\nAguarde um instante, por favor.\n\nAtenciosamente,\nEquipe Codemed',
  triagem: 'Olá {{nome_contato}}! 🤖\n\nEstou analisando sua solicitação para direcioná-la ao analista mais adequado.\n📋 Protocolo: *{{numero_protocolo}}*\n\nIsso leva apenas alguns segundos...\n\nEquipe Codemed',
  aguardando_expediente: 'Olá {{nome_contato}}! 🌙\n\nNosso horário de atendimento é de segunda a sexta, das 08:00 às 18:00.\n\nRecebemos sua mensagem e ela ficou registrada. Assim que o expediente iniciar, um de nossos analistas irá te atender automaticamente.\n\nAtenciosamente,\nEquipe Codemed',
  em_atendimento: 'Olá {{nome_contato}}! 👨‍💻\n\nVocê foi atendido por *{{tecnico}}* e seu atendimento já está em andamento.\n📋 Protocolo: *{{numero_protocolo}}*\n\nCaso precise de algo, é só responder por aqui mesmo.\n\nAtenciosamente,\nEquipe Codemed',
  aguardando_cliente: 'Olá {{nome_contato}}! ⏳\n\nEstamos aguardando um retorno seu para dar continuidade ao atendimento do protocolo *{{numero_protocolo}}*.\n\nQuando puder, responda esta mensagem. Seu chamado continua aberto.\n\nAtenciosamente,\nEquipe Codemed',
  aguardando_os: 'Olá {{nome_contato}}! 📄\n\nVamos gerar a Ordem de Serviço referente ao seu atendimento.\n📋 Protocolo: *{{numero_protocolo}}*\n\nEm breve enviaremos o link para assinatura.\n\nAtenciosamente,\nEquipe Codemed',
  concluido: 'Olá {{nome_contato}}! ✅\n\nSeu atendimento do protocolo *{{numero_protocolo}}* foi concluído com sucesso.\n\nAgradecemos pelo contato! Caso precise de algo, é só nos chamar.\n\nAtenciosamente,\nEquipe Codemed',
};

const FOLLOWUP_PADRAO = 'Olá {{nome_contato}}! 👋\n\nNotei que você ficou offline após nos enviar uma mensagem. Ainda precisa de ajuda?\n\nQuando quiser, é só responder esta mensagem por aqui mesmo. Seu atendimento continua registrado e um de nossos analistas irá te atender assim que você retornar.\n\nAtenciosamente,\nEquipe Codemed';

const MENSAGEM_BOAS_VINDAS_PADRAO =
  'Olá, {{nome}}! 👋\n{{saudacao}}!\n\nQue bom ter você por aqui! 😊\n\nComo podemos ajudar?\n\n🏢 *ESCOLHA O DEPARTAMENTO*\n\n{{departamentos}}\n\n━━━━━━━━━━━━━━━━━━\n\n👉 *Digite o número da opção desejada.*\n\nExemplo:\n*1* para {{primeiro_departamento}}.';

// Versões anteriores (apenas saudação ou formato antigo) — usadas para migrar
// bancos existentes para o novo layout sem quebrar customizações do admin.
const MENSAGEM_BOAS_VINDAS_ANTERIOR =
  'Ola!! {{nome}} {{saudacao}} 👋\n\nQue bom ter voce por aqui!\n\nComo podemos te ajudar hoje? Descreva por aqui mesmo que um de nossos analistas te atendera em instantes.';
const MENSAGEM_BOAS_VINDAS_PADRAO_ANTERIOR =
  'Olá, {{nome}}! 👋\n{{saudacao}}!\n\nQue bom ter você por aqui! 😊\n\nComo podemos ajudar?';

const MENSAGEM_OPCAO_INVALIDA_PADRAO =
  '⚠️ Não consegui identificar a opção.\n\nPor favor, escolha uma das opções abaixo:\n\n{{departamentos}}\n\n👉 Digite apenas o *número* da opção desejada.';

const MENSAGEM_OPCAO_INVALIDA_ANTERIOR =
  'Hmm, nao entendi sua resposta, {{nome}} 😅\n\nPor favor, descreva com mais detalhes o que voce precisa.';
const MENSAGEM_OPCAO_INVALIDA_PADRAO_ANTERIOR =
  'Hmm, não entendi sua resposta, {{nome}} 😅\n\nPor favor, digite o *número* da opção desejada:\n\n{{departamentos}}';

const MENSAGEM_FORA_HORARIO_PADRAO =
  'Ola! Nosso horario de atendimento e de segunda a sexta, das 08:00 as 18:00. ' +
  'Deixamos seu contato registrado e um atendente human o respondera assim que possivel. 🙏';

export async function ensureHelpdeskConfigs() {
  for (const etapa of ETAPAS_PADRAO) {
    const existing = await prisma.helpdeskConfig.findUnique({ where: { slug: etapa.slug } });
    if (!existing) {
      const isFila = etapa.slug === 'fila';
      const isAguardandoExpediente = etapa.slug === 'aguardando_expediente';
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
          tempoInatividadeMin: (etapa as any).tempoInatividadeMin ?? null,
          mensagemFollowup: isFila ? FOLLOWUP_PADRAO : null,
          mensagemBoasVindas: isFila ? MENSAGEM_BOAS_VINDAS_PADRAO : null,
          mensagemOpcaoInvalida: isFila ? MENSAGEM_OPCAO_INVALIDA_PADRAO : null,
          mensagemForaHorario: isFila ? MENSAGEM_FORA_HORARIO_PADRAO : null,
          horarioInicio: isFila ? '08:00' : null,
          horarioFim: isFila ? '18:00' : null,
          diasAtendimento: isFila ? '1,2,3,4,5' : null,
        },
      });
    } else if (etapa.slug === 'fila') {
      const data: any = {};
      if (!existing.mensagemFollowup) data.mensagemFollowup = FOLLOWUP_PADRAO;
      if (existing.tempoInatividadeMin == null) data.tempoInatividadeMin = 5;
      if (!(existing as any).ordenacaoFila) data.ordenacaoFila = 'updatedAt_desc';
      if (!existing.mensagemBoasVindas) data.mensagemBoasVindas = MENSAGEM_BOAS_VINDAS_PADRAO;
      if (existing.mensagemBoasVindas === MENSAGEM_BOAS_VINDAS_ANTERIOR) data.mensagemBoasVindas = MENSAGEM_BOAS_VINDAS_PADRAO;
      if (existing.mensagemBoasVindas === MENSAGEM_BOAS_VINDAS_PADRAO_ANTERIOR) data.mensagemBoasVindas = MENSAGEM_BOAS_VINDAS_PADRAO;
      if (!(existing as any).mensagemOpcaoInvalida) data.mensagemOpcaoInvalida = MENSAGEM_OPCAO_INVALIDA_PADRAO;
      if ((existing as any).mensagemOpcaoInvalida === MENSAGEM_OPCAO_INVALIDA_ANTERIOR) data.mensagemOpcaoInvalida = MENSAGEM_OPCAO_INVALIDA_PADRAO;
      if ((existing as any).mensagemOpcaoInvalida === MENSAGEM_OPCAO_INVALIDA_PADRAO_ANTERIOR) data.mensagemOpcaoInvalida = MENSAGEM_OPCAO_INVALIDA_PADRAO;
      if (!existing.mensagemForaHorario) data.mensagemForaHorario = MENSAGEM_FORA_HORARIO_PADRAO;
      if (!existing.horarioInicio) data.horarioInicio = '08:00';
      if (!existing.horarioFim) data.horarioFim = '18:00';
      if (!existing.diasAtendimento) data.diasAtendimento = '1,2,3,4,5';
      if (Object.keys(data).length > 0) {
        await prisma.helpdeskConfig.update({ where: { id: existing.id }, data });
      }
    }
  }
}

export async function migrateLegacyTickets() {
  try {
    const result = await prisma.ticket.updateMany({
      where: {
        status: { not: 'fechado' },
        etapa: '',
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

export async function migrateLegacyTriagemConfig() {
  try {
    const triagem = await prisma.helpdeskConfig.findUnique({ where: { slug: 'triagem' } });
    if (!triagem) return;
    const fila = await prisma.helpdeskConfig.findUnique({ where: { slug: 'fila' } });
    if (!fila) return;
    const data: any = {};
    if (triagem.mensagemBoasVindas && !fila.mensagemBoasVindas) data.mensagemBoasVindas = triagem.mensagemBoasVindas;
    if ((triagem as any).mensagemOpcaoInvalida && !(fila as any).mensagemOpcaoInvalida) data.mensagemOpcaoInvalida = (triagem as any).mensagemOpcaoInvalida;
    if (triagem.mensagemForaHorario && !fila.mensagemForaHorario) data.mensagemForaHorario = triagem.mensagemForaHorario;
    if (triagem.horarioInicio && !fila.horarioInicio) data.horarioInicio = triagem.horarioInicio;
    if (triagem.horarioFim && !fila.horarioFim) data.horarioFim = triagem.horarioFim;
    if (triagem.diasAtendimento && !fila.diasAtendimento) data.diasAtendimento = triagem.diasAtendimento;
    if (Object.keys(data).length > 0) {
      await prisma.helpdeskConfig.update({ where: { id: fila.id }, data });
      console.log('[Helpdesk] Migração: configs de boas-vindas/horario copiadas de triagem para fila');
    }
    await prisma.helpdeskConfig.update({
      where: { id: triagem.id },
      data: { ativo: false },
    });
    console.log('[Helpdesk] Migração: config legada slug=triagem desativada');
  } catch (err: any) {
    console.warn('[Helpdesk] Migração da config triagem falhou (não-crítico):', err?.message || err);
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
    const result = await sendWhatsAppMessage(ticket.contactPhone, message, (ticket as any).whatsappConnectionId || undefined, (ticket as any).contactJid || undefined);
    if (result.success) {
      await prisma.message.create({
        data: {
          ticketId: ticket.id,
          fromMe: true,
          content: message,
          mediaUrl: null,
          source: 'bot',
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

export async function isClientWithoutResponse(ticketId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      contactPhone: true,
      dataPrimeiraResposta: true,
      etapa: true,
      status: true,
      assigneeId: true,
      messages: {
        where: { fromMe: false },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!ticket) return false;

  const lastClientMessage = ticket.messages[0];
  if (!lastClientMessage) return true;

  const now = new Date();
  const lastClientMessageTime = lastClientMessage.createdAt;
  const hoursSinceLastMessage = (now.getTime() - lastClientMessageTime.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastMessage > 24) {
    return true;
  }

  return false;
}

const ETAPAS_EM_ATENDIMENTO = ['em_atendimento', 'aguardando_cliente', 'aguardando_os'];

async function getClientActivityStatus(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      etapa: true,
      status: true,
      assigneeId: true,
      lastAgentMessageAt: true,
    },
  });

  if (!ticket) {
    return { offline: false, absent: false, inactive: false };
  }

  if (!ETAPAS_EM_ATENDIMENTO.includes(ticket.etapa)) {
    return { offline: false, absent: false, inactive: false };
  }

  const horarioCfg = await getHorarioConfig();
  if (isHorarioAtendimento(horarioCfg)) {
    return { offline: false, absent: false, inactive: false };
  }

  if (!ticket.lastAgentMessageAt) {
    return { offline: true, absent: true, inactive: true };
  }

  const now = new Date();
  const hoursSince = (now.getTime() - ticket.lastAgentMessageAt.getTime()) / (1000 * 60 * 60);

  return {
    offline: hoursSince > 2,
    absent: hoursSince > 4,
    inactive: hoursSince > 8,
  };
}

export async function pauseClientCounters(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const updateData: any = {
    slaPausadoEm: new Date(),
  };

  await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
  });
}

export async function resumeClientCounters(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const updateData: any = {
    slaPausadoEm: null,
    dataInicioAtendimento: new Date(),
  };

  await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
  });
}

export async function updateClientStatusCounters(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assignee: { select: { id: true } },
    },
  });

  if (!ticket) return;

  const etapa = ticket.etapa;
  const status = ticket.status;

  const activityStatus = await getClientActivityStatus(ticketId);
  const isWithoutResponse = await isClientWithoutResponse(ticketId);
  const isAwaitingAttention = etapa === 'em_atendimento' || etapa === 'fila';

  if (isAwaitingAttention && (isWithoutResponse || activityStatus.offline || activityStatus.absent || activityStatus.inactive)) {
    await pauseClientCounters(ticketId);
  } else if (isAwaitingAttention && !isWithoutResponse && !activityStatus.offline && !activityStatus.absent && !activityStatus.inactive) {
    await resumeClientCounters(ticketId);
  }
}

export async function getClientStatusInfo(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  if (!ticket) return null;

  const etapa = ticket.etapa;
  const status = ticket.status;

  const isAwaitingAttention = etapa === 'em_atendimento' || etapa === 'fila';

  const activityStatus = await getClientActivityStatus(ticketId);
  const isWithoutResponse = await isClientWithoutResponse(ticketId);

  const counters = {
    withoutResponse: isWithoutResponse,
    offline: activityStatus.offline,
    absent: activityStatus.absent,
    inactive: activityStatus.inactive,
    isAwaitingAttention,
    slaPausadoEm: ticket.slaPausadoEm,
    dataInicioAtendimento: ticket.dataInicioAtendimento,
  };

  return {
    ticket,
    counters,
  };
}

export async function getTicketTags(ticketId: string): Promise<string[]> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { tags: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');
  if (!ticket.tags) return [];
  return ticket.tags.split(',').map(t => t.trim()).filter(Boolean);
}

export async function addTicketTag(ticketId: string, tag: string): Promise<string[]> {
  const trimmed = tag.trim();
  if (!trimmed) throw new Error('Tag não pode ser vazia');

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { tags: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const currentTags = ticket.tags ? ticket.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (currentTags.includes(trimmed)) return currentTags;

  const newTags = [...currentTags, trimmed];
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { tags: newTags.join(',') },
  });

  return newTags;
}

export async function removeTicketTag(ticketId: string, tag: string): Promise<string[]> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { tags: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const currentTags = ticket.tags ? ticket.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const newTags = currentTags.filter(t => t !== tag.trim());

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { tags: newTags.length > 0 ? newTags.join(',') : null },
  });

  return newTags;
}

export async function setTicketTags(ticketId: string, tags: string[]): Promise<string[]> {
  const cleaned = tags.map(t => t.trim()).filter(Boolean);
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { tags: cleaned.length > 0 ? cleaned.join(',') : null },
  });
  return cleaned;
}
