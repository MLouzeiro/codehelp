import prisma from '../../config/database';

export const STATUS_VALIDOS = [
  'aberto',
  'em_atendimento',
  'pendente',
  'escalonado',
  'resolvido',
  'fechado',
  'cancelado',
] as const;

export type StatusValido = typeof STATUS_VALIDOS[number];

export const ETAPA_PARA_STATUS: Record<string, StatusValido> = {
  fila: 'aberto',
  em_atendimento: 'em_atendimento',
  aguardando_cliente: 'pendente',
  aguardando_os: 'pendente',
  concluido: 'fechado',
  descartado: 'cancelado',
};

export const STATUS_PARA_ETAPA: Record<StatusValido, string> = {
  aberto: 'fila',
  em_atendimento: 'em_atendimento',
  pendente: 'aguardando_cliente',
  escalonado: 'em_atendimento',
  resolvido: 'em_atendimento',
  fechado: 'concluido',
  cancelado: 'descartado',
};

export function normalizarStatus(status: string | null | undefined): StatusValido | null {
  if (!status) return null;
  const s = status.toLowerCase().trim();
  if ((STATUS_VALIDOS as readonly string[]).includes(s)) return s as StatusValido;
  if (ETAPA_PARA_STATUS[s]) return ETAPA_PARA_STATUS[s];
  return null;
}

export function statusParaEtapa(status: StatusValido): string {
  return STATUS_PARA_ETAPA[status];
}

export async function migrarStatusETickets(): Promise<{ atualizados: number; semMapeamento: number }> {
  let atualizados = 0;
  let semMapeamento = 0;
  const tickets = await prisma.ticket.findMany({
    select: { id: true, etapa: true, status: true },
  });
  for (const t of tickets) {
    const statusEsperado = ETAPA_PARA_STATUS[t.etapa];
    if (!statusEsperado) {
      semMapeamento++;
      continue;
    }
    if (t.status !== statusEsperado) {
      await prisma.ticket.update({
        where: { id: t.id },
        data: { status: statusEsperado },
      });
      atualizados++;
    }
  }
  if (atualizados > 0) {
    console.log(`[Helpdesk] Migracao status: ${atualizados} tickets com status sincronizado`);
  }
  if (semMapeamento > 0) {
    const unmapped = tickets.filter((t) => !ETAPA_PARA_STATUS[t.etapa]);
    console.log(`[Helpdesk] Migracao status: ${semMapeamento} tickets com etapa sem mapeamento (ignorados):`);
    for (const t of unmapped) {
      console.log(`  - Ticket ${t.id}: etapa="${t.etapa}" status="${t.status}"`);
    }
  }
  return { atualizados, semMapeamento };
}

export async function escalarTicket(ticketId: string, novaFilaId: string, motivo: string, usuarioId?: string | null, ip?: string | null) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket nao encontrado');
  const fila = await prisma.fila.findUnique({ where: { id: novaFilaId } });
  if (!fila) throw new Error('Fila nao encontrada');
  if (fila.nivel === 'N1') throw new Error('Nao e possivel escalar para N1');
  const slaNovaFila = fila.slaMinutos;
  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'escalonado',
      idFila: novaFilaId,
      slaTotalMinutos: slaNovaFila,
      slaPausadoEm: null,
      motivoStatus: motivo,
    },
  });
  await prisma.ticketStageEvent.create({
    data: {
      ticketId,
      etapaAnterior: ticket.etapa,
      etapaNova: 'em_atendimento',
      origem: 'automatico',
      usuarioId: usuarioId || null,
      mensagemAutomatica: `Escalonado para ${fila.nome} - Motivo: ${motivo}`,
    },
  });
  const { logAction } = await import('../audit/audit.service');
  await logAction({
    usuarioId: usuarioId || null,
    acao: 'escalar',
    entidade: 'Ticket',
    entidadeId: ticketId,
    detalhes: { filaOrigem: ticket.idFila, filaDestino: novaFilaId, filaNome: fila.nome, motivo },
    ip: ip || null,
    severity: 'media',
    clienteId: ticket.clientId,
  });
  return { ticket: updated, fila };
}

export async function marcarResolvido(ticketId: string, resumoFinal: string, usuarioId?: string | null, ip?: string | null) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket nao encontrado');
  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'resolvido',
      dataResolucao: new Date(),
      slaPausadoEm: null,
      resumoFinal,
    },
  });
  await prisma.ticketStageEvent.create({
    data: {
      ticketId,
      etapaAnterior: ticket.etapa,
      etapaNova: ticket.etapa,
      origem: 'manual',
      usuarioId: usuarioId || null,
      mensagemAutomatica: 'Resolvido - aguardando CSAT',
    },
  });
  const { logAction } = await import('../audit/audit.service');
  await logAction({
    usuarioId: usuarioId || null,
    acao: 'concluir',
    entidade: 'Ticket',
    entidadeId: ticketId,
    detalhes: { status: 'resolvido', resumoFinal },
    ip: ip || null,
    severity: 'baixa',
    clienteId: ticket.clientId,
  });
  return updated;
}
