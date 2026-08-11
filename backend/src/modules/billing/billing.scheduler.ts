import prisma from '../../config/database';
import { gerarPendencias, calcularFaturamentoMensal } from './billing.service';
import { criarNotificacao } from '../notificacoes/notificacoes.service';

const DIA_CORTE = parseInt(process.env.BILLING_DIA_CORTE || '25', 10);
let billingTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Verifica se hoje e o dia de corte e executa o calculo mensal.
 * Roda a cada hora. Se for o dia certo, executa uma unica vez.
 */
export function startBillingScheduler() {
  if (billingTimer) return;

  billingTimer = setInterval(async () => {
    const hoje = new Date();
    if (hoje.getDate() !== DIA_CORTE) return;

    // Prevent double execution (only run once per hour on the right day)
    const hourKey = `billing_${hoje.getFullYear()}_${hoje.getMonth()}_${hoje.getHours()}`;
    if ((global as any).__billingLastRun === hourKey) return;
    (global as any).__billingLastRun = hourKey;

    console.log(`[Billing] Dia de corte detectado (${hoje.toISOString().slice(0, 10)}). Executando calculo mensal...`);

    const periodo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    try {
      // Generate pendencies
      const criadas = await gerarPendencias(periodo);
      console.log(`[Billing] ${criadas} pendencia(s) criada(s) para o periodo ${periodo}`);

      if (criadas === 0) return;

      // Get pendencies to notify
      const pendencias = await prisma.billingPendency.findMany({
        where: { periodo, status: 'pendente' },
        include: {
          client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        },
      });

      // Get all admin/financeiro/gerente users to notify
      const usersToNotify = await prisma.user.findMany({
        where: {
          role: { in: ['admin', 'financeiro', 'gerente'] },
          active: true,
        },
        select: { id: true },
      });

      for (const pendencia of pendencias) {
        const clienteNome = pendencia.client.nomeFantasia || pendencia.client.razaoSocial;
        const tipoLabel: Record<string, string> = {
          terminais: 'Terminais',
          hostlinks: 'Hostlinks',
          interfaces: 'Interfaces',
          exames: 'Exames',
        };

        for (const user of usersToNotify) {
          await criarNotificacao({
            tipo: 'billing_pendencia',
            mensagem: `Faturamento pendente: ${tipoLabel[pendencia.tipo] || pendencia.tipo} — ${clienteNome} — ${pendencia.quantidade}x R$ ${(pendencia.valorTotal / pendencia.quantidade).toFixed(2)} = R$ ${pendencia.valorTotal.toFixed(2)} [${periodo}]`,
            destinatarioId: user.id,
            dados: JSON.stringify({
              billingPendencyId: pendencia.id,
              clienteId: pendencia.clienteId,
              tipo: pendencia.tipo,
              periodo,
              valor: pendencia.valorTotal,
            }),
          });
        }

        // Mark as notified
        await prisma.billingPendency.update({
          where: { id: pendencia.id },
          data: { notificadoEm: new Date() },
        });
      }

      console.log(`[Billing] Notificacoes enviadas para ${usersToNotify.length} usuario(s)`);
    } catch (err: any) {
      console.error('[Billing] Erro no scheduler de faturamento:', err?.message);
    }
  }, 60 * 60 * 1000); // Check every hour
}

export function stopBillingScheduler() {
  if (billingTimer) {
    clearInterval(billingTimer);
    billingTimer = null;
  }
}
