import prisma from '../../config/database';

export interface DetalheAlerta {
  tipo: string;
  titulo: string;
  nivel: string;
  periodo: { inicio: string; fim: string; dias: number };
  valorAtual: number | string;
  meta: number | string;
  diferenca: number | string;
  percentualDiferenca: number;
  totalAmostra: number;
  regra: string;
  calculo: string;
  dadosAnalise: Record<string, number>;
  fatoresPrincipais: Array<{ icone: string; texto: string; nivel: string }>;
  porAnalista: Array<{ nome: string; tickets: number; csat: number; sla: number; fcr: number }>;
  porCliente: Array<{ nome: string; tickets: number; csat: number; reaberturas: number; sla: number }>;
  porCategoria: Array<{ categoria: string; tickets: number; csat: number; tempoMedio: number; sla: number; resolucao: number; fcr: number }>;
  chamadosRelacionados: Array<{ id: string; protocolo: string; cliente: string; analista: string; categoria: string; csat: number; sla: number; tempo: string; status: string }>;
  evolucao: Array<{ data: string; valor: number }>;
  comparativo: { atual: number; anterior: number; variacao: number } | null;
  recomendacoes: Array<{ prioridade: 'alta' | 'media' | 'baixa'; titulo: string; descricao: string; acao: string }>;
  analiseIa: { diagnostico: string; causas: string[]; impacto: string; recomendacao: string; confianca: number } | null;
}

function periodRange(dias: number): { inicio: Date; fim: Date } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

function previousRange(fim: Date, dias: number): { inicio: Date; fim: Date } {
  const fimPrev = new Date(fim);
  fimPrev.setDate(fimPrev.getDate() - dias);
  fimPrev.setHours(23, 59, 59, 999);
  const inicio = new Date(fimPrev);
  inicio.setDate(fimPrev.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim: fimPrev };
}

function variacaoPercentual(atual: number, anterior: number): number {
  if (!anterior) return 0;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function formatarData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dayKey(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

async function evolucaoDiariaCsat(inicio: Date, fim: Date): Promise<Array<{ data: string; valor: number }>> {
  const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000) + 1;
  const evolucao: Array<{ data: string; valor: number }> = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const proximo = new Date(d);
    proximo.setDate(d.getDate() + 1);
    proximo.setHours(0, 0, 0, 0);
    const agg = await prisma.cSATResposta.aggregate({
      where: { respondidoEm: { gte: d, lt: proximo }, nota: { not: null } },
      _avg: { nota: true },
      _count: { id: true },
    });
    evolucao.push({
      data: dayKey(d),
      valor: agg._avg.nota ? Math.round(agg._avg.nota * 100) / 100 : 0,
    });
  }
  return evolucao;
}

async function evolucaoDiaria(
  inicio: Date,
  fim: Date,
  field: 'slaStatus' | 'status' | 'tempoPrimeiraRespostaMin',
  matchValue: string | null,
): Promise<Array<{ data: string; valor: number }>> {
  const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000) + 1;
  const evolucao: Array<{ data: string; valor: number }> = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const proximo = new Date(d);
    proximo.setDate(d.getDate() + 1);
    proximo.setHours(0, 0, 0, 0);
    const whereBase = { createdAt: { gte: d, lt: proximo } };
    let valor = 0;
    if (field === 'slaStatus' && matchValue) {
      const total = await prisma.ticket.count({ where: whereBase });
      const match = await prisma.ticket.count({ where: { ...whereBase, metrics: { is: { slaStatus: matchValue } } } });
      valor = total > 0 ? Math.round((match / total) * 1000) / 10 : 0;
    } else if (field === 'status' && matchValue) {
      const total = await prisma.ticket.count({ where: whereBase });
      const match = await prisma.ticket.count({ where: { ...whereBase, status: matchValue } });
      valor = total > 0 ? Math.round((match / total) * 1000) / 10 : 0;
    } else if (field === 'tempoPrimeiraRespostaMin') {
      const agg = await prisma.ticketMetrics.aggregate({
        where: { ticket: { createdAt: { gte: d, lt: proximo } }, tempoPrimeiraRespostaMin: { not: null } },
        _avg: { tempoPrimeiraRespostaMin: true },
      });
      valor = agg._avg.tempoPrimeiraRespostaMin ? Math.round(agg._avg.tempoPrimeiraRespostaMin) : 0;
    }
    evolucao.push({ data: dayKey(d), valor });
  }
  return evolucao;
}

// ── Coleta auxiliar: tickets + CSAT via Ticket.csatResposta ─────────

interface TicketBase {
  id: string;
  protocolo: string | null;
  categoria: string | null;
  status: string;
  etapa: string;
  assigneeId: string | null;
  assigneeNome: string;
  clienteNome: string;
  slaStatus: string | null;
  tempoTotalMin: number;
  tempoPrimeiraRespostaMin: number | null;
  totalReaberturas: number;
  csatNota: number | null;
}

