import prisma from '../../config/database';

export interface NotificacaoFiltros {
  destinatarioId: string;
  apenasNaoLidas?: boolean;
  limit?: number;
  offset?: number;
}

export async function listarNotificacoes(filtros: NotificacaoFiltros) {
  const where: any = { destinatarioId: filtros.destinatarioId };
  if (filtros.apenasNaoLidas) where.lida = false;
  const [items, total, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filtros.limit || 20,
      skip: filtros.offset || 0,
    }),
    prisma.notificacao.count({ where }),
    prisma.notificacao.count({ where: { destinatarioId: filtros.destinatarioId, lida: false } }),
  ]);
  return { items, total, naoLidas };
}

export async function marcarComoLida(id: string, destinatarioId: string) {
  return prisma.notificacao.updateMany({
    where: { id, destinatarioId },
    data: { lida: true },
  });
}

export async function marcarTodasComoLidas(destinatarioId: string) {
  return prisma.notificacao.updateMany({
    where: { destinatarioId, lida: false },
    data: { lida: true },
  });
}

export async function contarNaoLidas(destinatarioId: string): Promise<number> {
  return prisma.notificacao.count({
    where: { destinatarioId, lida: false },
  });
}

export async function criarNotificacao(input: {
  tipo: string;
  mensagem: string;
  destinatarioId: string;
  ticketId?: string | null;
  dados?: string | null;
}) {
  return prisma.notificacao.create({
    data: {
      tipo: input.tipo,
      mensagem: input.mensagem,
      destinatarioId: input.destinatarioId,
      ticketId: input.ticketId || null,
      dados: input.dados || null,
    },
  });
}
