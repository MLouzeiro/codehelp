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
  | 'regra_executar'
  | 'arquivar'
  | 'restaurar'
  | 'reabrir'
  | 'excluir_definitivo'
  | 'alterar_prazo'
  | 'alterar_responsavel'
  | 'alterar_prioridade'
  | 'alterar_status'
  | 'alterar_departamento'
  | 'alterar_equipe'
  | 'alterar_descricao'
  | 'alterar_titulo'
  | 'iniciar_tempo'
  | 'pausar_tempo'
  | 'retomar_tempo'
  | 'encerrar_tempo'
  | 'ajuste_manual_tempo'
  | 'sobreposicao_tempo'
  | 'comentar'
  | 'anexar'
  | 'checklist_alterado'
  | 'dependencia_criada'
  | 'dependencia_removida'
  | 'vincular_ticket'
  | 'desvincular_ticket'
  | 'equipe_criada'
  | 'equipe_alterada'
  | 'equipe_deletada'
  | 'membro_adicionado'
  | 'membro_removido';

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
  | 'Session'
  | 'KanbanTask'
  | 'KanbanBoard'
  | 'Team'
  | 'TimeEntry';

export interface LogParams {
  usuarioId?: string | null;
  acao: AuditAcao | string;
  entidade: AuditEntidade | string;
  entidadeId?: string | null;
  detalhes?: Record<string, any> | string | null;
  ip?: string | null;
}

export interface AuditLogParams {
  usuarioId?: string | null;
  modulo?: string;
  entidade: AuditEntidade | string;
  entidadeId?: string | null;
  acao: AuditAcao | string;
  descricao?: string | null;
  valorAnterior?: string | null;
  novoValor?: string | null;
  motivo?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  origem?: string | null;
  resultado?: string | null;
  metadata?: Record<string, any> | string | null;
  severity?: string | null;
  clienteId?: string | null;
  success?: boolean | null;
  errorMessage?: string | null;
  requestId?: string | null;
  fonte?: string | null;
  entidadeRelacionada?: string | null;
  entidadeRelacionadaId?: string | null;
}

