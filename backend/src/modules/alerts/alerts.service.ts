import prisma from '../../config/database';
import { criarNotificacao } from '../notificacoes/notificacoes.service';
import { formatDateBR } from '../../shared/utils/helpers';

export interface AlertConfig {
  tipo: string;
  habilitado: boolean;
  comSom: boolean;
  cor: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
}

const DEFAULT_ALERTS: AlertConfig[] = [
  { tipo: 'novo_ticket', habilitado: true, comSom: true, cor: '#3b82f6', prioridade: 'media' },
  { tipo: 'ticket_atribuido', habilitado: true, comSom: true, cor: '#10b981', prioridade: 'media' },
  { tipo: 'sla_alerta_75', habilitado: true, comSom: false, cor: '#f59e0b', prioridade: 'alta' },
  { tipo: 'sla_alerta_90', habilitado: true, comSom: true, cor: '#f97316', prioridade: 'alta' },
  { tipo: 'sla_violado', habilitado: true, comSom: true, cor: '#ef4444', prioridade: 'critica' },
  { tipo: 'cliente_resposta', habilitado: true, comSom: true, cor: '#0ea5e9', prioridade: 'media' },
  { tipo: 'ticket_escalacao', habilitado: true, comSom: true, cor: '#8b5cf6', prioridade: 'alta' },
  { tipo: 'csat_recebido', habilitado: true, comSom: false, cor: '#6366f1', prioridade: 'baixa' },
  { tipo: 'aprovacao_pendente', habilitado: true, comSom: true, cor: '#ec4899', prioridade: 'alta' },
  { tipo: 'fila_novo_ticket', habilitado: true, comSom: true, cor: '#f59e0b', prioridade: 'alta' },
  { tipo: 'ticket_prazo_atrasado', habilitado: true, comSom: true, cor: '#ef4444', prioridade: 'critica' },
  { tipo: 'ticket_prazo_proximo', habilitado: true, comSom: false, cor: '#f59e0b', prioridade: 'alta' },
];

export async function getAlertConfigs(userId: string): Promise<AlertConfig[]> {
  try {
    const savedConfig = await prisma.helpdeskConfig.findFirst({ where: { slug: `alert_${userId}` } });
    if (savedConfig && savedConfig.descricao) {
      const parsed = JSON.parse(savedConfig.descricao);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Alerts] Erro ao carregar configs:', err);
  }
  return DEFAULT_ALERTS;
}

export async function saveAlertConfigs(userId: string, configs: AlertConfig[]): Promise<void> {
  const slug = `alert_${userId}`;
  const json = JSON.stringify(configs);

  try {
    const existing = await prisma.helpdeskConfig.findFirst({ where: { slug } });
    if (existing) {
      await prisma.helpdeskConfig.update({ where: { id: existing.id }, data: { descricao: json } });
    } else {
      await prisma.helpdeskConfig.create({
        data: {
          slug,
          nome: `Alertas ${userId}`,
          descricao: json,
        },
      });
    }
  } catch (err) {
    console.error('[Alerts] Erro ao salvar configs:', err);
    throw err;
  }
}

export async function enviarAlertaAtendente(params: {
  tipo: string;
  ticketId: string;
  destinatarioId: string;
  mensagem: string;
  dados?: Record<string, any>;
}) {
  const configs = await getAlertConfigs(params.destinatarioId);
  const config = configs.find(c => c.tipo === params.tipo);
  if (!config || !config.habilitado) return null;

  const notificacao = await criarNotificacao({
    tipo: params.tipo,
    mensagem: params.mensagem,
    destinatarioId: params.destinatarioId,
    ticketId: params.ticketId,
    dados: JSON.stringify({
      ...params.dados,
      comSom: config.comSom,
      cor: config.cor,
      prioridade: config.prioridade,
    }),
  });

  return notificacao;
}

