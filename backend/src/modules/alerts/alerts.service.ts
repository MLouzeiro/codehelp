import prisma from '../../config/database';
import { criarNotificacao } from '../notificacoes/notificacoes.service';

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
];

export async function getAlertConfigs(userId: string): Promise<AlertConfig[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return DEFAULT_ALERTS;

  const savedConfig = await prisma.helpdeskConfig.findUnique({ where: { slug: `alert_config_${userId}` } });
  if (savedConfig) {
    try {
      return JSON.parse(savedConfig.descricao || '[]');
    } catch {}
  }

  return DEFAULT_ALERTS;
}

export async function saveAlertConfigs(userId: string, configs: AlertConfig[]): Promise<void> {
  const slug = `alert_config_${userId}`;
  const existing = await prisma.helpdeskConfig.findUnique({ where: { slug } });
  const data = {
    slug,
    nome: `Alertas de ${userId}`,
    descricao: JSON.stringify(configs),
  };

  if (existing) {
    await prisma.helpdeskConfig.update({ where: { id: existing.id }, data });
  } else {
    await prisma.helpdeskConfig.create({ data });
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
    prisma.ticket.count({ where: { status: { in: ['aberto', 'em_andamento', 'pendente'] } } }),
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
