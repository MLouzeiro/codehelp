import prisma from '../../config/database';
import { generateOsNumber } from '../../shared/utils/helpers';

// ── Timeline de status (tempo por status + auditoria) ─────────────────

export const STATUS_OS: string[] = ['rascunho', 'aguardando_assinatura', 'assinada', 'em_execucao', 'concluida', 'cancelada'];

export const STATUS_OS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_assinatura: 'Aguardando Assinatura',
  assinada: 'Assinada',
  em_execucao: 'Em Execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export interface RegistrarStatusEventParams {
  orderId: string;
  statusNovo: string;
  statusAnterior?: string | null;
  observacao?: string | null;
  usuarioId?: string | null;
  origem?: string;
}

/** Registra um evento de mudança de status (timeline da OS). */
export async function registrarStatusEvent(params: RegistrarStatusEventParams) {
  return prisma.serviceOrderStatusEvent.create({
    data: {
      orderId: params.orderId,
      statusNovo: params.statusNovo,
      statusAnterior: params.statusAnterior ?? null,
      observacao: params.observacao ?? null,
      usuarioId: params.usuarioId ?? null,
      origem: params.origem ?? 'manual',
    },
  });
}

/**
 * Timeline de status da OS com duração de cada período (até o próximo evento
 * ou "em aberto" para o último status ativo).
 */
export async function listOrderTimeline(orderId: string) {
  const events = await prisma.serviceOrderStatusEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: { usuario: { select: { id: true, name: true } } },
  });

  return events.map((ev, i) => {
    const proximo = events[i + 1];
    const inicio = ev.createdAt;
    const fim = proximo?.createdAt ?? null;
    const emAndamento = !proximo;
    const duracaoMin = fim
      ? Math.round((fim.getTime() - inicio.getTime()) / 60000)
      : emAndamento
        ? Math.round((Date.now() - inicio.getTime()) / 60000)
        : 0;

    return {
      id: ev.id,
      statusAnterior: ev.statusAnterior,
      statusNovo: ev.statusNovo,
      statusLabel: STATUS_OS_LABEL[ev.statusNovo] || ev.statusNovo,
      observacao: ev.observacao,
      usuario: ev.usuario,
      origem: ev.origem,
      createdAt: ev.createdAt,
      duracaoMin,
      emAndamento,
    };
  });
}

// ── Criação a partir do ticket (integração OS no Helpdesk) ────────────

export async function createOrderFromTicket(ticketId: string, usuarioId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { client: { select: { id: true, nomeFantasia: true, razaoSocial: true } } },
  });
  if (!ticket) throw new Error('Ticket não encontrado');
  if (!ticket.clientId) throw new Error('O ticket não possui cliente vinculado. Vincule o cliente ao ticket antes de criar a OS.');

  const tecnicoResponsavelId = ticket.assigneeId || usuarioId;

  const year = new Date().getFullYear();
  let numeroOs = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.serviceOrder.count({
      where: { numeroOs: { startsWith: `OS-${year}-` } },
    });
    numeroOs = generateOsNumber(year, count + 1);
    const existing = await prisma.serviceOrder.findUnique({ where: { numeroOs } });
    if (!existing) break;
  }

  const categoria = ticket.categoria || '';
  const tipoServico =
    categoria.includes('dev') ? 'desenvolvimento'
      : categoria.includes('implant') ? 'implantacao'
        : categoria.includes('trein') ? 'treinamento'
          : 'suporte';

  const order = await prisma.serviceOrder.create({
    data: {
      numeroOs,
      clientId: ticket.clientId,
      tipoServico,
      descricaoServico: ticket.assunto || ticket.observacoes || null,
      tecnicoResponsavelId,
      ticketId: ticket.id,
      criadoPorId: usuarioId,
      status: 'rascunho',
      observacoes: ticket.assunto ? `Origem: ticket #${ticket.protocolo || ticket.id.slice(0, 8)}` : null,
    },
    include: {
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      tecnicoResponsavel: { select: { id: true, name: true } },
    },
  });

  await registrarStatusEvent({
    orderId: order.id,
    statusNovo: 'rascunho',
    statusAnterior: null,
    usuarioId,
    origem: 'sistema',
    observacao: 'OS criada a partir do ticket',
  });

  return order;
}

// ── Dashboard / Relatório de OS ────────────────────────────────────────

export interface OrderReportFilters {
  status?: string;
  tipoServico?: string;
  clientId?: string;
  tecnicoResponsavelId?: string;
  ticketId?: string;
  dataDe?: string;
  dataAte?: string;
}

function buildOrderWhere(filters: OrderReportFilters = {}) {
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.tipoServico) where.tipoServico = filters.tipoServico;
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.tecnicoResponsavelId) where.tecnicoResponsavelId = filters.tecnicoResponsavelId;
  if (filters.ticketId) where.ticketId = filters.ticketId;
  if (filters.dataDe || filters.dataAte) {
    where.createdAt = {};
    if (filters.dataDe) where.createdAt.gte = new Date(filters.dataDe);
    if (filters.dataAte) where.createdAt.lte = new Date(filters.dataAte);
  }
  return where;
}

