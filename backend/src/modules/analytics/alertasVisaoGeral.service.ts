import prisma from '../../config/database';
import { getAlertasOperacionais, AlertOperacional, ResumoAlertas } from './alertasOperacionais.service';
import { STATUS_ABERTO } from '../helpdesk/constants';

// ── Alert Engine da Visão Geral ────────────────────────────────────────
// Orquestra os alertas operacionais já existentes (getAlertasOperacionais)
// e adiciona alertas de domínios complementares com dados REAIS:
//   - Chamados em risco (aberto há muito tempo, sem movimentação, reaberto, sem justificativa, baixa avaliação)
//   - Cliente com problema recorrente
//   - Comportamento/desempenho do analista (INDÍCIO → EVIDÊNCIA → IMPACTO → RECOMENDAÇÃO)
//   - Tarefas (atrasadas, vencendo, sem responsável, bloqueadas)
//   - Desenvolvimento e Implantação
// NUNCA inventa dados — cada alerta referencia valores calculados do banco.

const DIA_MS = 24 * 60 * 60 * 1000;

function range(dias: number): { inicio: Date; fim: Date } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(fim);
  inicio.setDate(fim.getDate() - (dias - 1));
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

export async function gerarAlertasVisaoGeral(
  dias: number,
  resumo: ResumoAlertas,
): Promise<AlertOperacional[]> {
  const { inicio, fim } = range(dias);
  const agora = new Date();
  const alertas: AlertOperacional[] = [];

  // ── Base: alertas operacionais existentes ─────────────────────────
  const base = await getAlertasOperacionais(dias, resumo);
  alertas.push(...base);

  const statusAbertos = { status: { in: [...STATUS_ABERTO] }, etapa: { notIn: ['concluido', 'descartado'] } };

  // ── Chamados em risco ─────────────────────────────────────────────
  const [abertosSemMov, reabertos, baixaAvaliacao, semJustificativa, encerradosReabertos] = await Promise.all([
    prisma.ticket.findMany({
      where: { ...statusAbertos, updatedAt: { lt: new Date(agora.getTime() - 72 * 60 * 60 * 1000) } },
      select: { id: true, protocolo: true, contactName: true, assigneeId: true, updatedAt: true, etapa: true },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
    prisma.ticket.findMany({
      where: { ...statusAbertos, metrics: { is: { totalReaberturas: { gt: 0 } } } },
      select: { id: true, protocolo: true, contactName: true, assigneeId: true, metrics: { select: { totalReaberturas: true } } },
      take: 10,
    }),
    prisma.cSATResposta.findMany({
      where: { nota: { not: null, lte: 2 }, respondidoEm: { gte: inicio, lte: fim } },
      select: { ticketId: true, nota: true, respondidoEm: true, ticket: { select: { protocolo: true, contactName: true, assigneeId: true } } },
      take: 10,
    }),
    prisma.ticket.findMany({
      where: {
        createdAt: { gte: inicio, lte: fim },
        OR: [
          { motivoStatus: null },
          { motivoStatus: '' },
          { status: 'fechado', etapa: 'concluido', metrics: { is: { csatRespondido: false } } },
        ],
      },
      select: { id: true, protocolo: true, contactName: true, assigneeId: true, dataFechamento: true },
      take: 10,
    }),
    prisma.aIAgentClosureAudit.findMany({
      where: { tipo: 'reabertura', processadoEm: { gte: inicio, lte: fim } },
      select: { ticketId: true, protocolo: true, agentId: true, dataFechamento: true, mensagensAposEncerramento: true },
      orderBy: { processadoEm: 'desc' },
      take: 10,
    }),
  ]);

  const agentIds = new Set<string>();
  abertosSemMov.forEach(t => { if (t.assigneeId) agentIds.add(t.assigneeId); });
  reabertos.forEach(t => { if (t.assigneeId) agentIds.add(t.assigneeId); });
  baixaAvaliacao.forEach(c => { if (c.ticket.assigneeId) agentIds.add(c.ticket.assigneeId); });
  semJustificativa.forEach(t => { if (t.assigneeId) agentIds.add(t.assigneeId); });
  encerradosReabertos.forEach(a => { if (a.agentId) agentIds.add(a.agentId); });
  const users = await prisma.user.findMany({ where: { id: { in: Array.from(agentIds) } }, select: { id: true, name: true } });
  const nomeAgente = new Map(users.map(u => [u.id, u.name]));

  if (abertosSemMov.length > 0) {
    const t = abertosSemMov[0];
    const horas = Math.max(1, Math.round((agora.getTime() - t.updatedAt.getTime()) / (60 * 60 * 1000)));
    alertas.push({
      nivel: 'critico',
      tipo: 'chamado_sem_movimentacao',
      titulo: 'Chamado sem movimentação',
      mensagem: `${t.protocolo || '#' + t.id.slice(0, 6)} aberto há ${horas}h sem atualização${t.contactName ? ` — ${t.contactName}` : ''}.`,
      contagem: abertosSemMov.length,
      icone: 'Clock',
      dataHora: t.updatedAt.toISOString(),
      responsavel: t.assigneeId ? nomeAgente.get(t.assigneeId) : 'Não atribuído',
      origem: 'Atendimento',
      acao: 'Revisar o chamado e retomar o atendimento',
      link: `/app/helpdesk/tickets/${t.id}`,
    });
  }

  if (reabertos.length > 0) {
    const t = reabertos[0];
    alertas.push({
      nivel: 'atencao',
      tipo: 'chamado_reaberto',
      titulo: 'Chamado reaberto',
      mensagem: `${t.protocolo || '#' + t.id.slice(0, 6)} reaberto ${t.metrics?.totalReaberturas || 1}x — mesmo problema voltando${t.contactName ? ` (${t.contactName})` : ''}.`,
      contagem: reabertos.length,
      icone: 'RotateCcw',
      responsavel: t.assigneeId ? nomeAgente.get(t.assigneeId) : 'Não atribuído',
      origem: 'Atendimento',
      acao: 'Verificar causa raiz e confirmar resolução com o cliente',
      link: `/app/helpdesk/tickets/${t.id}`,
    });
  }

  if (baixaAvaliacao.length > 0) {
    const c = baixaAvaliacao[0];
    alertas.push({
      nivel: 'atencao',
      tipo: 'chamado_baixa_avaliacao',
      titulo: 'Chamado com baixa avaliação',
      mensagem: `${c.ticket.protocolo || '#' + c.ticketId.slice(0, 6)} avaliado com nota ${c.nota}/5${c.ticket.contactName ? ` — ${c.ticket.contactName}` : ''}.`,
      contagem: baixaAvaliacao.length,
      icone: 'Star',
      dataHora: c.respondidoEm?.toISOString(),
      responsavel: c.ticket.assigneeId ? nomeAgente.get(c.ticket.assigneeId) : 'Não atribuído',
      origem: 'CSAT',
      acao: 'Revisar o atendimento e entrar em contato com o cliente',
      link: `/app/helpdesk/tickets/${c.ticketId}`,
    });
  }

  if (semJustificativa.length > 0) {
    const t = semJustificativa[0];
    alertas.push({
      nivel: 'atencao',
      tipo: 'chamado_sem_justificativa',
      titulo: 'Encerramento sem justificativa',
      mensagem: `${semJustificativa.length} chamado(s) encerrado(s) sem motivo ou confirmação do cliente (ex.: ${t.protocolo || '#' + t.id.slice(0, 6)}).`,
      contagem: semJustificativa.length,
      icone: 'FileQuestion',
      responsavel: t.assigneeId ? nomeAgente.get(t.assigneeId) : 'Não atribuído',
      origem: 'Encerramento',
      acao: 'Preencher motivo e confirmar resolução com o cliente',
      link: `/app/helpdesk/tickets/${t.id}`,
    });
  }

  if (encerradosReabertos.length > 0) {
    const a = encerradosReabertos[0];
    alertas.push({
      nivel: 'critico',
      tipo: 'chamado_encerrado_reaberto',
      titulo: 'Chamado encerrado e reaberto depois',
      mensagem: `${a.protocolo || '#' + a.ticketId.slice(0, 6)} encerrado e o cliente voltou (${a.mensagensAposEncerramento} mensagem(ns) após o fechamento).`,
      contagem: encerradosReabertos.length,
      icone: 'RotateCcw',
      responsavel: a.agentId ? nomeAgente.get(a.agentId) : 'Não atribuído',
      origem: 'Auditoria de Encerramento',
      acao: 'Abrir novo atendimento e tratar a causa raiz',
      link: `/app/helpdesk/tickets/${a.ticketId}`,
    });
  }

  // ── Cliente com problema recorrente ───────────────────────────────
  const recorrentes = await clientesRecorrentes(inicio, fim);
  for (const r of recorrentes.slice(0, 3)) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'cliente_problema_recorrente',
      titulo: 'Cliente com problema recorrente',
      mensagem: `${r.cliente} abriu ${r.quantidade} chamado(s) em ${r.dias}d sobre "${r.assunto || r.categoria || 'mesmo assunto'}"${r.retrabalho ? ' — há indícios de retrabalho' : ''}. Recomenda-se analisar a causa raiz em vez de tratar os chamados individualmente.`,
      contagem: r.quantidade,
      icone: 'Repeat',
      origem: 'Padrão recorrente',
      acao: 'Investigar causa raiz e registrar solução definitiva',
      link: `/app/crm/clients/${r.clienteId}`,
    });
  }

  // ── Comportamento do analista ─────────────────────────────────────
  const analistas = await analistasEmAtencao(inicio, fim, nomeAgente);
  for (const a of analistas.slice(0, 3)) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'analista_desempenho',
      titulo: 'Analista em atenção',
      mensagem: `${a.nome}: ${a.indicadores.join(', ')}. ${a.evidencia} ${a.recomendacao}`,
      icone: 'UserX',
      origem: 'Auditoria IA',
      acao: 'Revisar amostra de atendimentos e orientar o analista',
      link: `/app/helpdesk/auditoria-analista`,
    });
  }

  // ── Tarefas ───────────────────────────────────────────────────────
  const tarefas = await alertasTarefas();
  alertas.push(...tarefas);

  // ── Desenvolvimento / Implantação ─────────────────────────────────
  const dev = await alertasTipoTarefa('dev', 'Desenvolvimento');
  alertas.push(...dev);
  const imp = await alertasTipoTarefa('implantacao', 'Implantação');
  alertas.push(...imp);

  return ordenarAlertas(alertas);
}

