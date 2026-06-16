import prisma from '../../config/database';
import { criarNotificacao } from '../notificacoes/notificacoes.service';

export async function solicitarAprovacao(
  ticketId: string,
  solicitadoPorId: string,
  tipo: string,
  motivo: string,
  observacao?: string,
  valorAprovado?: number
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { client: true },
  });
  if (!ticket) throw new Error('Ticket não encontrado');

  const aprovacao = await prisma.aprovacao.create({
    data: {
      ticketId,
      solicitadoPorId,
      tipo,
      motivo,
      observacao,
      valorAprovado,
      status: 'pendente',
    },
    include: {
      solicitadoPor: { select: { id: true, name: true, email: true } },
    },
  });

  const usuarios = await prisma.user.findMany({
    where: { role: { in: ['admin', 'gerente'] }, active: true },
    select: { id: true },
  });

  for (const u of usuarios) {
    await criarNotificacao({
      tipo: 'aprovacao_solicitada',
      mensagem: `Nova solicitação de aprovação para o ticket #${ticket.protocolo || ticket.id.slice(0, 8)}: ${motivo}`,
      destinatarioId: u.id,
      ticketId,
      dados: JSON.stringify({ aprovacaoId: aprovacao.id, tipo, motivo }),
    });
  }

  return aprovacao;
}

export async function decidirAprovacao(
  aprovacaoId: string,
  aprovadoPorId: string,
  decidido: boolean,
  observacao?: string
) {
  const aprovacao = await prisma.aprovacao.findUnique({
    where: { id: aprovacaoId },
    include: { ticket: true, solicitadoPor: true },
  });
  if (!aprovacao) throw new Error('Aprovação não encontrada');
  if (aprovacao.status !== 'pendente') throw new Error('Aprovação já foi decidida');

  const status = decidido ? 'aprovada' : 'rejeitada';

  const updated = await prisma.aprovacao.update({
    where: { id: aprovacaoId },
    data: {
      aprovadoPorId,
      status,
      observacao,
      dataDecisao: new Date(),
    },
    include: {
      solicitadoPor: { select: { id: true, name: true, email: true } },
      aprovadoPor: { select: { id: true, name: true, email: true } },
    },
  });

  await criarNotificacao({
    tipo: `aprovacao_${status}`,
    mensagem: `Sua solicitação de aprovação para o ticket #${aprovacao.ticket.protocolo || aprovacao.ticket.id.slice(0, 8)} foi ${status}${observacao ? `: ${observacao}` : ''}`,
    destinatarioId: aprovacao.solicitadoPorId,
    ticketId: aprovacao.ticketId,
    dados: JSON.stringify({ aprovacaoId, decidido, observacao }),
  });

  return updated;
}

export async function listarAprovacoes(filtros: {
  status?: string;
  tipo?: string;
  ticketId?: string;
  page?: number;
  limit?: number;
}) {
  const { status, tipo, ticketId, page = 1, limit = 20 } = filtros;

  const where: any = {};
  if (status) where.status = status;
  if (tipo) where.tipo = tipo;
  if (ticketId) where.ticketId = ticketId;

  const [items, total] = await Promise.all([
    prisma.aprovacao.findMany({
      where,
      include: {
        ticket: { select: { id: true, protocolo: true, assunto: true, status: true } },
        solicitadoPor: { select: { id: true, name: true, email: true } },
        aprovadoPor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.aprovacao.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function obterAprovacao(id: string) {
  const aprovacao = await prisma.aprovacao.findUnique({
    where: { id },
    include: {
      ticket: { select: { id: true, protocolo: true, assunto: true, status: true, prioridade: true } },
      solicitadoPor: { select: { id: true, name: true, email: true } },
      aprovadoPor: { select: { id: true, name: true, email: true } },
    },
  });
  if (!aprovacao) throw new Error('Aprovação não encontrada');
  return aprovacao;
}

export async function contarApendentes() {
  return prisma.aprovacao.count({ where: { status: 'pendente' } });
}
