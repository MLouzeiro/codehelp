import prisma from '../../config/database';

export interface TicketAnalistaResumo {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  dataAbertura: Date;
  dataFechamento: Date | null;
  status: string;
  etapa: string;
  totalMensagens: number;
  mensagensAgente: number;
  primeiraRespostaMin: number | null;
  csatNota: number | null;
  csatRespondido: boolean;
  notaAuditoriaMedia: number | null;
  classificacaoAuditoria: string | null;
  totalAlertas: number;
}

export interface RelatorioAnalista {
  agenteId: string;
  agenteNome: string;
  periodo: { inicio: Date | null; fim: Date | null };
  resumo: {
    totalTickets: number;
    ticketsResolvidos: number;
    taxaResolucao: number;
    tempoMedioRespostaMin: number;
    notaAuditoriaMedia: number;
    classificacaoAuditoria: string;
    csatMedia: number;
    csatRespondidos: number;
    totalMensagensAgente: number;
    fcr: number;
  };
  tickets: TicketAnalistaResumo[];
}

export interface MensagemReplay {
  id: string;
  fromMe: boolean;
  content: string | null;
  createdAt: Date;
  source: string | null;
  tipo: string | null;
  auditoria: {
    notaGeral: number;
    classificacao: string;
    alertas: string[];
    pontosFortes: string[];
    pontosMelhoria: string[];
    sugestaoResposta: string | null;
  } | null;
}

export interface ReplayConversa {
  ticketId: string;
  protocolo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assunto: string | null;
  status: string;
  etapa: string;
  assigneeName: string | null;
  dataAbertura: Date;
  dataFechamento: Date | null;
  mensagens: MensagemReplay[];
  resumoAuditoria: {
    totalMensagens: number;
    mensagensAuditadas: number;
    notaMedia: number;
    classificacao: string;
  };
}