// ── Cliente com problema recorrente ─────────────────────────────────────
async function clientesRecorrentes(inicio: Date, fim: Date) {
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: inicio, lte: fim }, clientId: { not: null } },
    select: { clientId: true, categoria: true, assunto: true, client: { select: { razaoSocial: true, nomeFantasia: true } }, metrics: { select: { totalReaberturas: true } } },
  });

  const grupos = new Map<string, { cliente: string; clienteId: string; assunto: string; categoria: string; quantidade: number; retrabalho: boolean }>();
  for (const t of tickets) {
    const key = `${t.clientId}|${t.assunto || t.categoria || 'geral'}`;
    const g = grupos.get(key) || {
      cliente: t.client?.nomeFantasia || t.client?.razaoSocial || 'Cliente',
      clienteId: t.clientId!,
      assunto: t.assunto || '',
      categoria: t.categoria || '',
      quantidade: 0,
      retrabalho: false,
    };
    g.quantidade += 1;
    if ((t.metrics?.totalReaberturas || 0) > 0) g.retrabalho = true;
    grupos.set(key, g);
  }

  return Array.from(grupos.values())
    .filter(g => g.quantidade >= 3)
    .sort((a, b) => b.quantidade - a.quantidade)
    .map(g => ({ ...g, dias: Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / DIA_MS)) }));
}

