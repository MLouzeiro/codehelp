import cron from 'node-cron';
import prisma from '../../config/database';
import { logAction } from '../audit/audit.service';

const RESPONSE_TIMEOUT_MIN = 15;
const CRON_EXPRESSION = '*/1 * * * *';

let started = false;

export async function verificarTicketsAguardandoResposta(): Promise<number> {
  const agora = new Date();
  const cutoff = new Date(agora.getTime() - RESPONSE_TIMEOUT_MIN * 60 * 1000);

  const tickets = await prisma.ticket.findMany({
    where: {
      etapa: 'em_atendimento',
      lastAgentMessageAt: { not: null, lte: cutoff },
      assigneeId: { not: null },
    },
  });

  let movidos = 0;
  for (const ticket of tickets) {
    try {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { etapa: 'aguardando_cliente' },
      });

      await prisma.ticketStageEvent.create({
        data: {
          ticketId: ticket.id,
          etapaAnterior: 'em_atendimento',
          etapaNova: 'aguardando_cliente',
          origem: 'automatico',
          mensagemAutomatica: `Aguardando resposta do cliente apos ${RESPONSE_TIMEOUT_MIN}min sem interacao do agente`,
        },
      });

      await logAction({
        usuarioId: null,
        acao: 'mover_etapa',
        entidade: 'Ticket',
        entidadeId: ticket.id,
        detalhes: {
          etapaAnterior: 'em_atendimento',
          etapaNova: 'aguardando_cliente',
          motivo: 'timeout_resposta_agente',
          minutosSemResposta: RESPONSE_TIMEOUT_MIN,
        },
      });

      movidos++;
    } catch (err: any) {
      console.error(`[ResponseTimer] Erro ao mover ticket ${ticket.id}:`, err?.message);
    }
  }

  return movidos;
}

export async function verificarTicketsRetornoCliente(): Promise<number> {
  const tickets = await prisma.ticket.findMany({
    where: {
      etapa: 'aguardando_cliente',
      assigneeId: { not: null },
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let movidos = 0;
  for (const ticket of tickets) {
    const lastMessage = ticket.messages[0];
    if (!lastMessage || lastMessage.fromMe) continue;

    try {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          etapa: 'em_atendimento',
          lastAgentMessageAt: null,
        },
      });

      await prisma.ticketStageEvent.create({
        data: {
          ticketId: ticket.id,
          etapaAnterior: 'aguardando_cliente',
          etapaNova: 'em_atendimento',
          origem: 'automatico',
          mensagemAutomatica: 'Cliente retornou — atendimento reaberto automaticamente',
        },
      });

      await logAction({
        usuarioId: null,
        acao: 'mover_etapa',
        entidade: 'Ticket',
        entidadeId: ticket.id,
        detalhes: {
          etapaAnterior: 'aguardando_cliente',
          etapaNova: 'em_atendimento',
          motivo: 'retorno_cliente',
        },
      });

      movidos++;
    } catch (err: any) {
      console.error(`[ResponseTimer] Erro ao reabrir ticket ${ticket.id}:`, err?.message);
    }
  }

  return movidos;
}

export function startResponseTimer(): void {
  if (started) return;
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`[ResponseTimer] Cron invalida: ${CRON_EXPRESSION}`);
    return;
  }
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      const movidos = await verificarTicketsAguardandoResposta();
      if (movidos > 0) {
        console.log(`[ResponseTimer] ${movidos} tickets movidos para aguardando_cliente`);
      }

      const retornos = await verificarTicketsRetornoCliente();
      if (retornos > 0) {
        console.log(`[ResponseTimer] ${retornos} tickets reabertos (retorno do cliente)`);
      }
    } catch (err: any) {
      console.error('[ResponseTimer] Erro:', err?.message || err);
    }
  });
  started = true;
  console.log(`[ResponseTimer] Iniciado (${CRON_EXPRESSION}) — timeout ${RESPONSE_TIMEOUT_MIN}min`);
}
