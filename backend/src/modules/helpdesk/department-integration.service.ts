import prisma from '../../config/database';

/**
 * Mapeamento de departamentos para colunas padrão do Kanban
 */
const DEPT_KANBAN_MAP: Record<string, string> = {
  desenvolvimento: 'Desenvolvimento',
  marketing: 'Marketing',
  interface: 'Interface',
  comercial: 'Comercial',
};

/**
 * Cria tarefa no Kanban quando ticket é direcionado a outro setor
 */
export async function criarKanbanTaskDeTicket(params: {
  ticketId: string;
  departamentoId: string;
  titulo: string;
  descricao?: string;
  prioridade?: string;
  responsavelId?: string;
  prazoEntrega?: Date;
}) {
  const dept = await prisma.departamento.findUnique({
    where: { id: params.departamentoId },
    select: { id: true, nome: true, slug: true },
  });
  if (!dept) return null;

  const boards = await prisma.kanbanBoard.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, columns: { select: { id: true, nome: true, ordem: true }, orderBy: { ordem: 'asc' } } },
  });

  let board = boards.find(b =>
    b.nome.toLowerCase().includes(dept.slug.toLowerCase()) ||
    b.nome.toLowerCase().includes(dept.nome.toLowerCase())
  );
  if (!board) board = boards[0];
  if (!board) return null;

  const firstColumn = board.columns[0];
  if (!firstColumn) return null;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: { id: true, protocolo: true, contactName: true, prioridade: true },
  });

  const maxNumero = await prisma.kanbanTask.aggregate({
    _max: { numero: true },
  });
  const numero = (maxNumero._max.numero || 0) + 1;

  const kanbanTask = await prisma.kanbanTask.create({
    data: {
      numero,
      titulo: params.titulo,
      descricao: params.descricao || `Ticket #${ticket?.protocolo || params.ticketId.slice(0, 8)} — ${ticket?.contactName || 'Cliente'}`,
      columnId: firstColumn.id,
      boardId: board.id,
      ticketId: params.ticketId,
      responsavelId: params.responsavelId,
      prioridade: params.prioridade || ticket?.prioridade || 'media',
      categoria: dept.nome,
      prazoEntrega: params.prazoEntrega,
      dataInicio: new Date(),
    },
    include: {
      column: true,
      responsavel: { select: { id: true, name: true } },
    },
  });

  await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      kanbanTaskId: kanbanTask.id,
      kanbanTaskBoardId: board.id,
    },
  });

  await prisma.ticketDepartmentTime.create({
    data: {
      ticketId: params.ticketId,
      departamentoId: params.departamentoId,
      userId: params.responsavelId,
      dataInicio: new Date(),
      kanbanTaskId: kanbanTask.id,
    },
  });

  return kanbanTask;
}

/**
 * Registra tempo de departamento quando kanban task é concluída
 */
export async function registrarTempoDepartamento(kanbanTaskId: string) {
  const task = await prisma.kanbanTask.findUnique({
    where: { id: kanbanTaskId },
    select: { id: true, ticketId: true, categoria: true, dataInicio: true, dataConclusao: true },
  });
  if (!task?.ticketId) return;

  const dept = await prisma.departamento.findFirst({
    where: { OR: [{ slug: task.categoria?.toLowerCase() }, { nome: { contains: task.categoria || '', mode: 'insensitive' } }] },
    select: { id: true },
  });
  if (!dept) return;

  const existing = await prisma.ticketDepartmentTime.findFirst({
    where: { ticketId: task.ticketId, departamentoId: dept.id, kanbanTaskId },
  });
  if (!existing) return;

  const dataFim = task.dataConclusao || new Date();
  const duracaoMin = Math.round((dataFim.getTime() - existing.dataInicio.getTime()) / 60000);

  await prisma.ticketDepartmentTime.update({
    where: { id: existing.id },
    data: { dataFim, duracaoMin },
  });
}

/**
 * Retorna tempo gasto por cada departamento em um ticket
 */
export async function tempoPorDepartamento(ticketId: string) {
  const times = await prisma.ticketDepartmentTime.findMany({
    where: { ticketId },
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { dataInicio: 'asc' },
  });

  return times.map(t => ({
    id: t.id,
    departamento: t.departamento,
    usuario: t.user,
    dataInicio: t.dataInicio,
    dataFim: t.dataFim,
    duracaoMin: t.duracaoMin || (t.dataFim ? Math.round((t.dataFim.getTime() - t.dataInicio.getTime()) / 60000) : Math.round((Date.now() - t.dataInicio.getTime()) / 60000)),
    kanbanTaskId: t.kanbanTaskId,
    emAndamento: !t.dataFim,
  }));
}