// ── Analista em atenção (INDÍCIO → EVIDÊNCIA → RECOMENDAÇÃO) ───────────
async function analistasEmAtencao(inicio: Date, fim: Date, nomeAgente: Map<string, string>) {
  const [audits, closures, csatGroup, agentes] = await Promise.all([
    prisma.aIAgentAudit.groupBy({
      by: ['agentId'],
      where: { processadoEm: { gte: inicio, lte: fim } },
      _avg: { notaGeral: true },
      _count: { id: true },
    }),
    prisma.aIAgentClosureAudit.groupBy({
      by: ['agentId'],
      where: { processadoEm: { gte: inicio, lte: fim }, tipo: { in: ['encerramento_prematuro', 'reabertura'] } },
      _count: { id: true },
    }),
    prisma.cSATResposta.groupBy({
      by: ['ticketId'],
      where: { respondidoEm: { gte: inicio, lte: fim }, nota: { not: null } },
      _avg: { nota: true },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const csatPorTicket = new Map(agentGroup(agentGroupsForCsat(csatGroup)));
  const ticketAgent = new Map<string, string>();
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: inicio, lte: fim }, assigneeId: { not: null } },
    select: { id: true, assigneeId: true },
  });
  tickets.forEach(t => ticketAgent.set(t.id, t.assigneeId!));

  const notas = new Map<string, number[]>();
  for (const [ticketId, nota] of csatPorTicket) {
    const aid = ticketAgent.get(ticketId);
    if (aid && nota != null) {
      const list = notas.get(aid) || [];
      list.push(nota);
      notas.set(aid, list);
    }
  }

  const closuresMap = new Map(closures.map(c => [c.agentId, c._count.id]));
  const auditMap = new Map(audits.map(a => [a.agentId, a._avg.notaGeral]));
  const result: Array<{ nome: string; indicadores: string[]; evidencia: string; recomendacao: string }> = [];

  for (const ag of agentes) {
    const indicadores: string[] = [];
    const notaIa = auditMap.get(ag.id);
    if (notaIa != null && notaIa < 6) indicadores.push(`Nota IA ${notaIa.toFixed(1)}/10`);
    const problemasEncerramento = closuresMap.get(ag.id) || 0;
    if (problemasEncerramento >= 2) indicadores.push(`${problemasEncerramento} encerramento(s) questionável(is)`);
    const csat = notas.get(ag.id) || [];
    const csatMedia = csat.length ? csat.reduce((a, b) => a + b, 0) / csat.length : 0;
    if (csat.length > 0 && csatMedia < 3.5) indicadores.push(`CSAT ${csatMedia.toFixed(1)}`);

    if (indicadores.length > 0) {
      result.push({
        nome: ag.name || 'Analista',
        indicadores,
        evidencia: `Baseado em auditoria IA e avaliações do período.`,
        recomendacao: 'Revisar amostra de atendimentos e orientar procedimentos.',
      });
    }
  }

  return result.sort((a, b) => b.indicadores.length - a.indicadores.length);
}