export async function getOrdersDashboard(filters: OrderReportFilters = {}) {
  const where = buildOrderWhere(filters);

  const [
    total,
    porStatus,
    porTipo,
    porTecnico,
    totalValor,
    mediaDiasConclusao,
    valorPorStatus,
  ] = await Promise.all([
    prisma.serviceOrder.count({ where }),
    prisma.serviceOrder.groupBy({
      by: ['status'], where,
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    }),
    prisma.serviceOrder.groupBy({
      by: ['tipoServico'], where,
      _count: { _all: true },
      orderBy: { _count: { tipoServico: 'desc' } },
    }),
    prisma.serviceOrder.groupBy({
      by: ['tecnicoResponsavelId'], where,
      _count: { _all: true },
      _sum: { valorServico: true },
      orderBy: { _count: { tecnicoResponsavelId: 'desc' } },
      take: 15,
    }),
    prisma.serviceOrder.aggregate({ where, _sum: { valorServico: true } }),
    prisma.serviceOrder.findMany({
      where: { ...where, status: 'concluida', dataConclusao: { not: null } },
      select: { dataEmissao: true, dataConclusao: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ['status'], where,
      _sum: { valorServico: true },
    }),
  ]);

  const tecnicos = await prisma.user.findMany({
    where: { id: { in: porTecnico.map((t) => t.tecnicoResponsavelId).filter(Boolean) as string[] } },
    select: { id: true, name: true },
  });

  const diasConclusao = mediaDiasConclusao
    .filter((o) => o.dataConclusao)
    .map((o) => Math.max(0, Math.round((o.dataConclusao!.getTime() - o.dataEmissao.getTime()) / 86400000)));

  const contagem = (status: string) => porStatus.find((s) => s.status === status)?._count._all ?? 0;

  return {
    total,
    rascunho: contagem('rascunho'),
    aguardandoAssinatura: contagem('aguardando_assinatura'),
    assinada: contagem('assinada'),
    emExecucao: contagem('em_execucao'),
    concluida: contagem('concluida'),
    cancelada: contagem('cancelada'),
    taxaConclusao: total > 0 ? Math.round((contagem('concluida') / total) * 1000) / 10 : 0,
    valorTotal: Math.round((totalValor._sum.valorServico ?? 0) * 100) / 100,
    mediaDiasConclusao: diasConclusao.length > 0 ? Math.round((diasConclusao.reduce((a, b) => a + b, 0) / diasConclusao.length) * 10) / 10 : 0,
    porStatus: porStatus.map((s) => ({ status: s.status, total: s._count._all, valor: Math.round((valorPorStatus.find((v) => v.status === s.status)?._sum.valorServico ?? 0) * 100) / 100 })),
    porTipo: porTipo.map((t) => ({ tipo: t.tipoServico, total: t._count._all })),
    porTecnico: porTecnico.map((t) => ({
      tecnico: tecnicos.find((u) => u.id === t.tecnicoResponsavelId)?.name || 'Sem técnico',
      total: t._count._all,
      valor: Math.round((t._sum.valorServico ?? 0) * 100) / 100,
    })),
  };
}

export async function listOrdersForReport(filters: OrderReportFilters = {}) {
  const where = buildOrderWhere(filters);
  return prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      tecnicoResponsavel: { select: { id: true, name: true } },
      ticket: { select: { id: true, protocolo: true, assunto: true } },
      signature: { select: { assinadoEm: true, assinanteNome: true } },
    },
  });
}

export function exportOrdersCsv(orders: any[]): string {
  const header = [
    'Numero', 'Tipo', 'Status', 'Cliente', 'Tecnico', 'Ticket', 'Valor',
    'Data Emissao', 'Previsao', 'Data Conclusao', 'Assinado Em', 'Assinante',
  ].join(';');
  const rows = orders.map((o) =>
    [
      `#${o.numeroOs}`,
      o.tipoServico ?? '',
      o.status ?? '',
      `"${(o.client?.nomeFantasia || o.client?.razaoSocial || '').replace(/"/g, '""')}"`,
      o.tecnicoResponsavel?.name ?? '',
      o.ticket ? `#${o.ticket.protocolo}` : '',
      o.valorServico ?? '',
      o.dataEmissao ? new Date(o.dataEmissao).toLocaleString('pt-BR') : '',
      o.dataPrevistaEntrega ? new Date(o.dataPrevistaEntrega).toLocaleString('pt-BR') : '',
      o.dataConclusao ? new Date(o.dataConclusao).toLocaleString('pt-BR') : '',
      o.signature?.assinadoEm ? new Date(o.signature.assinadoEm).toLocaleString('pt-BR') : '',
      o.signature?.assinanteNome ?? '',
    ].join(';')
  );
  return '\uFEFF' + [header, ...rows].join('\r\n');
}