import prisma from '../../config/database';

export interface AlertFilters {
  tipo?: string;
  severidade?: string;
  status?: string;
  dataInicio?: Date;
  dataFim?: Date;
  limit?: number;
  offset?: number;
}

export async function getAuditAlerts(filters: AlertFilters = {}) {
  const where: any = {};
  if (filters.tipo) where.tipo = filters.tipo;
  if (filters.severidade) where.severidade = filters.severidade;
  if (filters.status) where.status = filters.status;
  if (filters.dataInicio || filters.dataFim) {
    where.createdAt = {};
    if (filters.dataInicio) where.createdAt.gte = filters.dataInicio;
    if (filters.dataFim) where.createdAt.lte = filters.dataFim;
  }

  const [alerts, total] = await Promise.all([
    prisma.auditAlert.findMany({
      where,
      orderBy: [{ severidade: 'asc' }, { createdAt: 'desc' }],
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.auditAlert.count({ where }),
  ]);

  return { alerts, total };
}

export async function getAuditAlertStats() {
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);

  const [pendentes, analisados, arquivados, porSeveridade, ultimas24h] = await Promise.all([
    prisma.auditAlert.count({ where: { status: 'pendente' } }),
    prisma.auditAlert.count({ where: { status: 'analisado' } }),
    prisma.auditAlert.count({ where: { status: 'arquivado' } }),
    prisma.auditAlert.groupBy({
      by: ['severidade'],
      _count: { _all: true },
      orderBy: { severidade: 'asc' },
    }),
    prisma.auditAlert.count({ where: { createdAt: { gte: hojeInicio } } }),
  ]);

  return {
    pendentes,
    analisados,
    arquivados,
    total: pendentes + analisados + arquivados,
    porSeveridade: porSeveridade.map((s) => ({
      severidade: s.severidade,
      total: s._count._all,
    })),
    ultimas24h,
  };
}

export async function marcarAlertaAnalisado(alertId: string, analisadoPor: string, justificativa?: string) {
  return prisma.auditAlert.update({
    where: { id: alertId },
    data: {
      status: 'analisado',
      analisadoPor,
      analisadoEm: new Date(),
      justificativa: justificativa || null,
    },
  });
}

export async function arquivarAlerta(alertId: string) {
  return prisma.auditAlert.update({
    where: { id: alertId },
    data: { status: 'arquivado', arquivadoEm: new Date() },
  });
}

export async function criarAlerta(params: {
  tipo: string;
  titulo: string;
  descricao: string;
  severidade?: string;
  modulo?: string;
  usuarioId?: string;
  clienteId?: string;
  entidade?: string;
  entidadeId?: string;
  metadata?: Record<string, any>;
}) {
  return prisma.auditAlert.create({
    data: {
      tipo: params.tipo,
      titulo: params.titulo,
      descricao: params.descricao,
      severidade: params.severidade || 'media',
      modulo: params.modulo || null,
      usuarioId: params.usuarioId || null,
      clienteId: params.clienteId || null,
      entidade: params.entidade || null,
      entidadeId: params.entidadeId || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}

export async function detectarEGerarAlertas(): Promise<number> {
  let criados = 0;
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);

  const exclusoesRaw = await prisma.auditLog.groupBy({
    by: ['usuarioId'],
    where: { acao: 'deletar', createdAt: { gte: umaHoraAtras } },
    _count: { _all: true },
  });
  const exclusoes = exclusoesRaw.filter((g) => (g._count._all || 0) >= 5);

  for (const g of exclusoes) {
    const existente = await prisma.auditAlert.findFirst({
      where: { tipo: 'excessao_exclusoes', usuarioId: g.usuarioId || null, status: 'pendente' },
    });
    if (!existente) {
      await criarAlerta({
        tipo: 'excessao_exclusoes',
        titulo: 'Excesso de exclusões detectada',
        descricao: `Usuário realizou ${g._count._all} exclusões na última hora`,
        severidade: 'critica',
        usuarioId: g.usuarioId || undefined,
      });
      criados++;
    }
  }

  const loginsNegadosRaw = await prisma.auditLog.groupBy({
    by: ['ip'],
    where: { acao: { in: ['login_falha', 'falha_autenticacao'] }, ip: { not: null }, createdAt: { gte: umaHoraAtras } },
    _count: { _all: true },
  });
  const loginsNegados = loginsNegadosRaw.filter((g) => (g._count._all || 0) > 5);

  for (const g of loginsNegados) {
    const existente = await prisma.auditAlert.findFirst({
      where: { tipo: 'brute_force', status: 'pendente' },
      orderBy: { createdAt: 'desc' },
    });
    const recente = existente && (Date.now() - existente.createdAt.getTime()) < 60 * 60 * 1000;
    if (!recente) {
      await criarAlerta({
        tipo: 'brute_force',
        titulo: 'Possível tentativa de força bruta',
        descricao: `IP ${g.ip} registrou ${g._count._all} falhas de login na última hora`,
        severidade: 'critica',
        metadata: { ip: g.ip, tentativas: g._count._all },
      });
      criados++;
    }
  }

  return criados;
}