function parseList(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function classificacaoNota(nota: number): string {
  if (nota >= 8) return 'excelente';
  if (nota >= 6) return 'bom';
  if (nota >= 4) return 'neutro';
  if (nota >= 2) return 'atencao';
  return 'critico';
}

export async function gerarRelatorioAnalista(
  agenteId: string,
  dataInicio?: string,
  dataFim?: string
): Promise<RelatorioAnalista | null> {
  const agente = await prisma.user.findUnique({
    where: { id: agenteId },
    select: { id: true, name: true },
  });
  if (!agente) return null;

  const inicio = dataInicio ? new Date(dataInicio) : null;
  const fim = dataFim ? new Date(dataFim) : null;

  const where: any = {
    assigneeId: agenteId,
  };
  if (inicio || fim) {
    where.dataAbertura = {
      ...(inicio ? { gte: inicio } : {}),
      ...(fim ? { lte: fim } : {}),
    };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { dataAbertura: 'desc' },
    take: 100,
    include: {
      _count: { select: { messages: true } },
      messages: {
        where: { fromMe: true },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      csatResposta: { select: { nota: true, respondidoEm: true } },
    },
  });

  const auditAgg = await prisma.aIAgentAudit.groupBy({
    by: ['ticketId'],
    where: { agentId: agenteId, ticketId: { in: tickets.map(t => t.id) } },
    _avg: { notaGeral: true },
    _count: { _all: true },
  });
  const auditMap = new Map(auditAgg.map(a => [a.ticketId, { media: a._avg.notaGeral ?? 0, count: a._count._all }]));

  const resultados: TicketAnalistaResumo[] = [];
  let totalResolvidos = 0;
  let somaResposta = 0;
  let comResposta = 0;
  let somaAudit = 0;
  let comAudit = 0;
  let somaCsat = 0;
  let comCsat = 0;
  let fcrCount = 0;

  for (const t of tickets) {
    const resolvido = ['concluido', 'descartado'].includes(t.etapa) || t.status === 'fechado';
    if (resolvido) totalResolvidos++;

    const primeiraResposta = t.dataPrimeiraResposta ?? t.messages[0]?.createdAt ?? null;
    const primeiraRespostaMin = primeiraResposta
      ? Math.max(0, Math.round((primeiraResposta.getTime() - t.dataAbertura.getTime()) / 60000))
      : null;
    if (primeiraRespostaMin != null) {
      somaResposta += primeiraRespostaMin;
      comResposta++;
      if (primeiraRespostaMin <= 1440) fcrCount++;
    }

    const audit = auditMap.get(t.id);
    const notaMediaAudit = audit ? Math.round(audit.media * 10) / 10 : null;
    if (notaMediaAudit != null) {
      somaAudit += notaMediaAudit;
      comAudit++;
    }

    const csatNota = t.csatResposta?.nota ?? null;
    if (csatNota != null) {
      somaCsat += csatNota;
      comCsat++;
    }

    resultados.push({
      ticketId: t.id,
      protocolo: t.protocolo,
      contactName: t.contactName,
      dataAbertura: t.dataAbertura,
      dataFechamento: t.dataFechamento,
      status: t.status,
      etapa: t.etapa,
      totalMensagens: t._count.messages,
      mensagensAgente: t.messages.length,
      primeiraRespostaMin,
      csatNota,
      csatRespondido: !!t.csatResposta?.respondidoEm,
      notaAuditoriaMedia: notaMediaAudit,
      classificacaoAuditoria: notaMediaAudit != null ? classificacaoNota(notaMediaAudit) : null,
      totalAlertas: audit?.count ?? 0,
    });
  }

  const total = tickets.length;
  const notaAuditoriaMedia = comAudit ? Math.round((somaAudit / comAudit) * 10) / 10 : 0;

  return {
    agenteId,
    agenteNome: agente.name,
    periodo: { inicio, fim },
    resumo: {
      totalTickets: total,
      ticketsResolvidos: totalResolvidos,
      taxaResolucao: total ? Math.round((totalResolvidos / total) * 100) : 0,
      tempoMedioRespostaMin: comResposta ? Math.round(somaResposta / comResposta) : 0,
      notaAuditoriaMedia,
      classificacaoAuditoria: comAudit ? classificacaoNota(notaAuditoriaMedia) : 'sem_dados',
      csatMedia: comCsat ? Math.round((somaCsat / comCsat) * 10) / 10 : 0,
      csatRespondidos: comCsat,
      totalMensagensAgente: tickets.reduce((acc, t) => acc + t.messages.length, 0),
      fcr: comResposta ? Math.round((fcrCount / comResposta) * 100) : 0,
    },
    tickets: resultados,
  };
}

export interface ResumoTodosAnalistas {
  periodo: { inicio: Date | null; fim: Date | null };
  totalAnalistas: number;
  resumo: {
    totalTickets: number;
    ticketsResolvidos: number;
    taxaResolucaoMedia: number;
    csatMedia: number;
    fcrMedia: number;
    notaAuditoriaMedia: number;
    totalMensagensAgente: number;
  };
  analistas: AnalistaResumoRanking[];
}

export interface AnalistaResumoRanking {
  agenteId: string;
  agenteNome: string;
  totalTickets: number;
  ticketsResolvidos: number;
  taxaResolucao: number;
  tempoMedioRespostaMin: number;
  notaAuditoriaMedia: number;
  classificacaoAuditoria: string;
  csatMedia: number;
  csatRespondidos: number;
  totalMensagensAgente: number;
  fcr: number;
}

export async function gerarResumoTodosAnalistas(
  dataInicio?: string,
  dataFim?: string
): Promise<ResumoTodosAnalistas> {
  const agentes = await prisma.user.findMany({
    where: { active: true, role: { in: ['tecnico', 'gerente', 'admin'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const analistas: AnalistaResumoRanking[] = [];
  let totalTickets = 0;
  let totalResolvidos = 0;
  let somaCsat = 0;
  let comCsat = 0;
  let somaFcr = 0;
  let comFcr = 0;
  let somaNota = 0;
  let comNota = 0;
  let totalMensagensAgente = 0;

  for (const agente of agentes) {
    const rel = await gerarRelatorioAnalista(agente.id, dataInicio, dataFim);
    if (!rel) continue;
    const r = rel.resumo;

    analistas.push({
      agenteId: agente.id,
      agenteNome: agente.name,
      totalTickets: r.totalTickets,
      ticketsResolvidos: r.ticketsResolvidos,
      taxaResolucao: r.taxaResolucao,
      tempoMedioRespostaMin: r.tempoMedioRespostaMin,
      notaAuditoriaMedia: r.notaAuditoriaMedia,
      classificacaoAuditoria: r.classificacaoAuditoria,
      csatMedia: r.csatMedia,
      csatRespondidos: r.csatRespondidos,
      totalMensagensAgente: r.totalMensagensAgente,
      fcr: r.fcr,
    });

    totalTickets += r.totalTickets;
    totalResolvidos += r.ticketsResolvidos;
    totalMensagensAgente += r.totalMensagensAgente;
    if (r.csatRespondidos > 0) { comCsat++; somaCsat += r.csatMedia; }
    if (r.totalTickets > 0) { comFcr++; somaFcr += r.fcr; }
    if (r.notaAuditoriaMedia > 0) { comNota++; somaNota += r.notaAuditoriaMedia; }
  }

  return {
    periodo: {
      inicio: dataInicio ? new Date(dataInicio) : null,
      fim: dataFim ? new Date(dataFim) : null,
    },
    totalAnalistas: agentes.length,
    resumo: {
      totalTickets,
      ticketsResolvidos: totalResolvidos,
      taxaResolucaoMedia: totalTickets ? Math.round((totalResolvidos / totalTickets) * 100) : 0,
      csatMedia: comCsat ? Math.round((somaCsat / comCsat) * 10) / 10 : 0,
      fcrMedia: comFcr ? Math.round(somaFcr / comFcr) : 0,
      notaAuditoriaMedia: comNota ? Math.round((somaNota / comNota) * 10) / 10 : 0,
      totalMensagensAgente,
    },
    analistas,
  };
}

export async function getReplayConversa(ticketId: string): Promise<ReplayConversa | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      protocolo: true,
      contactName: true,
      contactPhone: true,
      assunto: true,
      status: true,
      etapa: true,
      dataAbertura: true,
      dataFechamento: true,
      assignee: { select: { name: true } },
    },
  });
  if (!ticket) return null;

  const [mensagens, auditorias] = await Promise.all([
    prisma.message.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fromMe: true, content: true, createdAt: true, source: true, tipo: true },
    }),
    prisma.aIAgentAudit.findMany({
      where: { ticketId },
      select: {
        mensagemId: true,
        notaGeral: true,
        classificacao: true,
        alertas: true,
        pontosFortes: true,
        pontosMelhoria: true,
        sugestaoResposta: true,
      },
    }),
  ]);

  const auditPorMsg = new Map(auditorias.map(a => [a.mensagemId, a]));

  const replay: MensagemReplay[] = mensagens.map(m => {
    const audit = auditPorMsg.get(m.id);
    return {
      id: m.id,
      fromMe: m.fromMe,
      content: m.content,
      createdAt: m.createdAt,
      source: m.source,
      tipo: m.tipo,
      auditoria: audit
        ? {
            notaGeral: audit.notaGeral,
            classificacao: audit.classificacao,
            alertas: parseList(audit.alertas),
            pontosFortes: parseList(audit.pontosFortes),
            pontosMelhoria: parseList(audit.pontosMelhoria),
            sugestaoResposta: audit.sugestaoResposta,
          }
        : null,
    };
  });

  const auditadas = replay.filter(m => m.auditoria).length;
  const notaMedia = auditadas
    ? replay.filter(m => m.auditoria).reduce((acc, m) => acc + (m.auditoria?.notaGeral ?? 0), 0) / auditadas
    : 0;

  return {
    ticketId: ticket.id,
    protocolo: ticket.protocolo,
    contactName: ticket.contactName,
    contactPhone: ticket.contactPhone,
    assunto: ticket.assunto,
    status: ticket.status,
    etapa: ticket.etapa,
    assigneeName: ticket.assignee?.name || null,
    dataAbertura: ticket.dataAbertura,
    dataFechamento: ticket.dataFechamento,
    mensagens: replay,
    resumoAuditoria: {
      totalMensagens: mensagens.length,
      mensagensAuditadas: auditadas,
      notaMedia: Math.round(notaMedia * 10) / 10,
      classificacao: auditadas ? classificacaoNota(notaMedia) : 'sem_dados',
    },
  };
}