async function coletarTicketsComCsat(inicio: Date, fim: Date): Promise<TicketBase[]> {
  const rows = await prisma.ticket.findMany({
    where: { createdAt: { gte: inicio, lte: fim } },
    select: {
      id: true, protocolo: true, categoria: true, status: true, etapa: true, assigneeId: true,
      assignee: { select: { name: true } },
      client: { select: { razaoSocial: true, nomeFantasia: true } },
      metrics: { select: { slaStatus: true, tempoTotalMin: true, tempoPrimeiraRespostaMin: true, totalReaberturas: true } },
      csatResposta: { select: { nota: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, protocolo: r.protocolo, categoria: r.categoria,
    status: r.status, etapa: r.etapa, assigneeId: r.assigneeId,
    assigneeNome: r.assignee?.name || 'Sem analista',
    clienteNome: r.client?.nomeFantasia || r.client?.razaoSocial || 'Desconhecido',
    slaStatus: r.metrics?.slaStatus || null,
    tempoTotalMin: r.metrics?.tempoTotalMin || 0,
    tempoPrimeiraRespostaMin: r.metrics?.tempoPrimeiraRespostaMin ?? null,
    totalReaberturas: r.metrics?.totalReaberturas || 0,
    csatNota: r.csatResposta?.nota ?? null,
  }));
}
async function detalharCsatBaixo(dias: number, nivel: string): Promise<DetalheAlerta> {
  const { inicio, fim } = periodRange(dias);
  const { inicio: iniPrev, fim: fimPrev } = previousRange(fim, dias);
  const [aggAtual, aggAnterior, totalTickets, resolvidos, tickets] = await Promise.all([
    prisma.cSATResposta.aggregate({ where: { respondidoEm: { gte: inicio, lte: fim }, nota: { not: null } }, _avg: { nota: true }, _sum: { nota: true }, _count: { id: true } }),
    prisma.cSATResposta.aggregate({ where: { respondidoEm: { gte: iniPrev, lte: fimPrev }, nota: { not: null } }, _avg: { nota: true }, _count: { id: true } }),
    prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } }),
    prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim }, OR: [{ status: "fechado" }, { etapa: "concluido" }] } }),
    coletarTicketsComCsat(inicio, fim),
  ]);
  const csatAtual = aggAtual._avg.nota ? Math.round(aggAtual._avg.nota * 100) / 100 : 0;
  const csatAnterior = aggAnterior._avg.nota ? Math.round(aggAnterior._avg.nota * 100) / 100 : 0;
  const meta = 3.5;
  const diferenca = Math.round((csatAtual - meta) * 100) / 100;
  const comCsat = tickets.filter((t) => t.csatNota !== null);

  const am = new Map<string, { nome: string; tickets: number; csatSum: number; slaC: number; slaT: number; fcrC: number }>();
  for (const t of comCsat) {
    if (!am.has(t.assigneeNome)) am.set(t.assigneeNome, { nome: t.assigneeNome, tickets: 0, csatSum: 0, slaC: 0, slaT: 0, fcrC: 0 });
    const a = am.get(t.assigneeNome)!;
    a.tickets++; a.csatSum += t.csatNota || 0;
    if (t.slaStatus) { a.slaT++; if (t.slaStatus === "cumprido") a.slaC++; }
    if (t.totalReaberturas === 0) a.fcrC++;
  }
  const porAnalista = Array.from(am.values()).map((a) => ({
    nome: a.nome, tickets: a.tickets,
    csat: a.tickets > 0 ? Math.round((a.csatSum / a.tickets) * 100) / 100 : 0,
    sla: a.slaT > 0 ? Math.round((a.slaC / a.slaT) * 1000) / 10 : 0,
    fcr: a.tickets > 0 ? Math.round((a.fcrC / a.tickets) * 1000) / 10 : 0,
  })).sort((a, b) => a.csat - b.csat);

  const cm = new Map<string, { nome: string; tickets: number; csatSum: number; reab: number; slaC: number; slaT: number }>();
  for (const t of comCsat) {
    if (!cm.has(t.clienteNome)) cm.set(t.clienteNome, { nome: t.clienteNome, tickets: 0, csatSum: 0, reab: 0, slaC: 0, slaT: 0 });
    const c = cm.get(t.clienteNome)!;
    c.tickets++; c.csatSum += t.csatNota || 0; c.reab += t.totalReaberturas;
    if (t.slaStatus) { c.slaT++; if (t.slaStatus === "cumprido") c.slaC++; }
  }
  const porCliente = Array.from(cm.values()).map((c) => ({
    nome: c.nome, tickets: c.tickets,
    csat: c.tickets > 0 ? Math.round((c.csatSum / c.tickets) * 100) / 100 : 0,
    reaberturas: c.reab,
    sla: c.slaT > 0 ? Math.round((c.slaC / c.slaT) * 1000) / 10 : 0,
  })).sort((a, b) => a.csat - b.csat);

  const catm = new Map<string, { cat: string; n: number; cs: number; ts: number; sc: number; st: number; res: number; fc: number }>();
  for (const t of comCsat) {
    const cat = t.categoria || "Sem categoria";
    if (!catm.has(cat)) catm.set(cat, { cat, n: 0, cs: 0, ts: 0, sc: 0, st: 0, res: 0, fc: 0 });
    const c = catm.get(cat)!;
    c.n++; c.cs += t.csatNota || 0; c.ts += t.tempoTotalMin;
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.status === "fechado" || t.etapa === "concluido") c.res++;
    if (t.totalReaberturas === 0) c.fc++;
  }
  const porCategoria = Array.from(catm.values()).map((c) => ({
    categoria: c.cat, tickets: c.n,
    csat: c.n > 0 ? Math.round((c.cs / c.n) * 100) / 100 : 0,
    tempoMedio: c.n > 0 ? Math.round(c.ts / c.n) : 0,
    sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
    resolucao: c.n > 0 ? Math.round((c.res / c.n) * 1000) / 10 : 0,
    fcr: c.n > 0 ? Math.round((c.fc / c.n) * 1000) / 10 : 0,
  })).sort((a, b) => a.csat - b.csat);

  const chamadosRelacionados = comCsat.filter((t) => (t.csatNota || 0) < meta).sort((a, b) => (a.csatNota || 0) - (b.csatNota || 0)).slice(0, 10).map((t) => ({
    id: t.id, protocolo: t.protocolo || "\u2014", cliente: t.clienteNome, analista: t.assigneeNome,
    categoria: t.categoria || "\u2014", csat: t.csatNota || 0,
    sla: t.slaStatus === "cumprido" ? 100 : 0,
    tempo: t.tempoTotalMin ? t.tempoTotalMin + "min" : "\u2014", status: t.status,
  }));

  const evolucao = await evolucaoDiariaCsat(inicio, fim);
  const variacao = variacaoPercentual(csatAtual, csatAnterior);

  const fp: DetalheAlerta["fatoresPrincipais"] = [];
  if (csatAtual < meta) fp.push({ icone: "\uD83D\uDCC9", texto: "CSAT m\u00e9dio " + csatAtual.toFixed(2) + " est\u00e1 " + Math.abs(diferenca).toFixed(2) + " pontos abaixo da meta (" + meta + ")", nivel: "critico" });
  if (porAnalista.length > 0 && porAnalista[0].csat < meta) fp.push({ icone: "\uD83D\uDC64", texto: "Analista " + porAnalista[0].nome + " com CSAT " + porAnalista[0].csat.toFixed(2), nivel: "atencao" });
  const catsBaixas = porCategoria.filter((c) => c.csat < meta);
  if (catsBaixas.length > 0) fp.push({ icone: "\uD83D\uDCC2", texto: catsBaixas.length + " categoria(s) com CSAT abaixo da meta", nivel: "atencao" });
  if (variacao > 0) fp.push({ icone: "\uD83D\uDCC8", texto: "CSAT piorou " + variacao.toFixed(1) + "%", nivel: "critico" });

  const rec: DetalheAlerta["recomendacoes"] = [];
  if (porAnalista.length > 0 && porAnalista[0].csat < meta) rec.push({ prioridade: "alta", titulo: "Treinar analista " + porAnalista[0].nome, descricao: "CSAT de " + porAnalista[0].csat.toFixed(2), acao: "Agendar treinamento" });
  if (catsBaixas.length > 0) rec.push({ prioridade: "media", titulo: "Revisar processos por categoria", descricao: catsBaixas.map((c) => c.categoria).join(", ") + " com CSAT baixo", acao: "Criar templates" });
  rec.push({ prioridade: "media", titulo: "CSAT proativo", descricao: "Coletar feedback apos atendimento", acao: "Configurar envio automatico" });

  const result: DetalheAlerta = { tipo: "csat_baixo", titulo: "Satisfacao abaixo da meta", nivel,
    periodo: { inicio: formatarData(inicio), fim: formatarData(fim), dias },
    valorAtual: csatAtual, meta, diferenca, percentualDiferenca: variacao,
    totalAmostra: aggAtual._count.id, regra: "CSAT medio < " + meta,
    calculo: aggAtual._count.id + " avaliacoes respondidas",
    dadosAnalise: { csatAtual, csatAnterior, totalAvaliacoes: aggAtual._count.id, totalTickets, resolvidos, taxaResolucao: totalTickets > 0 ? Math.round((resolvidos / totalTickets) * 1000) / 10 : 0 },
    fatoresPrincipais: fp, porAnalista, porCliente, porCategoria, chamadosRelacionados, evolucao,
    comparativo: csatAnterior > 0 ? { atual: csatAtual, anterior: csatAnterior, variacao } : null,
    recomendacoes: rec, analiseIa: null, };
  await enrichAnaliseIa("csat_baixo", result);
  return result;
}
async function detalharSlaBaixo(dias: number, nivel: string): Promise<DetalheAlerta> {
  const { inicio, fim } = periodRange(dias);
  const { inicio: iniPrev, fim: fimPrev } = previousRange(fim, dias);
  const totalTickets = await prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } });
  const [slaAgg, slaPrevAgg, porStatus] = await Promise.all([
    prisma.ticketMetrics.aggregate({ where: { ticket: { createdAt: { gte: inicio, lte: fim } }, slaStatus: { not: null } }, _count: { id: true } }),
    prisma.ticketMetrics.aggregate({ where: { ticket: { createdAt: { gte: iniPrev, lte: fimPrev } }, slaStatus: { not: null } }, _count: { id: true } }),
    prisma.ticketMetrics.groupBy({ by: ["slaStatus"], where: { ticket: { createdAt: { gte: inicio, lte: fim } }, slaStatus: { not: null } }, _count: { id: true } }),
  ]);
  const sm: Record<string, number> = {};
  for (const s of porStatus) sm[s.slaStatus || "desc"] = s._count.id;
  const totalComSla = slaAgg._count.id;
  const cumpridos = sm["cumprido"] || 0;
  const a75 = sm["alerta_75"] || 0;
  const a90 = sm["alerta_90"] || 0;
  const violados = sm["violado"] || 0;
  const slaPct = totalComSla > 0 ? Math.round((cumpridos / totalComSla) * 1000) / 10 : 0;
  const tickets = await coletarTicketsComCsat(inicio, fim);

  const am = new Map<string, { nome: string; n: number; sc: number; st: number; cs: number; cc: number; fc: number }>();
  for (const t of tickets) {
    if (!am.has(t.assigneeNome)) am.set(t.assigneeNome, { nome: t.assigneeNome, n: 0, sc: 0, st: 0, cs: 0, cc: 0, fc: 0 });
    const a = am.get(t.assigneeNome)!;
    a.n++;
    if (t.slaStatus) { a.st++; if (t.slaStatus === "cumprido") a.sc++; }
    if (t.totalReaberturas === 0) a.fc++;
    if (t.csatNota !== null) { a.cs += t.csatNota; a.cc++; }
  }
  const porAnalista = Array.from(am.values()).map(a => ({
    nome: a.nome, tickets: a.n,
    csat: a.cc > 0 ? Math.round((a.cs / a.cc) * 100) / 100 : 0,
    sla: a.st > 0 ? Math.round((a.sc / a.st) * 1000) / 10 : 0,
    fcr: a.n > 0 ? Math.round((a.fc / a.n) * 1000) / 10 : 0,
  })).sort((a, b) => a.sla - b.sla);

  const cm = new Map<string, { nome: string; n: number; reab: number; sc: number; st: number; cs: number; cc: number }>();
  for (const t of tickets) {
    if (!cm.has(t.clienteNome)) cm.set(t.clienteNome, { nome: t.clienteNome, n: 0, reab: 0, sc: 0, st: 0, cs: 0, cc: 0 });
    const c = cm.get(t.clienteNome)!;
    c.n++; c.reab += t.totalReaberturas;
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.csatNota !== null) { c.cs += t.csatNota; c.cc++; }
  }
  const porCliente = Array.from(cm.values()).map(c => ({
    nome: c.nome, tickets: c.n,
    csat: c.cc > 0 ? Math.round((c.cs / c.cc) * 100) / 100 : 0,
    reaberturas: c.reab,
    sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
  })).sort((a, b) => a.sla - b.sla);

  const catm = new Map<string, { cat: string; n: number; ts: number; sc: number; st: number; res: number; fc: number; cs: number; cc: number }>();
  for (const t of tickets) {
    const cat = t.categoria || "Sem categoria";
    if (!catm.has(cat)) catm.set(cat, { cat, n: 0, ts: 0, sc: 0, st: 0, res: 0, fc: 0, cs: 0, cc: 0 });
    const c = catm.get(cat)!;
    c.n++; c.ts += t.tempoTotalMin;
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.status === "fechado" || t.etapa === "concluido") c.res++;
    if (t.totalReaberturas === 0) c.fc++;
    if (t.csatNota !== null) { c.cs += t.csatNota; c.cc++; }
  }
  const porCategoria = Array.from(catm.values()).map(c => ({
    categoria: c.cat, tickets: c.n,
    csat: c.cc > 0 ? Math.round((c.cs / c.cc) * 100) / 100 : 0,
    tempoMedio: c.n > 0 ? Math.round(c.ts / c.n) : 0,
    sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
    resolucao: c.n > 0 ? Math.round((c.res / c.n) * 1000) / 10 : 0,
    fcr: c.n > 0 ? Math.round((c.fc / c.n) * 1000) / 10 : 0,
  })).sort((a, b) => a.sla - b.sla);

  const chamadosRelacionados = tickets.filter(t => t.slaStatus === "violado" || t.slaStatus === "alerta_90").slice(0, 10).map(t => ({
    id: t.id, protocolo: t.protocolo || "\u2014", cliente: t.clienteNome, analista: t.assigneeNome,
    categoria: t.categoria || "\u2014", csat: t.csatNota || 0,
    sla: t.slaStatus === "cumprido" ? 100 : t.slaStatus === "alerta_75" ? 75 : t.slaStatus === "alerta_90" ? 90 : 0,
    tempo: t.tempoTotalMin ? t.tempoTotalMin + "min" : "\u2014", status: t.status,
  }));

  const meta = 95;
  const diferenca = Math.round((slaPct - meta) * 10) / 10;
  const slaPrevTotal = slaPrevAgg._count.id;
  const slaPrevPct = slaPrevTotal > 0 ? Math.round((cumpridos / slaPrevTotal) * 1000) / 10 : 0;
  const variacao = variacaoPercentual(slaPct, slaPrevPct);
  const evolucao = await evolucaoDiaria(inicio, fim, "slaStatus", "cumprido");

  const fp: DetalheAlerta["fatoresPrincipais"] = [];
  if (violados > 0) fp.push({ icone: "\uD83D\uDD34", texto: violados + " ticket(s) com SLA violado", nivel: "critico" });
  if (a90 > 0) fp.push({ icone: "\uD83D\uDFE0", texto: a90 + " ticket(s) em alerta 90%", nivel: "atencao" });
  if (a75 > 0) fp.push({ icone: "\uD83D\uDFE1", texto: a75 + " ticket(s) em alerta 75%", nivel: "info" });
  if (porAnalista.length > 0 && porAnalista[0].sla < meta) fp.push({ icone: "\uD83D\uDC64", texto: "Analista " + porAnalista[0].nome + " com SLA " + porAnalista[0].sla.toFixed(1) + "%", nivel: "atencao" });

  const rec: DetalheAlerta["recomendacoes"] = [];
  if (violados > 0) rec.push({ prioridade: "alta", titulo: "Acao imediata nos violados", descricao: violados + " ticket(s) ultrapassaram o prazo", acao: "Revisar e priorizar" });
  if (porAnalista.length > 0 && porAnalista[0].sla < 80) rec.push({ prioridade: "media", titulo: "Revisar carga de " + porAnalista[0].nome, descricao: "SLA de " + porAnalista[0].sla.toFixed(1) + "%", acao: "Redistribuir tickets" });
  rec.push({ prioridade: "baixa", titulo: "Alertas proativos de SLA", descricao: "Notificar ao atingir 75%", acao: "Ativar notificacoes" });

  const resultSla: DetalheAlerta = { tipo: "sla_baixo", titulo: "Taxa de SLA abaixo da meta", nivel,
    periodo: { inicio: formatarData(inicio), fim: formatarData(fim), dias },
    valorAtual: slaPct, meta, diferenca, percentualDiferenca: variacao,
    totalAmostra: totalComSla, regra: "SLA cumprido < " + meta + "%",
    calculo: cumpridos + " cumpridos de " + totalComSla,
    dadosAnalise: { cumpridos, alerta75: a75, alerta90: a90, violados, totalComSla, slaPct, slaPrevPct, totalTickets },
    fatoresPrincipais: fp, porAnalista, porCliente, porCategoria, chamadosRelacionados, evolucao,
    comparativo: slaPrevPct > 0 ? { atual: slaPct, anterior: slaPrevPct, variacao } : null,
    recomendacoes: rec, analiseIa: null, };
  await enrichAnaliseIa("sla_baixo", resultSla);
  return resultSla;
}
async function detalharResolucaoBaixa(dias: number, nivel: string): Promise<DetalheAlerta> {
  const { inicio, fim } = periodRange(dias);
  const { inicio: iniPrev, fim: fimPrev } = previousRange(fim, dias);
  const [totalAtual, resAtual, totalPrev, resPrev, porStatus] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } }),
    prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim }, OR: [{ status: "fechado" }, { etapa: "concluido" }] } }),
    prisma.ticket.count({ where: { createdAt: { gte: iniPrev, lte: fimPrev } } }),
    prisma.ticket.count({ where: { createdAt: { gte: iniPrev, lte: fimPrev }, OR: [{ status: "fechado" }, { etapa: "concluido" }] } }),
    prisma.ticket.groupBy({ by: ["status"], where: { createdAt: { gte: inicio, lte: fim } }, _count: { id: true } }),
  ]);
  const taxaAtual = totalAtual > 0 ? Math.round((resAtual / totalAtual) * 1000) / 10 : 0;
  const taxaPrev = totalPrev > 0 ? Math.round((resPrev / totalPrev) * 1000) / 10 : 0;
  const meta = 80;
  const diferenca = Math.round((taxaAtual - meta) * 10) / 10;
  const variacao = variacaoPercentual(taxaAtual, taxaPrev);
  const sm: Record<string, number> = {};
  for (const s of porStatus) sm[s.status || "desc"] = s._count.id;
  const tickets = await coletarTicketsComCsat(inicio, fim);

  const am = new Map<string, { nome: string; n: number; res: number; cs: number; cc: number; sc: number; st: number; fc: number }>();
  for (const t of tickets) {
    if (!am.has(t.assigneeNome)) am.set(t.assigneeNome, { nome: t.assigneeNome, n: 0, res: 0, cs: 0, cc: 0, sc: 0, st: 0, fc: 0 });
    const ag = am.get(t.assigneeNome)!;
    ag.n++;
    if (t.status === "fechado" || t.etapa === "concluido") ag.res++;
    if (t.slaStatus) { ag.st++; if (t.slaStatus === "cumprido") ag.sc++; }
    if (t.totalReaberturas === 0) ag.fc++;
    if (t.csatNota !== null) { ag.cs += t.csatNota; ag.cc++; }
  }
  const porAnalista = Array.from(am.values()).map(ag => ({
    nome: ag.nome, tickets: ag.n,
    csat: ag.cc > 0 ? Math.round((ag.cs / ag.cc) * 100) / 100 : 0,
    sla: ag.st > 0 ? Math.round((ag.sc / ag.st) * 1000) / 10 : 0,
    fcr: ag.n > 0 ? Math.round((ag.fc / ag.n) * 1000) / 10 : 0,
  })).sort((a, b) => (a.tickets > 0 ? 1 : 0) - (b.tickets > 0 ? 1 : 0));

  const cm = new Map<string, { nome: string; n: number; reab: number; sc: number; st: number; cs: number; cc: number }>();
  for (const t of tickets) {
    if (!cm.has(t.clienteNome)) cm.set(t.clienteNome, { nome: t.clienteNome, n: 0, reab: 0, sc: 0, st: 0, cs: 0, cc: 0 });
    const c = cm.get(t.clienteNome)!;
    c.n++; c.reab += t.totalReaberturas;
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.csatNota !== null) { c.cs += t.csatNota; c.cc++; }
  }
  const porCliente = Array.from(cm.values()).map(c => ({
    nome: c.nome, tickets: c.n,
    csat: c.cc > 0 ? Math.round((c.cs / c.cc) * 100) / 100 : 0,
    reaberturas: c.reab,
    sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
  })).sort((a, b) => b.tickets - a.tickets);

  const catm = new Map<string, { cat: string; n: number; ts: number; sc: number; st: number; res: number; fc: number; cs: number; cc: number }>();
  for (const t of tickets) {
    const cat = t.categoria || "Sem categoria";
    if (!catm.has(cat)) catm.set(cat, { cat, n: 0, ts: 0, sc: 0, st: 0, res: 0, fc: 0, cs: 0, cc: 0 });
    const c = catm.get(cat)!;
    c.n++; c.ts += t.tempoTotalMin;
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.status === "fechado" || t.etapa === "concluido") c.res++;
    if (t.totalReaberturas === 0) c.fc++;
    if (t.csatNota !== null) { c.cs += t.csatNota; c.cc++; }
  }
  const porCategoria = Array.from(catm.values()).map(c => ({
    categoria: c.cat, tickets: c.n,
    csat: c.cc > 0 ? Math.round((c.cs / c.cc) * 100) / 100 : 0,
    tempoMedio: c.n > 0 ? Math.round(c.ts / c.n) : 0,
    sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
    resolucao: c.n > 0 ? Math.round((c.res / c.n) * 1000) / 10 : 0,
    fcr: c.n > 0 ? Math.round((c.fc / c.n) * 1000) / 10 : 0,
  })).sort((a, b) => a.resolucao - b.resolucao);

  const chamadosRelacionados = tickets.filter(t => t.status !== "fechado" && t.etapa !== "concluido").slice(0, 10).map(t => ({
    id: t.id, protocolo: t.protocolo || "\u2014", cliente: t.clienteNome, analista: t.assigneeNome,
    categoria: t.categoria || "\u2014", csat: 0, sla: t.slaStatus === "cumprido" ? 100 : 0,
    tempo: t.tempoTotalMin ? t.tempoTotalMin + "min" : "\u2014", status: t.status,
  }));
  const evolucao = await evolucaoDiaria(inicio, fim, "status", "fechado");

  const fp: DetalheAlerta["fatoresPrincipais"] = [];
  if (taxaAtual < meta) fp.push({ icone: "\uD83D\uDCC9", texto: "Taxa de resolucao " + taxaAtual.toFixed(1) + "% est\u00e1 " + Math.abs(diferenca).toFixed(1) + "pp abaixo da meta (" + meta + "%)", nivel: "critico" });
  if (sm["aberto"] && sm["aberto"] > totalAtual * 0.3) fp.push({ icone: "\uD83D\uDCE6", texto: sm["aberto"] + " ticket(s) em aberto", nivel: "atencao" });

  const rec: DetalheAlerta["recomendacoes"] = [];
  rec.push({ prioridade: "media", titulo: "Revisar motivos de nao resolucao", descricao: "Verificar bloqueios sistemidos", acao: "Criar categorias de motivo" });
  rec.push({ prioridade: "baixa", titulo: "Automatizar escalacao", descricao: "Escalar apos X horas", acao: "Criar regra de automacao" });

  const resultRes: DetalheAlerta = { tipo: "resolucao_baixa", titulo: "Taxa de resolucao baixa", nivel,
    periodo: { inicio: formatarData(inicio), fim: formatarData(fim), dias },
    valorAtual: taxaAtual, meta, diferenca, percentualDiferenca: variacao,
    totalAmostra: totalAtual, regra: "Resolucao < " + meta + "%",
    calculo: resAtual + " resolvidos de " + totalAtual,
    dadosAnalise: { totalAtual, resolvidos: resAtual, taxaAtual, taxaPrev, abertos: sm["aberto"] || 0, emAtendimento: sm["em_atendimento"] || 0, pendentes: sm["pendente"] || 0, fechados: sm["fechado"] || 0 },
    fatoresPrincipais: fp, porAnalista, porCliente, porCategoria, chamadosRelacionados, evolucao,
    comparativo: taxaPrev > 0 ? { atual: taxaAtual, anterior: taxaPrev, variacao } : null,
    recomendacoes: rec, analiseIa: null, };
  await enrichAnaliseIa("resolucao_baixa", resultRes);
  return resultRes;
}
async function detalharRespostaLenta(dias: number, nivel: string): Promise<DetalheAlerta> {
  const { inicio, fim } = periodRange(dias);
  const { inicio: iniPrev, fim: fimPrev } = previousRange(fim, dias);
  const [aggAtual, aggPrev, totalTickets] = await Promise.all([
    prisma.ticketMetrics.aggregate({ where: { ticket: { createdAt: { gte: inicio, lte: fim } }, tempoPrimeiraRespostaMin: { not: null } }, _avg: { tempoPrimeiraRespostaMin: true }, _count: { id: true } }),
    prisma.ticketMetrics.aggregate({ where: { ticket: { createdAt: { gte: iniPrev, lte: fimPrev } }, tempoPrimeiraRespostaMin: { not: null } }, _avg: { tempoPrimeiraRespostaMin: true } }),
    prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } }),
  ]);
  const tempoAtual = aggAtual._avg.tempoPrimeiraRespostaMin ? Math.round(aggAtual._avg.tempoPrimeiraRespostaMin) : 0;
  const tempoPrev = aggPrev._avg.tempoPrimeiraRespostaMin ? Math.round(aggPrev._avg.tempoPrimeiraRespostaMin) : 0;
  const meta = 360;
  const diferenca = Math.round((tempoAtual - meta) * 10) / 10;
  const variacao = variacaoPercentual(tempoAtual, tempoPrev);
  const tickets = await coletarTicketsComCsat(inicio, fim);
  const horasAtual = (tempoAtual / 60).toFixed(1);
  const am = new Map<string, { nome: string; n: number; ts: number; tc: number; cs: number; cc: number; sc: number; st: number; fc: number }>();
  for (const t of tickets) {
    if (!am.has(t.assigneeNome)) am.set(t.assigneeNome, { nome: t.assigneeNome, n: 0, ts: 0, tc: 0, cs: 0, cc: 0, sc: 0, st: 0, fc: 0 });
    const ag = am.get(t.assigneeNome)!; ag.n++;
    if (t.tempoPrimeiraRespostaMin) { ag.ts += t.tempoPrimeiraRespostaMin; ag.tc++; }
    if (t.slaStatus) { ag.st++; if (t.slaStatus === "cumprido") ag.sc++; }
    if (t.totalReaberturas === 0) ag.fc++;
    if (t.csatNota !== null) { ag.cs += t.csatNota; ag.cc++; }
  }
  const porAnalista = Array.from(am.values()).map(ag => ({
    nome: ag.nome, tickets: ag.n,
    csat: ag.cc > 0 ? Math.round((ag.cs / ag.cc) * 100) / 100 : 0,
    sla: ag.st > 0 ? Math.round((ag.sc / ag.st) * 1000) / 10 : 0,
    fcr: ag.n > 0 ? Math.round((ag.fc / ag.n) * 1000) / 10 : 0,
  })).sort((a, b) => { const tA = am.get(a.nome)!; const tB = am.get(b.nome)!; return (tB.tc > 0 ? tB.ts / tB.tc : 0) - (tA.tc > 0 ? tA.ts / tA.tc : 0); });
  const cm = new Map<string, { nome: string; n: number; reab: number; sc: number; st: number; cs: number; cc: number }>();
  for (const t of tickets) {
    if (!cm.has(t.clienteNome)) cm.set(t.clienteNome, { nome: t.clienteNome, n: 0, reab: 0, sc: 0, st: 0, cs: 0, cc: 0 });
    const c = cm.get(t.clienteNome)!; c.n++; c.reab += t.totalReaberturas;
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.csatNota !== null) { c.cs += t.csatNota; c.cc++; }
  }
  const porCliente = Array.from(cm.values()).map(c => ({
    nome: c.nome, tickets: c.n,
    csat: c.cc > 0 ? Math.round((c.cs / c.cc) * 100) / 100 : 0,
    reaberturas: c.reab, sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
  })).sort((a, b) => b.tickets - a.tickets);
  const catm = new Map<string, { cat: string; n: number; ts: number; tc: number; sc: number; st: number; res: number; fc: number; cs: number; cc: number }>();
  for (const t of tickets) {
    const cat = t.categoria || "Sem categoria";
    if (!catm.has(cat)) catm.set(cat, { cat, n: 0, ts: 0, tc: 0, sc: 0, st: 0, res: 0, fc: 0, cs: 0, cc: 0 });
    const c = catm.get(cat)!; c.n++;
    if (t.tempoPrimeiraRespostaMin) { c.ts += t.tempoPrimeiraRespostaMin; c.tc++; }
    if (t.slaStatus) { c.st++; if (t.slaStatus === "cumprido") c.sc++; }
    if (t.status === "fechado" || t.etapa === "concluido") c.res++;
    if (t.totalReaberturas === 0) c.fc++;
    if (t.csatNota !== null) { c.cs += t.csatNota; c.cc++; }
  }
  const porCategoria = Array.from(catm.values()).map(c => ({
    categoria: c.cat, tickets: c.n,
    csat: c.cc > 0 ? Math.round((c.cs / c.cc) * 100) / 100 : 0,
    tempoMedio: c.tc > 0 ? Math.round(c.ts / c.tc) : 0,
    sla: c.st > 0 ? Math.round((c.sc / c.st) * 1000) / 10 : 0,
    resolucao: c.n > 0 ? Math.round((c.res / c.n) * 1000) / 10 : 0,
    fcr: c.n > 0 ? Math.round((c.fc / c.n) * 1000) / 10 : 0,
  })).sort((a, b) => b.tempoMedio - a.tempoMedio);
  const chamadosRelacionados = tickets.filter(t => (t.tempoPrimeiraRespostaMin || 0) > meta).sort((a, b) => (b.tempoPrimeiraRespostaMin || 0) - (a.tempoPrimeiraRespostaMin || 0)).slice(0, 10).map(t => ({
    id: t.id, protocolo: t.protocolo || "\u2014", cliente: t.clienteNome, analista: t.assigneeNome,
    categoria: t.categoria || "\u2014", csat: 0, sla: t.slaStatus === "cumprido" ? 100 : 0,
    tempo: t.tempoPrimeiraRespostaMin ? t.tempoPrimeiraRespostaMin + "min" : "\u2014", status: t.status,
  }));
  const evolucao = await evolucaoDiaria(inicio, fim, "tempoPrimeiraRespostaMin", null);
  const fp: DetalheAlerta["fatoresPrincipais"] = [];
  if (tempoAtual > meta) fp.push({ icone: "\uD83D\uDCC9", texto: "Tempo medio de " + tempoAtual + " min (~" + horasAtual + "h) acima da meta de " + meta + " min", nivel: "critico" });
  const rec: DetalheAlerta["recomendacoes"] = [];
  rec.push({ prioridade: "alta", titulo: "Revisar distribuicao de carga", descricao: "Tempo de resposta acima da meta", acao: "Redistribuir tickets" });
  rec.push({ prioridade: "media", titulo: "Triagem automatica", descricao: "Usar IA para classificar tickets", acao: "Ativar AI Triage" });
  const resultResp: DetalheAlerta = { tipo: "resposta_lenta", titulo: "Tempo de resposta acima da meta", nivel,
    periodo: { inicio: formatarData(inicio), fim: formatarData(fim), dias },
    valorAtual: tempoAtual, meta, diferenca, percentualDiferenca: variacao,
    totalAmostra: aggAtual._count.id, regra: "PR > " + meta + " min",
    calculo: aggAtual._count.id + " tickets com PR registrada",
    dadosAnalise: { tempoAtual, tempoPrev, meta, horasAtual: parseFloat(horasAtual), totalComResposta: aggAtual._count.id, totalTickets },
    fatoresPrincipais: fp, porAnalista, porCliente, porCategoria, chamadosRelacionados, evolucao,
    comparativo: tempoPrev > 0 ? { atual: tempoAtual, anterior: tempoPrev, variacao } : null,
    recomendacoes: rec, analiseIa: null, };
  await enrichAnaliseIa("resposta_lenta", resultResp);
  return resultResp;
}
async function detalharGenerico(tipo: string, dias: number, nivel: string): Promise<DetalheAlerta> {
  const { inicio, fim } = periodRange(dias);
  const totalTickets = await prisma.ticket.count({ where: { createdAt: { gte: inicio, lte: fim } } });
  return {
    tipo, titulo: "Detalhe: " + tipo, nivel,
    periodo: { inicio: formatarData(inicio), fim: formatarData(fim), dias },
    valorAtual: "N/D", meta: "N/D", diferenca: "N/D", percentualDiferenca: 0,
    totalAmostra: totalTickets, regra: "Dados insuficientes",
    calculo: "Sem dados suficientes",
    dadosAnalise: { totalTickets },
    fatoresPrincipais: [{ icone: "\u2139\uFE0F", texto: "Dados insuficientes para analise detalhada.", nivel: "info" }],
    porAnalista: [], porCliente: [], porCategoria: [], chamadosRelacionados: [], evolucao: [],
    comparativo: null, recomendacoes: [], analiseIa: null, };
}

