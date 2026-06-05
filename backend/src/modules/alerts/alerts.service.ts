import prisma from '../../config/database';
import { sendWhatsAppMessage } from '../integrations/whatsapp/whatsapp.service';
import { env } from '../../config/env';

export async function sendWeeklyAlert(): Promise<void> {
  try {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalTickets,
      resolvedTickets,
      pendingTickets,
      totalOs,
      signedOs,
      waitingOs,
      agents,
      recipients,
    ] = await Promise.all([
      prisma.ticket.count({ where: { createdAt: { gte: lastWeek } } }),
      prisma.ticket.count({ where: { status: 'fechado', dataFechamento: { gte: lastWeek } } }),
      prisma.ticket.count({ where: { status: { in: ['aberto', 'em_andamento'] } } }),
      prisma.serviceOrder.count({ where: { createdAt: { gte: lastWeek } } }),
      prisma.serviceOrder.count({ where: { status: 'assinada', updatedAt: { gte: lastWeek } } }),
      prisma.serviceOrder.count({ where: { status: 'aguardando_assinatura' } }),
      prisma.user.findMany({ where: { active: true, role: { not: 'admin' } } }),
      prisma.alertRecipient.findMany({ where: { ativo: true } }),
    ]);

    const ticketsByAgent = await prisma.ticket.groupBy({
      by: ['usuarioId'],
      _count: { id: true },
      where: { createdAt: { gte: lastWeek }, usuarioId: { not: null } },
    });

    const agentPerformance = agents.map((agent) => {
      const agentTickets = ticketsByAgent.find((t) => t.usuarioId === agent.id);
      return { name: agent.name, total: agentTickets?._count.id || 0 };
    }).sort((a, b) => b.total - a.total);

    const bestAgent = agentPerformance[0];
    const worstAgent = agentPerformance[agentPerformance.length - 1];

    const resolveRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    const message = `🗓️ *Relatório Semanal Codemed* — ${now.toLocaleDateString('pt-BR')}

📞 *Chamados (semana anterior):*
• Total: ${totalTickets}
• Resolvidos: ${resolvedTickets} (${resolveRate}%)
• Pendentes: ${pendingTickets}

👤 *Destaques da equipe:*
• Melhor desempenho: ${bestAgent ? `${bestAgent.name} (${bestAgent.total} chamados)` : 'N/A'}
${worstAgent && worstAgent.total > 0 ? `• Atenção: ${worstAgent.name} (${worstAgent.total} chamados)` : ''}

📋 *Ordens de Serviço:*
• Emitidas: ${totalOs} | Assinadas: ${signedOs} | Aguardando: ${waitingOs}

💡 *Insight:* ${resolveRate >= 70 ? 'Boa taxa de resolução esta semana!' : 'A taxa de resolução precisa de atenção. Reveja os chamados pendentes.'}

🔗 Acesse o dashboard: ${env.appUrl}/dashboard`;

    for (const recipient of recipients) {
      try {
        const result = await sendWhatsAppMessage(recipient.whatsapp, message);
        await prisma.alertHistory.create({
          data: {
            tipo: 'semanal',
            destinatarios: `${recipient.nome} (${recipient.whatsapp})`,
            conteudo: message.substring(0, 500),
            status: result.success ? 'enviado' : 'erro',
            erro: result.success ? null : result.error || 'Falha ao enviar WhatsApp',
          },
        });
      } catch (err: any) {
        await prisma.alertHistory.create({
          data: {
            tipo: 'semanal',
            destinatarios: `${recipient.nome} (${recipient.whatsapp})`,
            conteudo: message.substring(0, 500),
            status: 'erro',
            erro: err.message,
          },
        });
      }
    }

    if (env.alertWhatsappNumbers.length > 0) {
      for (const number of env.alertWhatsappNumbers) {
        await sendWhatsAppMessage(number.trim(), message);
      }
    }

    console.log(`Weekly alert sent to ${recipients.length} recipients`);
  } catch (error) {
    console.error('Error sending weekly alert:', error);
  }
}