function agentGroup(rows: Array<[string, number]>): Array<[string, number]> {
  return rows;
}

function agentGroupsForCsat(group: Array<{ ticketId: string; _avg: { nota: number | null } | null }>): Array<[string, number]> {
  return group
    .filter(g => g._avg?.nota != null)
    .map(g => [g.ticketId, g._avg!.nota as number]);
}

// ── Tarefas (kanban) ────────────────────────────────────────────────────
async function alertasTarefas(): Promise<AlertOperacional[]> {
  const agora = new Date();
  const alertas: AlertOperacional[] = [];

  const [atrasadas, semResponsavel, bloqueadas, vencendo] = await Promise.all([
    prisma.kanbanTask.findMany({
      where: { ativo: true, arquivado: false, statusPrazo: 'atrasada' },
      select: { id: true, titulo: true, responsavelId: true, prazoEntrega: true, prioridade: true },
      orderBy: { prazoEntrega: 'asc' },
      take: 10,
    }),
    prisma.kanbanTask.findMany({
      where: { ativo: true, arquivado: false, responsavelId: null, statusPrazo: { not: 'concluida' } },
      select: { id: true, titulo: true, prioridade: true },
      take: 10,
    }),
    prisma.kanbanTask.findMany({
      where: { ativo: true, arquivado: false, column: { nome: { contains: 'bloquead', mode: 'insensitive' } } },
      select: { id: true, titulo: true, responsavelId: true },
      take: 10,
    }),
    prisma.kanbanTask.findMany({
      where: { ativo: true, arquivado: false, prazoEntrega: { not: null }, dataConclusao: null },
      select: { id: true, titulo: true, responsavelId: true, prazoEntrega: true },
      take: 20,
    }),
  ]);

  if (atrasadas.length > 0) {
    const t = atrasadas[0];
    alertas.push({
      nivel: 'critico',
      tipo: 'tarefa_atrasada',
      titulo: 'Tarefa atrasada',
      mensagem: `${atrasadas.length} tarefa(s) atrasada(s) — ex.: "${t.titulo}"${t.prazoEntrega ? ` (prazo ${t.prazoEntrega.toLocaleDateString('pt-BR')})` : ''}.`,
      contagem: atrasadas.length,
      icone: 'AlertOctagon',
      responsavel: t.responsavelId ? 'Definido na tarefa' : 'Sem responsável',
      origem: 'Tarefas Internas',
      acao: 'Priorizar e concluir a tarefa',
      link: `/app/kanban`,
    });
  }

  if (semResponsavel.length > 0) {
    const t = semResponsavel[0];
    alertas.push({
      nivel: 'atencao',
      tipo: 'tarefa_sem_responsavel',
      titulo: 'Tarefa sem responsável',
      mensagem: `${semResponsavel.length} tarefa(s) sem responsável definido — ex.: "${t.titulo}".`,
      contagem: semResponsavel.length,
      icone: 'UserX',
      origem: 'Tarefas Internas',
      acao: 'Atribuir responsável',
      link: `/app/kanban`,
    });
  }

  if (bloqueadas.length > 0) {
    alertas.push({
      nivel: 'critico',
      tipo: 'tarefa_bloqueada',
      titulo: 'Tarefa bloqueada',
      mensagem: `${bloqueadas.length} tarefa(s) bloqueada(s) aguardando desbloqueio.`,
      contagem: bloqueadas.length,
      icone: 'Lock',
      origem: 'Tarefas Internas',
      acao: 'Identificar e remover o bloqueio',
      link: `/app/kanban`,
    });
  }

  const amanha = new Date(agora.getTime() + DIA_MS);
  const emBreve = new Date(agora.getTime() + 3 * DIA_MS);
  const vencendoHoje = vencendo.filter(t => t.prazoEntrega! <= amanha);
  const vencendoEmBreve = vencendo.filter(t => t.prazoEntrega! > amanha && t.prazoEntrega! <= emBreve);

  if (vencendoHoje.length > 0) {
    alertas.push({
      nivel: 'atencao',
      tipo: 'tarefa_vencendo_hoje',
      titulo: 'Tarefa vencendo hoje',
      mensagem: `${vencendoHoje.length} tarefa(s) com prazo para hoje (ex.: "${vencendoHoje[0].titulo}").`,
      contagem: vencendoHoje.length,
      icone: 'CalendarClock',
      origem: 'Tarefas Internas',
      acao: 'Concluir ou replanejar antes do fim do dia',
      link: `/app/kanban`,
    });
  }

  if (vencendoEmBreve.length > 0) {
    alertas.push({
      nivel: 'info',
      tipo: 'tarefa_vencendo_em_breve',
      titulo: 'Tarefa vencendo em breve',
      mensagem: `${vencendoEmBreve.length} tarefa(s) com prazo nos próximos 3 dias.`,
      contagem: vencendoEmBreve.length,
      icone: 'CalendarClock',
      origem: 'Tarefas Internas',
      acao: 'Acompanhar para evitar atraso',
      link: `/app/kanban`,
    });
  }

  return alertas;
}

