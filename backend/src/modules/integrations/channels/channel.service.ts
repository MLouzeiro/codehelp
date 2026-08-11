import prisma from '../../../config/database';

const CHANNEL_TYPES = [
  { tipo: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', color: '#25d366', providers: ['evolution', 'baileys', 'cloud'] },
  { tipo: 'email', label: 'Email', icon: 'Mail', color: '#3b82f6', providers: ['smtp'] },
  { tipo: 'instagram', label: 'Instagram', icon: 'Instagram', color: '#e4405f', providers: ['graph_api'] },
  { tipo: 'facebook', label: 'Facebook', icon: 'Facebook', color: '#1877f2', providers: ['graph_api'] },
  { tipo: 'telegram', label: 'Telegram', icon: 'Send', color: '#0088cc', providers: ['bot_api'] },
  { tipo: 'web', label: 'Web Chat', icon: 'Globe', color: '#f59e0b', providers: ['widget'] },
  { tipo: 'telefone', label: 'Telefone', icon: 'Phone', color: '#8b5cf6', providers: ['twilio'] },
];

// ── CRUD ────────────────────────────────────────────────────────────────

export async function listChannels(includeInativos = false, tipo?: string) {
  const where: any = {};
  if (!includeInativos) where.ativo = true;
  if (tipo) where.tipo = tipo;

  return prisma.channel.findMany({
    where,
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
      _count: { select: { tickets: true, channelMessages: true } },
      riskLogs: {
        where: { resolvido: false },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
    orderBy: { nome: 'asc' },
  });
}

export async function getChannelById(id: string) {
  return prisma.channel.findUnique({
    where: { id },
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
      _count: { select: { tickets: true, channelMessages: true } },
      riskLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}

export async function createChannel(data: {
  nome: string;
  tipo: string;
  slug?: string;
  provider?: string;
  config?: string;
  departamentoId?: string;
  cor?: string;
  avatar?: string;
  metadata?: string;
}) {
  // Auto-generate slug if not provided
  const slug = data.slug || data.nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return prisma.channel.create({
    data: {
      nome: data.nome,
      tipo: data.tipo,
      slug,
      provider: data.provider,
      config: data.config,
      departamentoId: data.departamentoId,
      cor: data.cor,
      avatar: data.avatar,
      metadata: data.metadata,
    },
  });
}

export async function updateChannel(id: string, data: {
  nome?: string;
  tipo?: string;
  provider?: string;
  config?: string;
  departamentoId?: string;
  cor?: string;
  avatar?: string;
  metadata?: string;
}) {
  const existing = await prisma.channel.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.channel.update({
    where: { id },
    data,
  });
}

export async function toggleChannel(id: string) {
  const existing = await prisma.channel.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.channel.update({
    where: { id },
    data: { ativo: !existing.ativo },
  });
}

export async function deleteChannel(id: string) {
  const existing = await prisma.channel.findUnique({ where: { id } });
  if (!existing) return false;

  // Soft check: don't delete if there are active tickets
  const activeTickets = await prisma.ticket.count({
    where: { channelId: id, status: { notIn: ['fechado', 'cancelado'] } },
  });

  if (activeTickets > 0) {
    throw new Error(`Canal possui ${activeTickets} ticket(s) ativo(s). Finalize ou mova os tickets antes de excluir.`);
  }

  await prisma.channel.delete({ where: { id } });
  return true;
}

// ── STATS ───────────────────────────────────────────────────────────────

export async function getChannelStats(id: string) {
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) return null;

  const [totalTickets, openTickets, totalMessages, messagesLast24h] = await Promise.all([
    prisma.ticket.count({ where: { channelId: id } }),
    prisma.ticket.count({
      where: { channelId: id, status: { notIn: ['fechado', 'cancelado'] } },
    }),
    prisma.channelMessage.count({ where: { channelId: id } }),
    prisma.channelMessage.count({
      where: {
        channelId: id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return { totalTickets, openTickets, totalMessages, messagesLast24h };
}

// ── TYPES ───────────────────────────────────────────────────────────────

export function getAllChannelTypes() {
  return CHANNEL_TYPES;
}

// ── RISK LOGS ───────────────────────────────────────────────────────────

export async function getRiskLogs(channelId: string) {
  return prisma.channelRiskLog.findMany({
    where: { channelId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function createRiskLog(channelId: string, tipo: string, mensagem: string, severidade = 'info') {
  return prisma.channelRiskLog.create({
    data: {
      channelId,
      tipo,
      mensagem,
      severidade,
    },
  });
}

export async function resolveRiskLog(logId: string) {
  return prisma.channelRiskLog.update({
    where: { id: logId },
    data: { resolvido: true, resolvidoEm: new Date() },
  });
}

// ── BY DEPARTAMENTO ─────────────────────────────────────────────────────

export async function getChannelsByDepartamento(departamentoId: string) {
  return prisma.channel.findMany({
    where: { departamentoId, ativo: true },
    include: {
      _count: { select: { tickets: true } },
    },
    orderBy: { nome: 'asc' },
  });
}
