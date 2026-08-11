import prisma from '../../config/database';

const PRIORIDADE_ORDEM: Record<string, number> = {
  urgente: 0,
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export async function calcularPosicaoFila(departamentoId: string | null): Promise<number> {
  if (!departamentoId) return 0;

  const ticketsNaFila = await prisma.ticket.findMany({
    where: {
      etapa: 'fila',
      departamentoId,
    },
    select: { id: true, prioridade: true, filaOrder: true, dataAbertura: true },
  });

  if (ticketsNaFila.length === 0) return 1;

  const maxFilaOrder = ticketsNaFila.reduce((max, t) => Math.max(max, t.filaOrder ?? 0), 0);
  return maxFilaOrder + 1;
}

export async function atribuirPosicaoFila(ticketId: string): Promise<number> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return 0;

  const maxOrder = await prisma.ticket.aggregate({
    where: { etapa: 'fila', departamentoId: ticket.departamentoId || undefined },
    _max: { filaOrder: true },
  });

  const novaPosicao = (maxOrder._max.filaOrder || 0) + 1;
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { filaOrder: novaPosicao },
  });
  return novaPosicao;
}

export async function recalcularFilaDepartamento(departamentoId: string | null): Promise<number> {
  const tickets = await prisma.ticket.findMany({
    where: {
      etapa: 'fila',
      departamentoId: departamentoId || undefined,
    },
    orderBy: [
      { prioridade: 'asc' },
      { filaOrder: 'asc' },
      { dataAbertura: 'asc' },
    ],
  });

  if (tickets.length === 0) return 0;

  await prisma.$transaction(
    tickets.map((ticket, index) =>
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { filaOrder: index + 1 },
      })
    )
  );

  return tickets.length;
}

export async function recalcularTodasFilas(): Promise<number> {
  const departamentos = await prisma.departamento.findMany({ where: { ativo: true } });
  let total = 0;

  total += await recalcularFilaDepartamento(null);

  for (const dept of departamentos) {
    total += await recalcularFilaDepartamento(dept.id);
  }

  return total;
}
