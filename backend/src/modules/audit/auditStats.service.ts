import prisma from '../../config/database';

export interface AuditStats {
  periodo: { inicio: Date; fim: Date };
  totalAcoes: number;
  porAcao: Array<{ acao: string; total: number; percentual: number }>;
  porEntidade: Array<{ entidade: string; total: number; percentual: number }>;
  porUsuario: Array<{ usuarioId: string; nome: string; total: number }>;
  porDia: Array<{ data: string; total: number }>;
  topEntidades: Array<{ entidade: string; entidadeId: string; total: number }>;
}

export async function getAuditStats(
  dataInicio?: Date,
  dataFim?: Date
): Promise<AuditStats> {
  const fim = dataFim || new Date();
  const inicio = dataInicio || new Date(fim.getTime() - 30 * 24 * 60 * 60 * 1000);

  const where = {
    createdAt: { gte: inicio, lte: fim },
  };

  const [totalAcoes, porAcaoRaw, porEntidadeRaw, porUsuarioRaw, porDiaRaw, topEntidadesRaw] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['acao'],
      _count: { _all: true },
      where,
      orderBy: { _count: { acao: 'desc' } },
      take: 20,
    }),
    prisma.auditLog.groupBy({
      by: ['entidade'],
      _count: { _all: true },
      where,
      orderBy: { _count: { entidade: 'desc' } },
    }),
    prisma.auditLog.groupBy({
      by: ['usuarioId'],
      _count: { _all: true },
      where: { ...where, usuarioId: { not: null } },
      orderBy: { _count: { usuarioId: 'desc' } },
      take: 10,
    }),
    prisma.$queryRaw<Array<{ data: string; total: bigint }>>`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') as data,
        COUNT(*) as total
      FROM "AuditLog"
      WHERE "createdAt" >= ${inicio} AND "createdAt" <= ${fim}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY data ASC
    `,
    prisma.auditLog.groupBy({
      by: ['entidade', 'entidadeId'],
      _count: { _all: true },
      where,
      orderBy: { _count: { entidadeId: 'desc' } },
      take: 10,
    }),
  ]);

  const porAcao = porAcaoRaw.map((item) => ({
    acao: item.acao,
    total: item._count._all,
    percentual: totalAcoes > 0 ? Math.round((item._count._all / totalAcoes) * 10000) / 100 : 0,
  }));

  const porEntidade = porEntidadeRaw.map((item) => ({
    entidade: item.entidade,
    total: item._count._all,
    percentual: totalAcoes > 0 ? Math.round((item._count._all / totalAcoes) * 10000) / 100 : 0,
  }));

  const userIds = porUsuarioRaw.map((item) => item.usuarioId).filter(Boolean) as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const porUsuario = porUsuarioRaw.map((item) => ({
    usuarioId: item.usuarioId || '',
    nome: userMap.get(item.usuarioId || '') || 'Sistema',
    total: item._count._all,
  }));

  const porDia = porDiaRaw.map((item) => ({
    data: item.data,
    total: Number(item.total),
  }));

  const topEntidades = topEntidadesRaw.map((item) => ({
    entidade: item.entidade,
    entidadeId: item.entidadeId || '',
    total: item._count._all,
  }));

  return {
    periodo: { inicio, fim },
    totalAcoes,
    porAcao,
    porEntidade,
    porUsuario,
    porDia,
    topEntidades,
  };
}