export async function enviarAlertaNovaMensagem(params: {
  ticketId: string;
  remetente: string;
  destinatarioId: string;
  preview: string;
}) {
  return enviarAlertaAtendente({
    tipo: 'cliente_resposta',
    ticketId: params.ticketId,
    destinatarioId: params.destinatarioId,
    mensagem: `Nova mensagem de ${params.remetente}: ${params.preview.slice(0, 100)}`,
    dados: { remetente: params.remetente, preview: params.preview },
  });
}

export async function getAlertasNaoLidos(userId: string): Promise<number> {
  return prisma.notificacao.count({
    where: {
      destinatarioId: userId,
      lida: false,
      tipo: { startsWith: 'sla_' },
    },
  });
}

export async function getResumoAlertas(userId: string) {
  const [naoLidas, total] = await Promise.all([
    prisma.notificacao.count({
      where: { destinatarioId: userId, lida: false },
    }),
    prisma.notificacao.count({
      where: { destinatarioId: userId },
    }),
  ]);

  const porTipo = await prisma.notificacao.groupBy({
    by: ['tipo'],
    where: { destinatarioId: userId, lida: false },
    _count: { id: true },
  });

  return {
    naoLidas,
    total,
    porTipo: porTipo.map(p => ({ tipo: p.tipo, count: p._count.id })),
  };
}

export async function sendWeeklyAlert() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalTickets, ticketsAbertos, ticketsFechados, mediaTempoResposta] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.ticket.count({ where: { status: { in: ['aberto', 'em_atendimento', 'pendente'] } } }),
    prisma.ticket.count({ where: { status: 'fechado', dataFechamento: { gte: weekAgo } } }),
    prisma.ticket.aggregate({
      where: { dataPrimeiraResposta: { not: null }, createdAt: { gte: weekAgo } },
      _avg: { slaTotalMinutos: true },
    }),
  ]);

  const recipients = await prisma.alertRecipient.findMany({ where: { ativo: true } });

  const message = `📊 *Relatório Semanal - Codemed Hub*\n\n` +
    `Período: ${weekAgo.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}\n\n` +
    `📋 Total de tickets: ${totalTickets}\n` +
    `🟢 Abertos: ${ticketsAbertos}\n` +
    `✅ Fechados: ${ticketsFechados}\n` +
    `⏱️ Tempo médio de resposta: ${mediaTempoResposta._avg.slaTotalMinutos ? Math.round(mediaTempoResposta._avg.slaTotalMinutos) : 'N/A'} min\n`;

  const history = await prisma.alertHistory.create({
    data: {
      tipo: 'semanal',
      destinatarios: recipients.map(r => r.nome).join(', '),
      conteudo: message,
      status: 'enviado',
    },
  });

  return { history, recipients, message };
}

export async function notificarAtendentesFila(ticketId: string, departamentoId?: string | null) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { contactName: true, assunto: true, protocolo: true, categoria: true },
  });
  if (!ticket) return;

  let atendentes: string[] = [];
  if (departamentoId) {
    const deptUsuarios = await prisma.departamento.findUnique({
      where: { id: departamentoId },
      select: { usuarios: { select: { id: true } } },
    });
    atendentes = deptUsuarios?.usuarios?.map(u => u.id) || [];
  }

  if (atendentes.length === 0) {
    const agentes = await prisma.user.findMany({
      where: { role: { in: ['admin', 'gerente', 'tecnico'] }, active: true },
      select: { id: true },
    });
    atendentes = agentes.map(a => a.id);
  }

  const nome = ticket.contactName || 'Cliente';
  const assunto = ticket.assunto || ticket.categoria || 'Atendimento';
  const protocolo = ticket.protocolo ? `#${ticket.protocolo}` : 'sem protocolo';
  const mensagem = `Novo ticket na fila: ${nome} - ${assunto} (${protocolo})`;

  for (const atendenteId of atendentes) {
    await enviarAlertaAtendente({
      tipo: 'fila_novo_ticket',
      ticketId,
      destinatarioId: atendenteId,
      mensagem,
      dados: { contactName: ticket.contactName, assunto: ticket.assunto, protocolo: ticket.protocolo },
    });
  }
}