function serialize(v: Record<string, any> | string | null | undefined): string | null {
  if (v == null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/**
 * Auditoria global reutilizavel (spec §45). Deve ser chamada por todos os modulos.
 * O registro e imutavel: nao existem rotas de UPDATE/DELETE para AuditLog.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: params.usuarioId || null,
        modulo: params.modulo || null,
        entidade: params.entidade,
        entidadeId: params.entidadeId || null,
        acao: params.acao,
        detalhes: serialize(params.metadata) || params.descricao || null,
        valorAnterior: params.valorAnterior ?? null,
        novoValor: params.novoValor ?? null,
        userAgent: params.userAgent || null,
        origem: params.origem || null,
        resultado: params.resultado || null,
        metadata: serialize(params.metadata) ?? null,
        ip: params.ip || null,
        severity: params.severity || 'baixa',
        clienteId: params.clienteId || null,
        success: params.success ?? null,
        errorMessage: params.errorMessage || null,
        requestId: params.requestId || null,
        fonte: params.fonte || 'manual',
        entidadeRelacionada: params.entidadeRelacionada || null,
        entidadeRelacionadaId: params.entidadeRelacionadaId || null,
      },
    });
  } catch (err: any) {
    console.error('[AuditLog] Falha ao registrar acao:', err?.message || err);
  }
}

/** Mantem compatibilidade com chamadas existentes que usam logAction. */
export async function logAction(params: LogParams): Promise<void> {
  await logAudit({
    usuarioId: params.usuarioId,
    modulo: params.entidade,
    entidade: params.entidade,
    entidadeId: params.entidadeId,
    acao: params.acao,
    descricao:
      typeof params.detalhes === 'string'
        ? params.detalhes
        : params.detalhes != null
          ? JSON.stringify(params.detalhes)
          : null,
    ip: params.ip,
  });
}

export function getIpFromRequest(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export function getUserAgentFromRequest(req: Request): string | null {
  return req.headers['user-agent'] || null;
}

export interface LogFilters {
  entidade?: string;
  entidadeId?: string;
  usuarioId?: string;
  acao?: string;
  modulo?: string;
  origem?: string;
  resultado?: string;
  search?: string;
  dataInicio?: Date;
  dataFim?: Date;
  limit?: number;
  offset?: number;
  severity?: string;
  clienteId?: string;
  success?: boolean;
  fonte?: string;
}

export async function getLogs(filters: LogFilters = {}) {
  const where: any = {};
  if (filters.entidade) where.entidade = filters.entidade;
  if (filters.entidadeId) where.entidadeId = filters.entidadeId;
  if (filters.usuarioId) where.usuarioId = filters.usuarioId;
  if (filters.acao) where.acao = filters.acao;
  if (filters.modulo) where.modulo = filters.modulo;
  if (filters.origem) where.origem = filters.origem;
  if (filters.resultado) where.resultado = filters.resultado;
  if (filters.severity) where.severity = filters.severity;
  if (filters.clienteId) where.clienteId = filters.clienteId;
  if (filters.fonte) where.fonte = filters.fonte;
  if (filters.success !== undefined && filters.success !== null) where.success = filters.success;
  if (filters.dataInicio || filters.dataFim) {
    where.createdAt = {};
    if (filters.dataInicio) where.createdAt.gte = filters.dataInicio;
    if (filters.dataFim) where.createdAt.lte = filters.dataFim;
  }
  if (filters.search) {
    const term = filters.search;
    where.OR = [
      { detalhes: { contains: term, mode: 'insensitive' } },
      { acao: { contains: term, mode: 'insensitive' } },
      { entidade: { contains: term, mode: 'insensitive' } },
      { entidadeId: { contains: term, mode: 'insensitive' } },
      { valorAnterior: { contains: term, mode: 'insensitive' } },
      { novoValor: { contains: term, mode: 'insensitive' } },
      { modulo: { contains: term, mode: 'insensitive' } },
      { errorMessage: { contains: term, mode: 'insensitive' } },
      { usuario: { is: { name: { contains: term, mode: 'insensitive' } } } },
    ];
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

/** Indicadores do dashboard de auditoria (spec §43/§44). */
export async function getAuditDashboardStats(filters: {
  dataInicio?: Date;
  dataFim?: Date;
} = {}) {
  const where: any = {};
  if (filters.dataInicio || filters.dataFim) {
    where.createdAt = {};
    if (filters.dataInicio) where.createdAt.gte = filters.dataInicio;
    if (filters.dataFim) where.createdAt.lte = filters.dataFim;
  }

  const periodoAnterior: any = {};
  if (filters.dataInicio && filters.dataFim) {
    const diffMs = filters.dataFim.getTime() - filters.dataInicio.getTime();
    periodoAnterior.createdAt = {
      gte: new Date(filters.dataInicio.getTime() - diffMs),
      lt: filters.dataInicio,
    };
  } else {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);
    const mesInicio = new Date(hojeInicio);
    mesInicio.setDate(mesInicio.getDate() - 30);
    const mesAnteriorInicio = new Date(mesInicio);
    mesAnteriorInicio.setDate(mesAnteriorInicio.getDate() - 30);
    periodoAnterior.createdAt = { gte: mesAnteriorInicio, lt: mesInicio };
  }

  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  const semanaInicio = new Date(hojeInicio);
  semanaInicio.setDate(semanaInicio.getDate() - 7);
  const mesInicio = new Date(hojeInicio);
  mesInicio.setDate(mesInicio.getDate() - 30);

  const [
    hoje, semana, mes, ativos, acoesCriticas,
    totalEventos, totalAnterior,
    falhasAuth, falhasAuthAnterior,
    tentativasBloqueadas, tentativasBloqueadasAnterior,
    logins, loginsAnterior,
    alteracoesPermissao, alteracoesPermissaoAnterior,
    exclusoes, exclusoesAnterior,
    acoesApi, acoesApiAnterior,
    acoesAutomaticas, acoesIa,
    eventosSuspeitos, eventosCriticos, eventosMedios, eventosBaixa,
    acoesViaApi,
  ] = await Promise.all([
    prisma.auditLog.count({ where: { ...where, createdAt: { gte: hojeInicio } } }),
    prisma.auditLog.count({ where: { ...where, createdAt: { gte: semanaInicio } } }),
    prisma.auditLog.count({ where: { ...where, createdAt: { gte: mesInicio } } }),
    prisma.auditLog.groupBy({
      by: ['usuarioId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { usuarioId: 'desc' } },
      take: 10,
    }),
    prisma.auditLog.count({
      where: {
        ...where,
        OR: [
          { acao: 'alterar_prazo' },
          { acao: 'alterar_responsavel' },
          { acao: 'ajuste_manual_tempo' },
          { acao: 'excluir_definitivo' },
          { acao: 'deletar' },
          { acao: 'reabrir' },
          { acao: 'arquivar' },
        ],
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: periodoAnterior }),
    prisma.auditLog.count({ where: { ...where, acao: { in: ['login_falha', 'falha_autenticacao'] } } }),
    prisma.auditLog.count({ where: { ...periodoAnterior, acao: { in: ['login_falha', 'falha_autenticacao'] } } }),
    prisma.auditLog.count({ where: { ...where, acao: { in: ['acesso_bloqueado', 'tentativa_acesso_negado'] } } }),
    prisma.auditLog.count({ where: { ...periodoAnterior, acao: { in: ['acesso_bloqueado', 'tentativa_acesso_negado'] } } }),
    prisma.auditLog.count({ where: { ...where, acao: 'login' } }),
    prisma.auditLog.count({ where: { ...periodoAnterior, acao: 'login' } }),
    prisma.auditLog.count({ where: { ...where, acao: { in: ['permissao_adicionada', 'permissao_removida', 'perfil_alterado'] } } }),
    prisma.auditLog.count({ where: { ...periodoAnterior, acao: { in: ['permissao_adicionada', 'permissao_removida', 'perfil_alterado'] } } }),
    prisma.auditLog.count({ where: { ...where, acao: 'deletar' } }),
    prisma.auditLog.count({ where: { ...periodoAnterior, acao: 'deletar' } }),
    prisma.auditLog.count({ where: { ...where, fonte: 'api' } }),
    prisma.auditLog.count({ where: { ...periodoAnterior, fonte: 'api' } }),
    prisma.auditLog.count({ where: { ...where, fonte: 'automatico' } }),
    prisma.auditLog.count({ where: { ...where, fonte: 'ia' } }),
    prisma.auditLog.count({ where: { ...where, severity: { in: ['suspeito', 'critica'] } } }),
    prisma.auditLog.count({ where: { ...where, severity: 'critica' } }),
    prisma.auditLog.count({ where: { ...where, severity: 'media' } }),
    prisma.auditLog.count({ where: { ...where, severity: 'baixa' } }),
    prisma.auditLog.count({ where: { ...where, fonte: 'api' } }),
  ]);

  const usuariosAtivos = await prisma.user.findMany({
    where: { id: { in: ativos.map((a) => a.usuarioId).filter(Boolean) as string[] } },
    select: { id: true, name: true },
  });

  const porAcao = await prisma.auditLog.groupBy({
    by: ['acao'],
    where,
    _count: { _all: true },
    orderBy: { _count: { acao: 'desc' } },
    take: 15,
  });

  const calcDelta = (atual: number, anterior: number) => {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  };

  return {
    totalEventos,
    totalAnterior,
    deltaTotal: calcDelta(totalEventos, totalAnterior),
    eventosHoje: hoje,
    eventos7dias: semana,
    eventos30dias: mes,
    acoesCriticas,
    usuariosMaisAtivos: ativos.map((a) => ({
      usuario: usuariosAtivos.find((u) => u.id === a.usuarioId)?.name || 'Sistema',
      total: a._count._all,
    })),
    topAcoes: porAcao.map((a) => ({ acao: a.acao, total: a._count._all })),
    falhasAuth,
    deltaFalhasAuth: calcDelta(falhasAuth, falhasAuthAnterior),
    tentativasBloqueadas,
    deltaBloqueadas: calcDelta(tentativasBloqueadas, tentativasBloqueadasAnterior),
    logins,
    deltaLogins: calcDelta(logins, loginsAnterior),
    alteracoesPermissao,
    deltaPermissoes: calcDelta(alteracoesPermissao, alteracoesPermissaoAnterior),
    exclusoes,
    deltaExclusoes: calcDelta(exclusoes, exclusoesAnterior),
    acoesApi,
    deltaApi: calcDelta(acoesApi, acoesApiAnterior),
    acoesAutomaticas,
    acoesIa,
    eventosSuspeitos,
    eventosCriticos,
    eventosMedios,
    eventosBaixa,
    acoesViaApi,
  };
}