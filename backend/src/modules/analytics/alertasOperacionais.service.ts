import prisma from '../../config/database';
import { whatsappProviderFactory } from '../integrations/whatsapp/whatsapp-provider-factory';

// ── Alert Engine (ALERTAS E ATENÇÃO) ──────────────────────────────────
// Alertas operacionais baseados em dados REAIS (nunca inventados):
//   CRÍTICO → exige ação imediata (SLA violado, conexão offline)
//   ATENÇÃO → risco que merece monitoramento (SLA em risco, parados, CSAT baixo)
//   INFO    → contexto útil (volume, alerta leve)
// Cada alerta referencia o dado real com contagem/tempo quando aplicável.

export type NivelAlerta = 'info' | 'atencao' | 'critico';

export interface AlertOperacional {
  nivel: NivelAlerta;
  tipo: string;
  titulo: string;
  mensagem: string;
  contagem?: number;
  link?: string;
  icone?: string;
  dataHora?: string;
  responsavel?: string;
  origem?: string;
  acao?: string;
}

export interface ResumoAlertas {
  totalTickets: number;
  taxaResolucao: number;
  tempoMedioRespostaMin: number;
  csatMedio: number;
  ticketsAbertos: number;
  slaCumprido: number;
  slaTotal: number;
  taxaSla: number;
}

export async function getAlertasOperacionais(dias: number, resumo: ResumoAlertas): Promise<AlertOperacional[]> {
  const alertas: AlertOperacional[] = [];
  const agora = new Date();

  const statusAbertos = { status: { in: ['aberto', 'em_atendimento', 'pendente'] } };

  const [slaViolados, slaRisco, slaAlerta, paradosOs, paradosCliente] = await Promise.all([
    prisma.ticket.count({ where: { ...statusAbertos, metrics: { is: { slaStatus: 'violado' } } } }),
    prisma.ticket.count({ where: { ...statusAbertos, metrics: { is: { slaStatus: 'alerta_90' } } } }),
    prisma.ticket.count({ where: { ...statusAbertos, metrics: { is: { slaStatus: 'alerta_75' } } } }),
    prisma.ticket.count({
      where: {
        etapa: 'aguardando_os',
        ...statusAbertos,
        updatedAt: { lt: new Date(agora.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.ticket.count({
      where: {
        etapa: 'aguardando_cliente',
        ...statusAbertos,
        updatedAt: { lt: new Date(agora.getTime() - 48 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // ── CRÍTICO ─────────────────────────────────────────────────────────
  if (slaViolados > 0) {
    alertas.push({
      nivel: 'critico',
      tipo: 'sla_violado',
      titulo: 'SLA violado',
      mensagem: `${slaViolados} atendimento(s) com SLA violado (aberto há mais tempo que o limite combinado).`,
      contagem: slaViolados,
      link: '/app/helpdesk/indicadores',
    });
  }

  // Conexões WhatsApp ativas fora do ar
  try {
    const statusConexoes = await whatsappProviderFactory.getAllConnectionsStatus();
    const desconectadas = statusConexoes.filter((c) => !c.connected);
    if (desconectadas.length > 0) {
      alertas.push({
        nivel: 'critico',
        tipo: 'whatsapp_offline',
        titulo: 'WhatsApp desconectado',
        mensagem: `${desconectadas.length} conexão(ões) WhatsApp ativa(s) fora do ar: ${desconectadas.map((c) => c.nome).join(', ')}.`,
        contagem: desconectadas.length,
        link: '/app/whatsapp',
      });
    }
  } catch {
    /* status indisponível — alerta ignorado (não quebra o dashboard) */
  }

  // ── ATENÇÃO ─────────────────────────────────────────────────────────
  if (slaRisco > 0) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'sla_em_risco',
      titulo: 'SLA em risco',
      mensagem: `${slaRisco} atendimento(s) com SLA próximo de estourar (90% do prazo consumido).`,
      contagem: slaRisco,
      link: '/app/helpdesk/indicadores',
    });
  }

  if (paradosOs > 0) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'parado_aguardando_os',
      titulo: 'Parados aguardando OS',
      mensagem: `${paradosOs} chamado(s) parado(s) em "aguardando_os" há mais de 24h sem atualização.`,
      contagem: paradosOs,
      link: '/app/helpdesk',
    });
  }

  if (paradosCliente > 0) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'aguardando_cliente',
      titulo: 'Aguardando cliente sem retorno',
      mensagem: `${paradosCliente} chamado(s) em "aguardando_cliente" sem retorno há mais de 48h.`,
      contagem: paradosCliente,
      link: '/app/helpdesk',
    });
  }

  if (resumo.csatMedio > 0 && resumo.csatMedio < 3.5) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'csat_baixo',
      titulo: 'Satisfação abaixo da meta',
      mensagem: `CSAT médio de ${resumo.csatMedio.toFixed(2)} no período (meta ≥ 3.5).`,
    });
  }

  if (resumo.tempoMedioRespostaMin > 360) {
    const horas = (resumo.tempoMedioRespostaMin / 60).toFixed(1);
    alertas.push({
      nivel: 'atencao',
      tipo: 'resposta_acima_meta',
      titulo: 'Tempo de resposta acima da meta',
      mensagem: `Tempo médio de primeira resposta de ${resumo.tempoMedioRespostaMin} min (~${horas}h) — meta ≤ 360 min (6h).`,
      link: '/app/helpdesk/indicadores',
    });
  }

  if (resumo.totalTickets > 0 && resumo.taxaResolucao < 60) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'resolucao_baixa',
      titulo: 'Taxa de resolução baixa',
      mensagem: `Taxa de resolução de ${resumo.taxaResolucao}% no período (meta ≥ 60%).`,
      link: '/app/relatorios/executivo',
    });
  }

  if (resumo.slaTotal > 0 && resumo.taxaSla < 80) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'taxa_sla_baixa',
      titulo: 'Taxa de SLA abaixo da meta',
      mensagem: `${resumo.taxaSla}% dos atendimentos dentro do SLA (meta ≥ 80%).`,
      link: '/app/helpdesk/indicadores',
    });
  }

  // ── INFO ────────────────────────────────────────────────────────────
  if (slaAlerta > 0) {
    alertas.push({
      nivel: 'info',
      tipo: 'sla_alerta',
      titulo: 'SLA em atenção',
      mensagem: `${slaAlerta} atendimento(s) com 75% do prazo de SLA consumido.`,
      contagem: slaAlerta,
      link: '/app/helpdesk/indicadores',
    });
  }

  // Volume do último dia vs. média diária do período
  try {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const ontem = new Date(inicio);
    ontem.setDate(ontem.getDate() - (dias - 1));

    const ultimas24h = await prisma.ticket.count({ where: { createdAt: { gte: inicio } } });
    const totalPeriodo = await prisma.ticket.count({ where: { createdAt: { gte: ontem } } });
    const mediaDiaria = dias > 0 ? totalPeriodo / dias : 0;
    if (mediaDiaria > 0 && ultimas24h > mediaDiaria * 3 && ultimas24h >= 10) {
      alertas.push({
        nivel: 'info',
        tipo: 'volume_alto',
        titulo: 'Volume alto de chamados',
        mensagem: `${ultimas24h} chamado(s) nas últimas 24h — 3x acima da média diária do período (${Math.round(mediaDiaria)}/dia).`,
        contagem: ultimas24h,
      });
    }
  } catch {
    /* alerta não-crítico */
  }

  return alertas;
}

export default { getAlertasOperacionais };