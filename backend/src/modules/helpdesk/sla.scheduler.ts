import cron from 'node-cron';
import { processarAlertasSLA } from './sla.service';
import { avaliarRegras } from '../automations/automations.service';
import { calcularPosicaoFila, recalcularFilaDepartamento } from './fila.service';
import prisma from '../../config/database';

const CRON_EXPRESSION = '*/5 * * * *';

let started = false;

async function autoEscalation(): Promise<number> {
  let escalacoes = 0;

  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['aberto', 'em_atendimento', 'pendente'] },
      etapa: { in: ['fila', 'em_atendimento'] },
    },
    include: {
      fila: { select: { id: true, proximaFilaId: true, slaMinutos: true, departamentoId: true } },
    },
  });

  for (const ticket of tickets) {
    if (!ticket.fila?.proximaFilaId) continue;

    const tempoAbertoMin = Math.floor(
      (Date.now() - new Date(ticket.dataAbertura).getTime()) / 60000
    );

    if (tempoAbertoMin < ticket.fila.slaMinutos) continue;

    const jaNotificado = await prisma.notificacao.findFirst({
      where: {
        ticketId: ticket.id,
        tipo: 'auto_escalacao',
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      },
    });
    if (jaNotificado) continue;

    try {
      const proximaFila = await prisma.fila.findUnique({ where: { id: ticket.fila.proximaFilaId } });
      const deptId = proximaFila?.departamentoId || ticket.departamentoId || null;
      const filaOrder = await calcularPosicaoFila(deptId);

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'escalonado',
          etapa: 'fila',
          idFila: ticket.fila.proximaFilaId,
          filaOrder,
          assigneeId: null,
        },
      });

      await prisma.ticketStageEvent.create({
        data: {
          ticketId: ticket.id,
          etapaAnterior: ticket.etapa,
          etapaNova: 'fila',
          origem: 'automatico',
          mensagemAutomatica: `Escalacao automatica apos ${tempoAbertoMin}min`,
        },
      });

      await prisma.notificacao.create({
        data: {
          tipo: 'auto_escalacao',
          mensagem: `Ticket ${ticket.protocolo || ticket.contactName} escalonado automaticamente para fila superior apos ${tempoAbertoMin}min`,
          destinatarioId: ticket.assigneeId || '',
          ticketId: ticket.id,
        },
      });

      escalacoes++;
    } catch (err: any) {
      console.error(`[Auto-Escalacao] Erro ao escalar ticket ${ticket.id}:`, err?.message);
    }
  }

  return escalacoes;
}

export function startSlaScheduler(): void {
  if (started) return;
  if (!cron.validate(CRON_EXPRESSION)) {
    console.error(`[SLA Scheduler] Expressao cron invalida: ${CRON_EXPRESSION}`);
    return;
  }
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      const gerados = await processarAlertasSLA();
      if (gerados.length > 0) {
        console.log(`[SLA Scheduler] ${gerados.length} alertas gerados`);
      }

      for (const alerta of gerados) {
        try {
          await avaliarRegras('sla_alerta', {
            ticketId: alerta.ticketId,
            tipo_alerta: alerta.status,
          });
        } catch {}
      }

      const escalacoes = await autoEscalation();
      if (escalacoes > 0) {
        console.log(`[SLA Scheduler] ${escalacoes} tickets escalonados automaticamente`);
      }
    } catch (err: any) {
      console.error('[SLA Scheduler] Erro:', err?.message || err);
    }
  });
  started = true;
  console.log(`[SLA Scheduler] Iniciado (${CRON_EXPRESSION}) — alertas + automations + auto-escalacao`);
}
