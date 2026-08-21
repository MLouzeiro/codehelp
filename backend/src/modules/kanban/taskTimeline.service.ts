import prisma from '../../config/database';
import { logAudit } from '../audit/audit.service';

export type OrigemEvento = 'manual' | 'sistema' | 'whatsapp' | 'ia' | 'mobile';

export interface RegistrarEventoParams {
  taskId: string;
  numero: number;
  usuarioId?: string | null;
  tipo: string;
  descricao: string;
  deColuna?: string | null;
  paraColuna?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  origem?: OrigemEvento;
  motivo?: string | null;
  metadata?: Record<string, any> | null;
  visivelCliente?: boolean;
  gravarAuditoria?: boolean;
}

/**
 * Timeline estruturada da tarefa (spec §1/§2/§19).
 * Grava um evento rico (antes×depois, origem, motivo, metadata) em KanbanActivity
 * e, opcionalmente, espelha na auditoria global (AuditLog).
 */
export async function registrarEvento(params: RegistrarEventoParams): Promise<any> {
  const activity = await prisma.kanbanActivity.create({
    data: {
      taskId: params.taskId,
      usuarioId: params.usuarioId ?? null,
      tipo: params.tipo,
      descricao: params.descricao,
      deColuna: params.deColuna ?? null,
      paraColuna: params.paraColuna ?? null,
      valorAnterior: params.valorAnterior ?? null,
      valorNovo: params.valorNovo ?? null,
      origem: params.origem ?? 'manual',
      motivo: params.motivo ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      visivelCliente: params.visivelCliente ?? false,
    },
  });

  if (params.gravarAuditoria !== false) {
    await logAudit({
      usuarioId: params.usuarioId ?? null,
      modulo: 'Tarefas',
      entidade: 'KanbanTask',
      entidadeId: params.taskId,
      acao: params.tipo,
      descricao: params.descricao,
      valorAnterior: params.valorAnterior ?? undefined,
      novoValor: params.valorNovo ?? undefined,
      motivo: params.motivo ?? undefined,
      origem: params.origem ?? 'web',
      metadata: params.metadata ?? undefined,
    });
  }

  return activity;
}

export async function getTaskTimeline(taskId: string) {
  return prisma.kanbanActivity.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    include: { usuario: { select: { id: true, name: true, email: true } } },
  });
}

const CAMPOS_LABEL: Record<string, string> = {
  titulo: 'Título',
  descricao: 'Descrição',
  responsavelId: 'Responsável',
  clientId: 'Cliente',
  ticketId: 'Ticket',
  orderId: 'Ordem de serviço',
  departamentoId: 'Departamento',
  equipeId: 'Equipe',
  prioridade: 'Prioridade',
  categoria: 'Categoria',
  classificacao: 'Classificação',
  prazoEntrega: 'Prazo de entrega',
  dataInicio: 'Data de início',
  dataConclusao: 'Data de conclusão',
  estimativaHoras: 'Estimativa (h)',
  tipoTarefa: 'Tipo de tarefa',
  statusPrazo: 'Status do prazo',
};

/** Diferencia dois objetos e retorna eventos prontos para registrar. */
export function diferenciarCampos(
  antes: Record<string, any>,
  depois: Record<string, any>,
  campos: string[],
  numero: number,
  taskId: string,
  usuarioId?: string | null,
  origem: OrigemEvento = 'manual'
): Omit<RegistrarEventoParams, 'descricao'>[] {
  const eventos: Omit<RegistrarEventoParams, 'descricao'>[] = [];
  for (const campo of campos) {
    const valorAntes = antes[campo];
    const valorDepois = depois[campo];
    if (valorAntes === valorDepois) continue;
    const label = CAMPOS_LABEL[campo] || campo;
    eventos.push({
      taskId,
      numero,
      usuarioId,
      tipo: 'alterou_campo',
      valorAnterior: valorAntes == null ? '—' : String(valorAntes),
      valorNovo: valorDepois == null ? '—' : String(valorDepois),
      origem,
      metadata: { campo },
    });
  }
  return eventos;
}

export const CAMPOS_DIFF: string[] = [
  'titulo',
  'descricao',
  'responsavelId',
  'clientId',
  'ticketId',
  'orderId',
  'departamentoId',
  'equipeId',
  'prioridade',
  'categoria',
  'classificacao',
  'prazoEntrega',
  'dataInicio',
  'dataConclusao',
  'estimativaHoras',
  'tipoTarefa',
];