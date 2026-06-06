import prisma from '../../config/database';
import { logAction } from '../audit/audit.service';
import { getSlaInfoFromTicket } from './sla.service';

export const ETAPAS_PAUSAM_SLA = ['aguardando_cliente', 'aguardando_os', 'pendente'];

export async function pausarSLA(ticketId: string, motivo?: string, usuarioId?: string | null, ip?: string | null): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return false;
  if (ticket.slaPausadoEm) return false;
  if (!ticket.slaTotalMinutos) {
    const slaConfig = await prisma.sLAConfig.findUnique({ where: { prioridade: ticket.prioridade || 'media' } });
    if (slaConfig) {
      await prisma.ticket.update({ where: { id: ticketId }, data: { slaTotalMinutos: slaConfig.slaMinutosResolucao } });
    }
  }
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      slaPausadoEm: new Date(),
      motivoStatus: motivo || null,
    },
  });
  await logAction({
    usuarioId: usuarioId || null,
    acao: 'sla_pausar',
    entidade: 'Ticket',
    entidadeId: ticketId,
    detalhes: { motivo, etapa: ticket.etapa },
    ip: ip || null,
  });
  return true;
}

export async function retomarSLA(ticketId: string, usuarioId?: string | null, ip?: string | null): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return false;
  if (!ticket.slaPausadoEm) return false;
  const agora = new Date();
  const minutosPausa = Math.max(0, Math.floor((agora.getTime() - new Date(ticket.slaPausadoEm).getTime()) / 60000));
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      slaPausadoEm: null,
      slaPausadoTotalMin: { increment: minutosPausa },
      motivoStatus: null,
    },
  });
  await logAction({
    usuarioId: usuarioId || null,
    acao: 'sla_retomar',
    entidade: 'Ticket',
    entidadeId: ticketId,
    detalhes: { minutosPausaAcumulados: minutosPausa },
    ip: ip || null,
  });
  return true;
}

export function etapaPausaSla(etapa: string): boolean {
  return ETAPAS_PAUSAM_SLA.includes(etapa);
}

export async function gerenciarPausaSlaPorEtapa(
  ticketId: string,
  novaEtapa: string,
  etapaAnterior: string,
  usuarioId?: string | null,
  ip?: string | null
): Promise<'pausou' | 'retomou' | 'sem_mudanca'> {
  if (etapaPausaSla(novaEtapa) && !etapaPausaSla(etapaAnterior)) {
    const ok = await pausarSLA(ticketId, `Etapa: ${novaEtapa}`, usuarioId, ip);
    return ok ? 'pausou' : 'sem_mudanca';
  }
  if (!etapaPausaSla(novaEtapa) && etapaPausaSla(etapaAnterior)) {
    const ok = await retomarSLA(ticketId, usuarioId, ip);
    return ok ? 'retomou' : 'sem_mudanca';
  }
  return 'sem_mudanca';
}

export async function getSlaComPausa(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  return getSlaInfoFromTicket(ticket);
}