// ── Desenvolvimento / Implantação ───────────────────────────────────────
async function alertasTipoTarefa(tipo: string, rotulo: string): Promise<AlertOperacional[]> {
  const alertas: AlertOperacional[] = [];
  const [atrasadas, abertas] = await Promise.all([
    prisma.kanbanTask.count({ where: { ativo: true, arquivado: false, tipoTarefa: tipo, statusPrazo: 'atrasada' } }),
    prisma.kanbanTask.count({ where: { ativo: true, arquivado: false, tipoTarefa: tipo, dataConclusao: null } }),
  ]);

  if (atrasadas > 0) {
    alertas.push({
      nivel: 'critico',
      tipo: `${tipo}_atrasado`,
      titulo: `${rotulo} atrasado`,
      mensagem: `${atrasadas} demanda(s) de ${rotulo.toLowerCase()} em atraso (${abertas} no total em aberto).`,
      contagem: atrasadas,
      icone: tipo === 'dev' ? 'Code2' : 'Rocket',
      origem: rotulo,
      acao: 'Priorizar demandas em atraso',
      link: `/app/kanban`,
    });
  } else if (abertas > 0) {
    alertas.push({
      nivel: 'info',
      tipo: `${tipo}_em_andamento`,
      titulo: `${rotulo} em andamento`,
      mensagem: `${abertas} demanda(s) de ${rotulo.toLowerCase()} em andamento, nenhuma atrasada.`,
      contagem: abertas,
      icone: tipo === 'dev' ? 'Code2' : 'Rocket',
      origem: rotulo,
      acao: 'Acompanhar o avanço',
      link: `/app/kanban`,
    });
  }

  return alertas;
}

// ── Ordenação por severidade ────────────────────────────────────────────
const PESO_NIVEL: Record<string, number> = { critico: 0, atencao: 1, info: 2 };

function ordenarAlertas(lista: AlertOperacional[]): AlertOperacional[] {
  return lista.sort((a, b) => (PESO_NIVEL[a.nivel] ?? 3) - (PESO_NIVEL[b.nivel] ?? 3));
}

export default { gerarAlertasVisaoGeral };