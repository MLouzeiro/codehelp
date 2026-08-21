import prisma from '../../config/database';
import ExcelJS from 'exceljs';

export interface TaskReportFilters {
  boardId?: string;
  responsavelId?: string;
  equipeId?: string;
  departamentoId?: string;
  clientId?: string;
  ticketId?: string;
  statusPrazo?: string;
  tipoTarefa?: string;
  arquivado?: boolean;
  dataInicio?: string;
  dataFim?: string;
}

function buildWhere(filters: TaskReportFilters = {}, extra: Record<string, any> = {}) {
  const where: any = { deletedAt: null, ...extra };
  if (filters.boardId) where.boardId = filters.boardId;
  if (filters.responsavelId) where.responsavelId = filters.responsavelId;
  if (filters.equipeId) where.equipeId = filters.equipeId;
  if (filters.departamentoId) where.departamentoId = filters.departamentoId;
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.ticketId) where.ticketId = filters.ticketId;
  if (filters.statusPrazo) where.statusPrazo = filters.statusPrazo;
  if (filters.tipoTarefa) where.tipoTarefa = filters.tipoTarefa;
  if (filters.arquivado !== undefined) where.arquivado = filters.arquivado;
  return where;
}

/** Dashboard de tarefas (spec §37/§38). */
export async function getTaskDashboard(filters: TaskReportFilters = {}) {
  const where = buildWhere(filters, { ativo: true, arquivado: false });

  const [
    totalTarefas,
    concluidas,
    atrasadas,
    emAndamento,
    semPrazo,
    comPrazoProximo,
    totalEstimadoMin,
    totalTrabalhadoMin,
    porPrioridade,
    porStatusPrazo,
    porTipo,
    porResponsavel,
    porEquipe,
    porCliente,
    porTicket,
  ] = await Promise.all([
    prisma.kanbanTask.count({ where }),
    prisma.kanbanTask.count({ where: { ...where, statusPrazo: 'concluida' } }),
    prisma.kanbanTask.count({ where: { ...where, statusPrazo: 'atrasada' } }),
    prisma.kanbanTask.count({ where: { ...where, statusPrazo: { in: ['no_prazo', 'proxima', 'atencao'] } } }),
    prisma.kanbanTask.count({ where: { ...where, prazoEntrega: null } }),
    prisma.kanbanTask.count({ where: { ...where, statusPrazo: { in: ['proxima', 'atencao'] } } }),
    prisma.kanbanTask.aggregate({ where, _sum: { estimativaHoras: true } }),
    prisma.kanbanTask.aggregate({ where, _sum: { horasTrabalhadas: true } }),
    prisma.kanbanTask.groupBy({
      by: ['prioridade'], where,
      _count: { _all: true },
      orderBy: { _count: { prioridade: 'desc' } },
    }),
    prisma.kanbanTask.groupBy({
      by: ['statusPrazo'], where,
      _count: { _all: true },
      orderBy: { _count: { statusPrazo: 'desc' } },
    }),
    prisma.kanbanTask.groupBy({
      by: ['tipoTarefa'], where,
      _count: { _all: true },
      orderBy: { _count: { tipoTarefa: 'desc' } },
    }),
    prisma.kanbanTask.groupBy({
      by: ['responsavelId'], where,
      _count: { _all: true },
      _sum: { horasTrabalhadas: true, estimativaHoras: true },
      orderBy: { _count: { responsavelId: 'desc' } },
      take: 15,
    }),
    prisma.kanbanTask.groupBy({
      by: ['equipeId'], where,
      _count: { _all: true },
      _sum: { horasTrabalhadas: true },
      orderBy: { _count: { equipeId: 'desc' } },
      take: 15,
    }),
    prisma.kanbanTask.groupBy({
      by: ['clientId'], where,
      _count: { _all: true },
      _sum: { horasTrabalhadas: true },
      orderBy: { _count: { clientId: 'desc' } },
      take: 15,
    }),
    prisma.kanbanTask.groupBy({
      by: ['ticketId'], where,
      _count: { _all: true },
      _sum: { horasTrabalhadas: true },
      orderBy: { _count: { ticketId: 'desc' } },
      take: 15,
    }),
  ]);

  const [usuarios, equipes, clientes, tickets] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: porResponsavel.map((r) => r.responsavelId).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
    prisma.team.findMany({ where: { id: { in: porEquipe.map((e) => e.equipeId).filter(Boolean) as string[] } }, select: { id: true, nome: true } }),
    prisma.client.findMany({ where: { id: { in: porCliente.map((c) => c.clientId).filter(Boolean) as string[] } }, select: { id: true, razaoSocial: true, nomeFantasia: true } }),
    prisma.ticket.findMany({ where: { id: { in: porTicket.map((t) => t.ticketId).filter(Boolean) as string[] } }, select: { id: true, protocolo: true, assunto: true } }),
  ]);

  const nomeUser = (id: string | null) => usuarios.find((u) => u.id === id)?.name || 'Sem responsável';
  const nomeEquipe = (id: string | null) => equipes.find((e) => e.id === id)?.nome || 'Sem equipe';
  const nomeCliente = (id: string | null) => {
    if (!id) return 'Sem cliente';
    const c = clientes.find((x) => x.id === id);
    return c ? (c.nomeFantasia || c.razaoSocial) : 'Sem cliente';
  };
  const nomeTicket = (id: string | null) => {
    if (!id) return 'Sem ticket';
    const t = tickets.find((x) => x.id === id);
    return t ? `#${t.protocolo} - ${t.assunto}` : 'Sem ticket';
  };

  const taxa = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 1000) / 10 : 0;

  return {
    totalTarefas,
    concluidas,
    atrasadas,
    emAndamento,
    semPrazo,
    comPrazoProximo,
    taxaConclusao: taxa,
    estimadoHoras: Math.round((totalEstimadoMin._sum.estimativaHoras ?? 0) * 100) / 100,
    trabalhadoHoras: Math.round((totalTrabalhadoMin._sum.horasTrabalhadas ?? 0) * 100) / 100,
    porPrioridade: porPrioridade.map((p) => ({ prioridade: p.prioridade, total: p._count._all })),
    porStatusPrazo: porStatusPrazo.map((p) => ({ status: p.statusPrazo, total: p._count._all })),
    porTipo: porTipo.map((t) => ({ tipo: t.tipoTarefa, total: t._count._all })),
    porResponsavel: porResponsavel.map((r) => ({
      usuario: nomeUser(r.responsavelId),
      total: r._count._all,
      horas: Math.round((r._sum.horasTrabalhadas ?? 0) * 100) / 100,
      estimativa: Math.round((r._sum.estimativaHoras ?? 0) * 100) / 100,
    })),
    porEquipe: porEquipe.map((e) => ({ equipe: nomeEquipe(e.equipeId), total: e._count._all, horas: Math.round((e._sum.horasTrabalhadas ?? 0) * 100) / 100 })),
    porCliente: porCliente.map((c) => ({ cliente: nomeCliente(c.clientId), total: c._count._all, horas: Math.round((c._sum.horasTrabalhadas ?? 0) * 100) / 100 })),
    porTicket: porTicket.map((t) => ({ ticket: nomeTicket(t.ticketId), total: t._count._all, horas: Math.round((t._sum.horasTrabalhadas ?? 0) * 100) / 100 })),
  };
}

