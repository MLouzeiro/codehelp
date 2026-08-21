import prisma from '../../config/database';

export type StatusPrazo = 'no_prazo' | 'proxima' | 'atencao' | 'atrasada' | 'concluida';

export interface PrazoCalculado {
  status: StatusPrazo;
  restanteMs: number;
  excedidoMs: number;
  restanteLabel: string;
  excedidoLabel: string;
  percentualConsumido: number;
}

const HORA = 3600000;
const DIA = 24 * HORA;

/** Formata ms como "Xd Yh Zmin" / "Xh Ymin" / "Ymin". */
export function formatarDuracao(ms: number): string {
  if (ms <= 0) return '—';
  const dias = Math.floor(ms / DIA);
  const horas = Math.floor((ms % DIA) / HORA);
  const min = Math.floor((ms % HORA) / 60000);
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0) partes.push(`${horas}h`);
  if (min > 0) partes.push(`${min}min`);
  if (partes.length === 0) partes.push('0min');
  return partes.join(' ');
}

const COLUNAS_CONCLUIDA = ['concluido', 'concluida', 'done', 'feito', 'entregue', 'entregue'];

function normalizarTexto(v: string): string {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Classifica o prazo da tarefa (spec §4):
 * ⚫ CONCLUÍDA  — tarefa concluída (nunca conta como atrasada se consulta pós-prazo)
 * 🔴 ATRASADA   — prazo vencido e tarefa não concluída
 * 🟠 ATENÇÃO    — até 6h antes do prazo
 * 🟡 PRÓXIMA    — até 24h antes do prazo
 * 🟢 NO PRAZO   — mais de 24h
 */
export function classificarStatusPrazo(input: {
  prazoEntrega?: Date | null;
  dataConclusao?: Date | null;
  columnNome?: string | null;
  dataReferencia?: Date;
}): StatusPrazo {
  const agora = input.dataReferencia ?? new Date();

  const concluida = Boolean(
    input.dataConclusao ||
      (input.columnNome && COLUNAS_CONCLUIDA.some((c) => normalizarTexto(input.columnNome as string).includes(c)))
  );
  if (concluida) return 'concluida';

  if (!input.prazoEntrega) return 'no_prazo';

  const prazo = new Date(input.prazoEntrega).getTime();
  const agoraMs = agora.getTime();
  const diff = prazo - agoraMs;

  if (diff < 0) return 'atrasada';
  if (diff <= 6 * HORA) return 'atencao';
  if (diff <= 24 * HORA) return 'proxima';
  return 'no_prazo';
}

export function calcularPrazo(input: {
  prazoEntrega?: Date | null;
  dataConclusao?: Date | null;
  columnNome?: string | null;
  dataReferencia?: Date;
  estimativaHoras?: number | null;
  horasTrabalhadas?: number | null;
}): PrazoCalculado {
  const status = classificarStatusPrazo(input);
  const agora = input.dataReferencia ?? new Date();

  if (status === 'concluida') {
    return {
      status,
      restanteMs: 0,
      excedidoMs: 0,
      restanteLabel: '—',
      excedidoLabel: '—',
      percentualConsumido: 0,
    };
  }

  if (!input.prazoEntrega) {
    return {
      status,
      restanteMs: 0,
      excedidoMs: 0,
      restanteLabel: '—',
      excedidoLabel: '—',
      percentualConsumido: 0,
    };
  }

  const diff = new Date(input.prazoEntrega).getTime() - agora.getTime();

  let percentualConsumido = 0;
  if (input.estimativaHoras && input.estimativaHoras > 0) {
    const horas = input.horasTrabalhadas ?? 0;
    percentualConsumido = Math.round((horas / input.estimativaHoras) * 100);
  }

  return {
    status,
    restanteMs: Math.max(0, diff),
    excedidoMs: Math.max(0, -diff),
    restanteLabel: diff >= 0 ? formatarDuracao(diff) : '—',
    excedidoLabel: diff < 0 ? formatarDuracao(-diff) : '—',
    percentualConsumido,
  };
}

/** Grava o status do prazo na tarefa (para consultas/filtros eficientes). */
export async function atualizarStatusPrazo(taskId: string, columnNome?: string | null) {
  const task = await prisma.kanbanTask.findUnique({
    where: { id: taskId },
    select: { prazoEntrega: true, dataConclusao: true, statusPrazo: true },
  });
  if (!task) return null;

  const status = classificarStatusPrazo({
    prazoEntrega: task.prazoEntrega,
    dataConclusao: task.dataConclusao,
    columnNome: columnNome ?? null,
  });

  if (task.statusPrazo !== status) {
    await prisma.kanbanTask.update({
      where: { id: taskId },
      data: { statusPrazo: status },
    });
  }
  return status;
}

export { formatarDuracao as formatarDuracaoPrazo };