const NIVEL_MAP: Record<string, string> = {
  csat_baixo: "atencao", sla_baixo: "atencao", sla_violado: "critico",
  resolucao_baixa: "atencao", resposta_lenta: "atencao", taxa_sla_baixa: "atencao",
  aguardando_cliente: "atencao", parado_aguardando_os: "atencao",
  whatsapp_offline: "critico", volume_alto: "info", sla_alerta: "info", sla_em_risco: "atencao",
};

function hasClaude(): boolean {
  return !!(process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY.length > 10);
}

interface AnaliseIaResult {
  diagnostico: string;
  causas: string[];
  impacto: string;
  recomendacao: string;
  confianca: number;
}

function gerarAnaliseLocal(tipo: string, dados: DetalheAlerta): AnaliseIaResult {
  const fatores = dados.fatoresPrincipais.map((f) => f.texto);
  const recs = dados.recomendacoes.map((r) => r.titulo);

  const diagnosticoMap: Record<string, string> = {
    csat_baixo: `O CSAT está em ${dados.valorAtual} (meta: ${dados.meta}). ${fatores[0] || 'Dados insuficientes.'} ${dados.comparativo ? 'Variação de ' + dados.comparativo.variacao + '% vs período anterior.' : ''}`,
    sla_baixo: `Taxa de SLA em ${dados.valorAtual}% (meta: ${dados.meta}%). ${fatores[0] || 'Dados insuficientes.'} ${dados.comparativo ? 'Variação de ' + dados.comparativo.variacao + '% vs período anterior.' : ''}`,
    sla_violado: `SLA violado detectado. ${fatores[0] || 'Dados insuficientes.'} Requer ação imediata.`,
    resolucao_baixa: `Taxa de resolução em ${dados.valorAtual}% (meta: ${dados.meta}%). ${fatores[0] || 'Dados insuficientes.'}`,
    resposta_lenta: `Tempo médio de primeira resposta: ${dados.valorAtual}min (meta: ${dados.meta}min). ${fatores[0] || 'Dados insuficientes.'}`,
  };

  const causasMap: Record<string, string[]> = {
    csat_baixo: [
      dados.porAnalista.length > 0 ? `Analista ${dados.porAnalista[0].nome} com CSAT ${dados.porAnalista[0].csat}` : null,
      dados.porCategoria.length > 0 ? `Categoria "${dados.porCategoria[0].categoria}" com CSAT ${dados.porCategoria[0].csat}` : null,
      dados.comparativo && dados.comparativo.variacao > 0 ? 'Tendência de piora vs período anterior' : null,
    ].filter(Boolean) as string[],
    sla_baixo: [
      dados.porAnalista.length > 0 ? `Analista ${dados.porAnalista[0].nome} com SLA ${dados.porAnalista[0].sla}%` : null,
      dados.dadosAnalise['violados'] ? `${dados.dadosAnalise['violados']} tickets violados` : null,
      dados.dadosAnalise['alerta_90'] ? `${dados.dadosAnalise['alerta_90']} em alerta 90%` : null,
    ].filter(Boolean) as string[],
    sla_violado: ['SLA ultrapassado — possible sobrecarga ou falta de follow-up'],
    resolucao_baixa: [
      dados.dadosAnalise['abertos'] ? `${dados.dadosAnalise['abertos']} tickets abertos` : null,
      dados.porAnalista.length > 0 ? `Analista ${dados.porAnalista[0].nome} com menor taxa` : null,
    ].filter(Boolean) as string[],
    resposta_lenta: [
      dados.porAnalista.length > 0 ? `Analista ${dados.porAnalista[0].nome} com tempo mais alto` : null,
      'Possível gargalo na triagem ou distribuição',
    ].filter(Boolean) as string[],
  };

  const impactoMap: Record<string, string> = {
    csat_baixo: `Impacto na satisfação do cliente — pode gerar churn e reduzir NPS`,
    sla_baixo: `Compromete compromissos contratuais e pode gerar penalidades`,
    sla_violado: `Risco de perda de contrato e insatisfação crítica`,
    resolucao_baixa: `Acúmulo de tickets abertos — aumento de tempo médio e sobrecarga`,
    resposta_lenta: `Cliente aguarda tempo excessivo — impacta percepção de qualidade`,
  };

  return {
    diagnostico: diagnosticoMap[tipo] || `Análise do alerta ${tipo}: ${fatores[0] || 'sem dados suficientes'}`,
    causas: causasMap[tipo] || ['Dados insuficientes para causalidade'],
    impacto: impactoMap[tipo] || 'Impacto a ser avaliado',
    recomendacao: recs.length > 0 ? recs.join('; ') : 'Revisar dados e processos',
    confianca: fatores.length >= 2 ? 75 : fatores.length >= 1 ? 55 : 30,
  };
}

