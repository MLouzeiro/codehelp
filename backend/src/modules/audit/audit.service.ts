import prisma from '../../config/database';
import { Request } from 'express';

export type AuditAcao =
  | 'criar'
  | 'atualizar'
  | 'deletar'
  | 'mover_etapa'
  | 'atribuir'
  | 'descartar'
  | 'concluir'
  | 'escalar'
  | 'login'
  | 'logout'
  | 'config_alterada'
  | 'sla_alerta'
  | 'sla_pausar'
  | 'sla_retomar'
  | 'kb_criar'
  | 'kb_atualizar'
  | 'kb_deletar'
  | 'kb_publicar'
  | 'csat_receber'
  | 'regra_executar';

export type AuditEntidade =
  | 'Ticket'
  | 'User'
  | 'Client'
  | 'HelpdeskConfig'
  | 'Fila'
  | 'SLAConfig'
  | 'Categoria'
  | 'Ativo'
  | 'KBArticle'
  | 'CSATResposta'
  | 'HelpdeskRule'
  | 'Notificacao'
  | 'Session';

export interface LogParams {
  usuarioId?: string | null;
  acao: AuditAcao | string;
  entidade: AuditEntidade | string;
  entidadeId?: string | null;
  detalhes?: Record<string, any> | string | null;
  ip?: string | null;
}

export async function logAction(params: LogParams): Promise<void> {
  try {
    const detalhesStr =
      params.detalhes == null
        ? null
        : typeof params.detalhes === 'string'
        ? params.detalhes
        : JSON.stringify(params.detalhes);
    await prisma.auditLog.create({
      data: {
        usuarioId: params.usuarioId || null,
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId || null,
        detalhes: detalhesStr,
        ip: params.ip || null,
      },
    });
  } catch (err: any) {
    console.error('[AuditLog] Falha ao registrar acao:', err?.message || err);
  }
}

export function getIpFromRequest(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export interface LogFilters {
  entidade?: string;
  entidadeId?: string;
  usuarioId?: string;
  acao?: string;
  dataInicio?: Date;
  dataFim?: Date;
  limit?: number;
  offset?: number;
}

export async function getLogs(filters: LogFilters = {}) {
  const where: any = {};
  if (filters.entidade) where.entidade = filters.entidade;
  if (filters.entidadeId) where.entidadeId = filters.entidadeId;
  if (filters.usuarioId) where.usuarioId = filters.usuarioId;
  if (filters.acao) where.acao = filters.acao;
  if (filters.dataInicio || filters.dataFim) {
    where.createdAt = {};
    if (filters.dataInicio) where.createdAt.gte = filters.dataInicio;
    if (filters.dataFim) where.createdAt.lte = filters.dataFim;
  }
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { usuario: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { logs, total };
}

export async function getLogsByEntidade(entidade: string, entidadeId: string) {
  return prisma.auditLog.findMany({
    where: { entidade, entidadeId },
    include: { usuario: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