export async function verificarTicketsAtrasados() {
  const now = new Date();

  const tickets = await prisma.ticket.findMany({
    where: {
      prazoEntrega: { lt: now },
      semPrazo: false,
      status: { notIn: ['fechado', 'cancelado', 'arquivado'] },
    },
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      prazoEntrega: true,
      assigneeId: true,
    },
  });

  if (tickets.length === 0) return;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const ticket of tickets) {
    const jaAlertadoHoje = await prisma.notificacao.findFirst({
      where: {
        ticketId: ticket.id,
        tipo: 'ticket_prazo_atrasado',
        createdAt: { gte: startOfToday },
      },
    });
    if (jaAlertadoHoje) continue;

    const nome = ticket.contactName || 'Cliente';
    const protocolo = ticket.protocolo || 'sem protocolo';
    const prazoFormatado = formatDateBR(ticket.prazoEntrega!);
    const mensagem = `⏰ Ticket #${protocolo} de ${nome} está atrasado! Prazo: ${prazoFormatado}`;

    if (ticket.assigneeId) {
      await enviarAlertaAtendente({
        tipo: 'ticket_prazo_atrasado',
        ticketId: ticket.id,
        destinatarioId: ticket.assigneeId,
        mensagem,
        dados: { contactName: nome, protocolo: ticket.protocolo, prazoEntrega: ticket.prazoEntrega },
      });
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'gerente'] }, active: true },
      select: { id: true },
    });
    for (const admin of admins) {
      if (admin.id === ticket.assigneeId) continue;
      await enviarAlertaAtendente({
        tipo: 'ticket_prazo_atrasado',
        ticketId: ticket.id,
        destinatarioId: admin.id,
        mensagem,
        dados: { contactName: nome, protocolo: ticket.protocolo, prazoEntrega: ticket.prazoEntrega },
      });
    }
  }
}

export async function verificarPrazoProximo() {
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const tickets = await prisma.ticket.findMany({
    where: {
      prazoEntrega: { gt: now, lte: inTwoHours },
      semPrazo: false,
      status: { notIn: ['fechado', 'cancelado', 'arquivado'] },
    },
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      prazoEntrega: true,
      assigneeId: true,
    },
  });

  if (tickets.length === 0) return;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const ticket of tickets) {
    const jaAlertadoHoje = await prisma.notificacao.findFirst({
      where: {
        ticketId: ticket.id,
        tipo: 'ticket_prazo_proximo',
        createdAt: { gte: startOfToday },
      },
    });
    if (jaAlertadoHoje) continue;

    const nome = ticket.contactName || 'Cliente';
    const protocolo = ticket.protocolo || 'sem protocolo';
    const prazoFormatado = formatDateBR(ticket.prazoEntrega!);
    const mensagem = `⏰ Ticket #${protocolo} de ${nome} está com prazo próximo! Prazo: ${prazoFormatado}`;

    if (ticket.assigneeId) {
      await enviarAlertaAtendente({
        tipo: 'ticket_prazo_proximo',
        ticketId: ticket.id,
        destinatarioId: ticket.assigneeId,
        mensagem,
        dados: { contactName: nome, protocolo: ticket.protocolo, prazoEntrega: ticket.prazoEntrega },
      });
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'gerente'] }, active: true },
      select: { id: true },
    });
    for (const admin of admins) {
      if (admin.id === ticket.assigneeId) continue;
      await enviarAlertaAtendente({
        tipo: 'ticket_prazo_proximo',
        ticketId: ticket.id,
        destinatarioId: admin.id,
        mensagem,
        dados: { contactName: nome, protocolo: ticket.protocolo, prazoEntrega: ticket.prazoEntrega },
      });
    }
  }
}
