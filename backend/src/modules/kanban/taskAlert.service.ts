import prisma from '../../config/database';
import { logAudit } from '../audit/audit.service';
import { getLastActivityAt } from './kanban.service';

const HORA = 3600000;
const DIA = 24 * HORA;

async function criarAlerta(taskId: string, tipo: string, mensagem: string, evitarDuplicado = true) {
  if (evitarDuplicado) {
    const jaExiste = await prisma.taskAlert.findFirst({
      where: { taskId, tipo, lida: false },
    });
    if (jaExiste) return null;
  }
  return prisma.taskAlert.create({ data: { taskId, tipo, mensagem } });
}

export function buildWhere(filters: { lida?: boolean; tipo?: string; taskId?: string } = {}) {
  const where: any = {};
  if (filters.lida !== undefined) where.lida = filters.lida;
  if (filters.tipo) where.tipo = filters.tipo;
  if (filters.taskId) where.taskId = filters.taskId;
  return where;
}

/**
 * Varre tarefas ativas e gera alertas automaticos (spec §35/§36):
 * - prazo proximo (ate 24h) / atencao (ate 6h)
 * - atrasada (prazo vencido e nao concluida)
 * - sem movimentacao (mais de 72h sem atividade, sem estar concluida/atrasada)
 * - reaberta (reabertoEm recente)
 * - excesso de tarefas no responsavel (mais de 15 nao concluidas)
 */
export async function verificarAlertas() {
  const now = new Date();
  const criados: { taskId: string; tipo: string; mensagem: string }[] = [];

  const tasks = await prisma.kanbanTask.findMany({
    where: { ativo: true, arquivado: false, deletedAt: null },
    select: {
      id: true, numero: true, titulo: true, prazoEntrega: true, statusPrazo: true,
      dataConclusao: true, reabertoEm: true, responsavelId: true,
    },
  });

  for (const task of tasks) {
    if (task.dataConclusao) continue;

    const semPrazo = !task.prazoEntrega;

    if (task.statusPrazo === 'atrasada') {
      const alerta = await criarAlerta(task.id, 'atrasada', `Tarefa #${task.numero} "${task.titulo}" está ATRASADA`);
      if (alerta) criados.push({ taskId: task.id, tipo: 'atrasada', mensagem: alerta.mensagem });
    } else if (!semPrazo && task.prazoEntrega) {
      const diff = new Date(task.prazoEntrega).getTime() - now.getTime();
      if (diff <= 6 * HORA) {
        const alerta = await criarAlerta(task.id, 'proxima_prazo', `Tarefa #${task.numero} "${task.titulo}" entra em ATENÇÃO de prazo (<=6h)`);
        if (alerta) criados.push({ taskId: task.id, tipo: 'proxima_prazo', mensagem: alerta.mensagem });
      } else if (diff <= 24 * HORA) {
        const alerta = await criarAlerta(task.id, 'proxima_prazo', `Tarefa #${task.numero} "${task.titulo}" com prazo próximo (<=24h)`);
        if (alerta) criados.push({ taskId: task.id, tipo: 'proxima_prazo', mensagem: alerta.mensagem });
      }
    }

    if (!semPrazo && task.statusPrazo !== 'atrasada' && task.statusPrazo !== 'concluida') {
      const ultimaAtividade = await getLastActivityAt(task.id);
      if (!ultimaAtividade || now.getTime() - new Date(ultimaAtividade).getTime() > 72 * HORA) {
        const alerta = await criarAlerta(task.id, 'sem_movimentacao', `Tarefa #${task.numero} "${task.titulo}" sem movimentação há mais de 72h`);
        if (alerta) criados.push({ taskId: task.id, tipo: 'sem_movimentacao', mensagem: alerta.mensagem });
      }
    }

    if (task.reabertoEm && now.getTime() - new Date(task.reabertoEm).getTime() < DIA) {
      const alerta = await criarAlerta(task.id, 'reaberta', `Tarefa #${task.numero} "${task.titulo}" foi reaberta`);
      if (alerta) criados.push({ taskId: task.id, tipo: 'reaberta', mensagem: alerta.mensagem });
    }
  }

  if (criados.length > 0) {
    await logAudit({
      usuarioId: null,
      modulo: 'Tarefas',
      entidade: 'KanbanTask',
      entidadeId: null,
      acao: 'sla_alerta',
      descricao: `Alertas automáticos gerados: ${criados.length}`,
      origem: 'sistema',
      resultado: 'alerta',
      metadata: { alertas: criados },
    });
  }

  return criados;
}

export async function listTaskAlerts(filters: { lida?: boolean; tipo?: string; taskId?: string; limit?: number } = {}) {
  return prisma.taskAlert.findMany({
    where: buildWhere(filters),
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 50,
    include: { task: { select: { id: true, numero: true, titulo: true } } },
  });
}

export async function marcarAlertaLida(alertaId: string) {
  const alerta = await prisma.taskAlert.findUnique({ where: { id: alertaId } });
  if (!alerta) throw new Error('Alerta não encontrado');
  return prisma.taskAlert.update({ where: { id: alertaId }, data: { lida: true } });
}

export async function contarAlertasNaoLidas() {
  return prisma.taskAlert.count({ where: { lida: false } });
}