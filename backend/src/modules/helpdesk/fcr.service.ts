import prisma from '../../config/database';

/**
 * Registra o primeiro agente que respondeu ao ticket
 */
export async function registrarPrimeiroAgente(ticketId: string, usuarioId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { primeiroAgenteId: true },
  });
  if (!ticket) return;
  if (ticket.primeiroAgenteId) return;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      primeiroAgenteId: usuarioId,
      tempoPrimeiroAgenteMin: 0,
    },
  });
}

/**
 * Registra interação de agente no ticket e atualiza FCR
 */
export async function registrarInteracaoAgente(params: {
  ticketId: string;
  usuarioId: string;
  tipo?: string;
  conteudo?: string;
}) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: { primeiroAgenteId: true, agentesEnvolvidos: true, assigneeId: true },
  });
  if (!ticket) return;

  await prisma.ticketAgentInteraction.create({
    data: {
      ticketId: params.ticketId,
      usuarioId: params.usuarioId,
      tipo: params.tipo || 'mensagem',
      conteudo: params.conteudo,
    },
  });

  if (!ticket.primeiroAgenteId) {
    await prisma.ticket.update({
      where: { id: params.ticketId },
      data: { primeiroAgenteId: params.usuarioId },
    });
  }

  const agentesEnvolvidos = JSON.parse(ticket.agentesEnvolvidos || '[]');
  if (!agentesEnvolvidos.includes(params.usuarioId)) {
    agentesEnvolvidos.push(params.usuarioId);
    await prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        agentesEnvolvidos: JSON.stringify(agentesEnvolvidos),
        resolvidoSemAjuda: agentesEnvolvidos.length <= 1,
      },
    });
  }
}

/**
 * Calcula FCR (First Contact Resolution) de um ticket
 */
export async function calcularFCR(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      primeiroAgenteId: true,
      assigneeId: true,
      agentesEnvolvidos: true,
      resolvidoSemAjuda: true,
      dataAbertura: true,
      dataFechamento: true,
    },
  });
  if (!ticket) return null;

  const agentes = JSON.parse(ticket.agentesEnvolvidos || '[]');
  const totalAgentes = agentes.length;
  const fcr = ticket.resolvidoSemAjuda !== false && totalAgentes <= 1;

  return {
    ticketId,
    fcr,
    primeiroAgenteId: ticket.primeiroAgenteId,
    totalAgentes,
    agentesEnvolvidos: agentes,
    resolvidoSemAjuda: ticket.resolvidoSemAjuda !== false,
  };
}

/**
 * Métricas de FCR consolidadas
 */
export async function metricasFCR(filtro?: { inicio?: Date; fim?: Date }) {
  const where: any = {
    status: { in: ['fechado', 'resolvido'] },
    dataFechamento: { not: null },
  };
  if (filtro?.inicio || filtro?.fim) {
    where.dataFechamento = {
      ...(where.dataFechamento || {}),
      ...(filtro.inicio ? { gte: filtro.inicio } : {}),
      ...(filtro.fim ? { lte: filtro.fim } : {}),
    };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      resolvidoSemAjuda: true,
      agentesEnvolvidos: true,
      primeiroAgenteId: true,
      assigneeId: true,
      dataAbertura: true,
      dataFechamento: true,
      dataInicioAtendimento: true,
    },
  });

  const total = tickets.length;
  const fcrCount = tickets.filter(t => t.resolvidoSemAjuda !== false).length;
  const taxaFCR = total > 0 ? Math.round((fcrCount / total) * 100) : 0;

  const tempoMedioFCR = tickets
    .filter(t => t.resolvidoSemAjuda !== false && t.dataInicioAtendimento && t.dataFechamento)
    .reduce((acc, t) => {
      const diff = (new Date(t.dataFechamento!).getTime() - new Date(t.dataInicioAtendimento!).getTime()) / 60000;
      return acc + diff;
    }, 0) / Math.max(fcrCount, 1);

  const tempoMedioNaoFCR = tickets
    .filter(t => t.resolvidoSemAjuda === false && t.dataInicioAtendimento && t.dataFechamento)
    .reduce((acc, t) => {
      const diff = (new Date(t.dataFechamento!).getTime() - new Date(t.dataInicioAtendimento!).getTime()) / 60000;
      return acc + diff;
    }, 1);

  return {
    total,
    fcr: fcrCount,
    naoFCR: total - fcrCount,
    taxaFCR,
    tempoMedioFCRMin: Math.round(tempoMedioFCR),
    tempoMedioNaoFCRMin: Math.round(tempoMedioNaoFCR / Math.max(total - fcrCount, 1)),
  };
}
