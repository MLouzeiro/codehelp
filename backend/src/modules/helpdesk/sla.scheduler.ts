import cron from 'node-cron';
import { processarAlertasSLA } from './sla.service';
import { avaliarRegras } from '../automations/automations.service';
import { calcularPosicaoFila, recalcularFilaDepartamento } from './fila.service';
import { isAtendimentoAberto, getHorarioConfig } from './horario';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';
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

async function processarAguardandoExpediente(): Promise<number> {
  let processados = 0;

  try {
    const horarioCfg = await getHorarioConfig();
    const dentroHorario = await isAtendimentoAberto(horarioCfg);

    if (!dentroHorario) return 0;

    // Apenas tickets NÃO assumidos por analista — já em atendimento não voltam
    // para boas-vindas/fila ao iniciar expediente.
    const tickets = await prisma.ticket.findMany({
      where: {
        etapa: 'aguardando_expediente',
        status: { notIn: ['fechado', 'cancelado', 'arquivado'] },
        assigneeId: null,
      },
    });

    for (const ticket of tickets) {
      try {
        const hasDept = !!ticket.departamentoId;
        const filaOrder = hasDept
          ? await calcularPosicaoFila(ticket.departamentoId!)
          : 0;

        const { etapaInicialSlug } = await import('./stages.service');
        const novaEtapa = hasDept ? 'fila' : await etapaInicialSlug();

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            etapa: novaEtapa,
            filaOrder: hasDept ? filaOrder : null,
          },
        });

        await prisma.ticketStageEvent.create({
          data: {
            ticketId: ticket.id,
            etapaAnterior: 'aguardando_expediente',
            etapaNova: novaEtapa,
            origem: 'automatico',
            mensagemAutomatica: 'Movido automaticamente ao iniciar expediente',
          },
        });

        if (ticket.contactPhone) {
          let msg: string;
          if (hasDept) {
            msg = `Olá ${ticket.contactName || 'cliente'}! 🌅\n\nO expediente iniciou! Estamos prontos para te atender.\n\nEm breve um de nossos analistas irá te atender.\n\nAtenciosamente,\nEquipe Codemed`;
          } else {
            const departamentos = await prisma.departamento.findMany({
              where: { ativo: true },
              orderBy: { ordem: 'asc' },
            });
            const opcoes = departamentos.map((d) => `• ${d.nome}`).join('\n');
            msg = `Olá ${ticket.contactName || 'cliente'}! 🌅\n\nO expediente iniciou! Estamos prontos para te atender.\n\nPor favor, selecione o departamento desejado:\n\n${opcoes}\n\nResponda com o *nome* do departamento.\n\nAtenciosamente,\nEquipe Codemed`;
          }
          const result = await sendWhatsAppMessage(ticket.contactPhone, msg, undefined, (ticket as any).contactJid || undefined);
          if (result.success) {
            await prisma.message.create({
              data: {
                ticketId: ticket.id,
                fromMe: true,
                content: msg,
                source: 'bot',
                tipo: 'system',
              },
            });
          }
        }

        if (hasDept) {
          const atendentes = await prisma.user.findMany({
            where: {
              departamentos: { some: { departamentoId: ticket.departamentoId! } },
              active: true,
            },
            select: { id: true },
          });
          for (const atendente of atendentes) {
            await prisma.notificacao.create({
              data: {
                tipo: 'expediente_retorno',
                mensagem: `Ticket ${ticket.protocolo || ticket.contactName || ticket.id.slice(0, 8)} entrou na fila automaticamente ao iniciar expediente`,
                destinatarioId: atendente.id,
                ticketId: ticket.id,
              },
            });
          }
        }

        processados++;
      } catch (err: any) {
        console.error(`[Expediente] Erro ao processar ticket ${ticket.id}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.error('[Expediente] Erro geral:', err?.message);
  }

  return processados;
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

      const expediente = await processarAguardandoExpediente();
      if (expediente > 0) {
        console.log(`[SLA Scheduler] ${expediente} tickets movidos de aguardando_expediente para fila`);
      }
    } catch (err: any) {
      console.error('[SLA Scheduler] Erro:', err?.message || err);
    }
  });
  started = true;
  console.log(`[SLA Scheduler] Iniciado (${CRON_EXPRESSION}) — alertas + automations + auto-escalacao + expediente`);
}