async function gerarAnaliseClaude(tipo: string, dados: DetalheAlerta): Promise<AnaliseIaResult> {
  if (!hasClaude()) return gerarAnaliseLocal(tipo, dados);

  try {
    // @ts-ignore – dynamic import, module may not be installed
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const prompt = `Analise este alerta de helpdesk e retorne APENAS um JSON válido (sem markdown, sem \`\`\`):

Tipo: ${tipo}
Valor atual: ${dados.valorAtual}
Meta: ${dados.meta}
Período: ${dados.periodo.inicio} a ${dados.periodo.fim} (${dados.periodo.dias} dias)
Amostra: ${dados.totalAmostra} tickets
Fatores: ${dados.fatoresPrincipais.map((f) => f.texto).join(' | ')}
Variação: ${dados.comparativo ? dados.comparativo.variacao + '%' : 'N/A'}

Retorne:
{"diagnostico":"...","causas":["..."],"impacto":"...","recomendacao":"...","confianca":0-100}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      diagnostico: parsed.diagnostico || '',
      causas: Array.isArray(parsed.causas) ? parsed.causas : [],
      impacto: parsed.impacto || '',
      recomendacao: parsed.recomendacao || '',
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : 70,
    };
  } catch {
    return gerarAnaliseLocal(tipo, dados);
  }
}

async function enrichAnaliseIa(tipo: string, dados: DetalheAlerta): Promise<void> {
  dados.analiseIa = await gerarAnaliseClaude(tipo, dados);
}

export async function getAlertDetail(req: { tipo: string; dias: number }): Promise<DetalheAlerta> {
  const { tipo, dias } = req;
  const safeDias = Math.max(1, Math.min(90, dias || 7));
  const nivel = NIVEL_MAP[tipo] || "info";
  switch (tipo) {
    case "csat_baixo": return detalharCsatBaixo(safeDias, nivel);
    case "sla_baixo": case "sla_violado": case "taxa_sla_baixa": case "sla_em_risco":
      return detalharSlaBaixo(safeDias, nivel);
    case "resolucao_baixa": return detalharResolucaoBaixa(safeDias, nivel);
    case "resposta_lenta": return detalharRespostaLenta(safeDias, nivel);
    default: return detalharGenerico(tipo, safeDias, nivel);
  }
}

export default { getAlertDetail };