/** Lista de tarefas com filtros (relatório). */
export async function listTasksForReport(filters: TaskReportFilters = {}) {
  const where = buildWhere(filters);
  return prisma.kanbanTask.findMany({
    where,
    orderBy: [{ numero: 'desc' }],
    take: 500,
    include: {
      responsavel: { select: { id: true, name: true } },
      equipe: { select: { id: true, nome: true } },
      departamento: { select: { id: true, nome: true } },
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      ticket: { select: { id: true, protocolo: true, assunto: true } },
      column: { select: { id: true, nome: true } },
    },
  });
}

/** Exporta o relatório em CSV (separador ';' + BOM para Excel). */
export function exportTasksCsv(tasks: any[]): string {
  const header = [
    'Numero', 'Titulo', 'Coluna', 'Tipo', 'Prioridade', 'Status Prazo',
    'Responsavel', 'Equipe', 'Departamento', 'Cliente', 'Ticket',
    'Data Inicio', 'Prazo', 'Data Conclusao', 'Estimativa (h)', 'Trabalhado (h)',
  ].join(';');
  const rows = tasks.map((t) =>
    [
      `#${t.numero}`,
      `"${(t.titulo || '').replace(/"/g, '""')}"`,
      t.column?.nome ?? '',
      t.tipoTarefa ?? '',
      t.prioridade ?? '',
      t.statusPrazo ?? '',
      t.responsavel?.name ?? '',
      t.equipe?.nome ?? '',
      t.departamento?.nome ?? '',
      t.client ? (t.client.nomeFantasia || t.client.razaoSocial || '') : '',
      t.ticket ? `#${t.ticket.protocolo}` : '',
      t.dataInicio ? new Date(t.dataInicio).toLocaleString('pt-BR') : '',
      t.prazoEntrega ? new Date(t.prazoEntrega).toLocaleString('pt-BR') : '',
      t.dataConclusao ? new Date(t.dataConclusao).toLocaleString('pt-BR') : '',
      t.estimativaHoras ?? '',
      t.horasTrabalhadas ?? '',
    ].join(';')
  );
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

/** Exporta o relatório em Excel (.xlsx). */
export async function exportTasksExcel(tasks: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tarefas');
  sheet.columns = [
    { header: 'Número', key: 'numero', width: 10 },
    { header: 'Título', key: 'titulo', width: 40 },
    { header: 'Coluna', key: 'coluna', width: 20 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Prioridade', key: 'prioridade', width: 12 },
    { header: 'Status Prazo', key: 'statusPrazo', width: 14 },
    { header: 'Responsável', key: 'responsavel', width: 24 },
    { header: 'Equipe', key: 'equipe', width: 20 },
    { header: 'Departamento', key: 'departamento', width: 20 },
    { header: 'Cliente', key: 'cliente', width: 28 },
    { header: 'Ticket', key: 'ticket', width: 16 },
    { header: 'Data Início', key: 'dataInicio', width: 18 },
    { header: 'Prazo', key: 'prazo', width: 18 },
    { header: 'Data Conclusão', key: 'dataConclusao', width: 18 },
    { header: 'Estimativa (h)', key: 'estimativa', width: 14 },
    { header: 'Trabalhado (h)', key: 'trabalhado', width: 14 },
  ];
  for (const t of tasks) {
    sheet.addRow({
      numero: `#${t.numero}`,
      titulo: t.titulo,
      coluna: t.column?.nome ?? '',
      tipo: t.tipoTarefa ?? '',
      prioridade: t.prioridade ?? '',
      statusPrazo: t.statusPrazo ?? '',
      responsavel: t.responsavel?.name ?? '',
      equipe: t.equipe?.nome ?? '',
      departamento: t.departamento?.nome ?? '',
      cliente: t.client ? (t.client.nomeFantasia || t.client.razaoSocial || '') : '',
      ticket: t.ticket ? `#${t.ticket.protocolo}` : '',
      dataInicio: t.dataInicio ? new Date(t.dataInicio).toLocaleString('pt-BR') : '',
      prazo: t.prazoEntrega ? new Date(t.prazoEntrega).toLocaleString('pt-BR') : '',
      dataConclusao: t.dataConclusao ? new Date(t.dataConclusao).toLocaleString('pt-BR') : '',
      estimativa: t.estimativaHoras ?? '',
      trabalhado: t.horasTrabalhadas ?? '',
    });
  }
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}