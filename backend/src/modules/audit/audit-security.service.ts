import prisma from '../../config/database';

export interface SecurityFilters {
  dataInicio?: Date;
  dataFim?: Date;
  usuarioId?: string;
  limit?: number;
  offset?: number;
}

function calcDelta(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function periodoAnterior(dataInicio?: Date, dataFim?: Date): any {
  if (dataInicio && dataFim) {
    const diffMs = dataFim.getTime() - dataInicio.getTime();
    return {
      createdAt: {
        gte: new Date(dataInicio.getTime() - diffMs),
        lt: dataInicio,
      },
    };
  }
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  const mesInicio = new Date(hojeInicio);
  mesInicio.setDate(mesInicio.getDate() - 30);
  const mesAnteriorInicio = new Date(mesInicio);
  mesAnteriorInicio.setDate(mesAnteriorInicio.getDate() - 30);
  return { createdAt: { gte: mesAnteriorInicio, lt: mesInicio } };
}

function filtroBase(dataInicio?: Date, dataFim?: Date, usuarioId?: string): any {
  const where: any = {};
  if (dataInicio || dataFim) {
    where.createdAt = {};
    if (dataInicio) where.createdAt.gte = dataInicio;
    if (dataFim) where.createdAt.lte = dataFim;
  }
  if (usuarioId) where.usuarioId = usuarioId;
  return where;
}

export async function getSecurityIndicators(filters: SecurityFilters = {}) {
  const where = filtroBase(filters.dataInicio, filters.dataFim, filters.usuarioId);
  const anterior = periodoAnterior(filters.dataInicio, filters.dataFim);

  const [
    tentativasLogin, loginsSucesso, loginsRecusados,
    falhasConsecutivas, acessoNegadoModulos, acessoNegadoRegistros,
    alteracoesSenha, alteracoesPermissoes, criacaoUsuarios,
    exclusaoUsuarios, usuariosDesativados, sessoesEncerradas,
    tentativasBloqueadas, eventosCriticos, acoesApi,
  ] = await Promise.all([
    prisma.auditLog.count({ where: { ...where, acao: { in: ['login', 'login_falha', 'falha_autenticacao'] } } }),
    prisma.auditLog.count({ where: { ...where, acao: 'login', success: true } }),
    prisma.auditLog.count({ where: { ...where, acao: { in: ['login_falha', 'falha_autenticacao'] } } }),
    prisma.auditLog.count({ where: { ...where, acao: 'falha_autenticacao' } }),
    prisma.auditLog.count({ where: { ...where, acao: 'tentativa_acesso_negado', entidade: 'modulo' } }),
    prisma.auditLog.count({ where: { ...where, acao: 'tentativa_acesso_negado', entidade: { not: 'modulo' } } }),
    prisma.auditLog.count({ where: { ...where, acao: 'alterar_senha' } }),
    prisma.auditLog.count({ where: { ...where, acao: { in: ['permissao_adicionada', 'permissao_removida', 'perfil_alterado'] } } }),
    prisma.auditLog.count({ where: { ...where, acao: 'criar', entidade: 'User' } }),
    prisma.auditLog.count({ where: { ...where, acao: 'deletar', entidade: 'User' } }),
    prisma.auditLog.count({ where: { ...where, acao: 'desativar_usuario' } }),
    prisma.auditLog.count({ where: { ...where, acao: 'logout' } }),
    prisma.auditLog.count({ where: { ...where, acao: { in: ['acesso_bloqueado', 'tentativa_acesso_negado'] } } }),
    prisma.auditLog.count({ where: { ...where, severity: { in: ['suspeito', 'critica'] } } }),
    prisma.auditLog.count({ where: { ...where, fonte: 'api' } }),
  ]);

  const antLogin = await prisma.auditLog.count({ where: { ...anterior, acao: { in: ['login', 'login_falha', 'falha_autenticacao'] } } });
  const antSucesso = await prisma.auditLog.count({ where: { ...anterior, acao: 'login', success: true } });
  const antRecusados = await prisma.auditLog.count({ where: { ...anterior, acao: { in: ['login_falha', 'falha_autenticacao'] } } });
  const antBloqueadas = await prisma.auditLog.count({ where: { ...anterior, acao: { in: ['acesso_bloqueado', 'tentativa_acesso_negado'] } } });
  const antPermissoes = await prisma.auditLog.count({ where: { ...anterior, acao: { in: ['permissao_adicionada', 'permissao_removida', 'perfil_alterado'] } } });
  const antCriticos = await prisma.auditLog.count({ where: { ...anterior, severity: { in: ['suspeito', 'critica'] } } });

  const ipsPorUsuarioRaw = await prisma.auditLog.groupBy({
    by: ['usuarioId'],
    where: { ...where, ip: { not: null } },
    _count: { ip: true },
    orderBy: { _count: { ip: 'desc' } },
    take: 50,
  });
  const ipsPorUsuario = ipsPorUsuarioRaw.filter((u: any) => (u._count.ip || 0) > 3).slice(0, 10);

  return {
    tentativasLogin,
    deltaTentativas: calcDelta(tentativasLogin, antLogin),
    loginsSucesso,
    deltaSucesso: calcDelta(loginsSucesso, antSucesso),
    loginsRecusados,
    deltaRecusados: calcDelta(loginsRecusados, antRecusados),
    falhasConsecutivas,
    acessoNegadoModulos,
    acessoNegadoRegistros,
    alteracoesSenha,
    alteracoesPermissoes,
    deltaPermissoes: calcDelta(alteracoesPermissoes, antPermissoes),
    criacaoUsuarios,
    exclusaoUsuarios,
    usuariosDesativados,
    sessoesEncerradas,
    tentativasBloqueadas,
    deltaBloqueadas: calcDelta(tentativasBloqueadas, antBloqueadas),
    eventosCriticos,
    deltaCriticos: calcDelta(eventosCriticos, antCriticos),
    acoesApi,
    ipsMultiplos: ipsPorUsuario.length,
  };
}

export async function getAnomalias(filters: SecurityFilters = {}) {
  const where = filtroBase(filters.dataInicio, filters.dataFim, filters.usuarioId);
  const alertas: Array<{
    tipo: string;
    titulo: string;
    descricao: string;
    severidade: string;
    usuarioId?: string;
    dataHora: Date;
    modulo?: string;
    motivo: string;
    acaoRecomendada: string;
  }> = [];

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  const exclusoesRecentesRaw = await prisma.auditLog.groupBy({
    by: ['usuarioId'],
    where: { ...where, acao: 'deletar', createdAt: { gte: umaHoraAtras } },
    _count: { _all: true },
  });
  const exclusoesRecentes = exclusoesRecentesRaw.filter((g: any) => (g._count?._all || 0) >= 5).slice(0, 10);

  for (const grupo of exclusoesRecentes) {
    alertas.push({
      tipo: 'excessao_exclusoes',
      titulo: 'Excesso de exclusões detectada',
      descricao: `Usuário realizou ${grupo._count._all} exclusões na última hora`,
      severidade: 'critica',
      usuarioId: grupo.usuarioId || undefined,
      dataHora: umaHoraAtras,
      motivo: 'Padrão anormal de exclusões em curto período',
      acaoRecomendada: 'Verificar se as exclusões são legítimas e se há backup',
    });
  }

  const loginsNegadosRaw = await prisma.auditLog.groupBy({
    by: ['ip'],
    where: { ...where, acao: { in: ['login_falha', 'falha_autenticacao'] }, ip: { not: null }, createdAt: { gte: umaHoraAtras } },
    _count: { _all: true },
  });
  const loginsNegados = loginsNegadosRaw.filter((g: any) => (g._count?._all || 0) >= 5).slice(0, 10);

  for (const grupo of loginsNegados) {
    alertas.push({
      tipo: 'brute_force',
      titulo: 'Possível tentativa de força bruta',
      descricao: `IP ${grupo.ip} registrou ${grupo._count._all} falhas de login na última hora`,
      severidade: 'critica',
      dataHora: umaHoraAtras,
      motivo: 'Múltiplas falhas de login do mesmo IP em curto período',
      acaoRecomendada: 'Verificar se é tentativa de acesso não autorizado',
    });
  }

  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const permissoesRecentes = await prisma.auditLog.findMany({
    where: {
      ...where,
      acao: { in: ['permissao_adicionada', 'permissao_removida', 'perfil_alterado'] },
      createdAt: { gte: tresDiasAtras },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (permissoesRecentes.length >= 3) {
    alertas.push({
      tipo: 'alteracao_permissoes_frequente',
      titulo: 'Alterações frequentes de permissões',
      descricao: `${permissoesRecentes.length} alterações de permissão nos últimos 3 dias`,
      severidade: 'alta',
      dataHora: permissoesRecentes[0].createdAt,
      motivo: 'Mudanças frequentes de permissão podem indicar problema de governança',
      acaoRecomendada: 'Revisar as alterações de permissão e validar com o gestor',
    });
  }

  const umaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const acessosForaHorario = await prisma.auditLog.findMany({
    where: {
      ...where,
      acao: 'login',
      createdAt: { gte: umaSemanaAtras },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const acessosNoturnos = acessosForaHorario.filter((l) => {
    const h = l.createdAt.getHours();
    return h >= 22 || h < 6;
  });

  if (acessosNoturnos.length >= 3) {
    const usuariosNoturnos = [...new Set(acessosNoturnos.map((a) => a.usuarioId).filter(Boolean))];
    alertas.push({
      tipo: 'acesso_fora_horario',
      titulo: 'Atividade fora do horário habitual',
      descricao: `${acessosNoturnos.length} logins realizados entre 22h e 6h por ${usuariosNoturnos.length} usuário(s)`,
      severidade: 'media',
      dataHora: acessosNoturnos[0].createdAt,
      motivo: 'Atividade fora do horário comercial pode indicar acesso não autorizado',
      acaoRecomendada: 'Verificar se os logins noturnos são autorizados',
    });
  }

  alertas.sort((a, b) => {
    const ordem: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
    return (ordem[a.severidade] ?? 4) - (ordem[b.severidade] ?? 4);
  });

  return alertas;
}

export async function getUserTimeline(usuarioId: string, filters: SecurityFilters = {}) {
  const where: any = { usuarioId };
  if (filters.dataInicio || filters.dataFim) {
    where.createdAt = {};
    if (filters.dataInicio) where.createdAt.gte = filters.dataInicio;
    if (filters.dataFim) where.createdAt.lte = filters.dataFim;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: filters.limit || 500,
    skip: filters.offset || 0,
    include: { usuario: { select: { id: true, name: true, email: true, role: true } } },
  });

  const stats = await prisma.auditLog.groupBy({
    by: ['acao'],
    where: { usuarioId },
    _count: { _all: true },
    orderBy: { _count: { acao: 'desc' } },
    take: 20,
  });

  const porModulo = await prisma.auditLog.groupBy({
    by: ['modulo'],
    where: { usuarioId },
    _count: { _all: true },
    orderBy: { _count: { modulo: 'desc' } },
    take: 10,
  });

  const porHorario = await prisma.$queryRawUnsafe<Array<{ hora: number; total: number }>>(
    `SELECT EXTRACT(HOUR FROM "createdAt")::int AS hora, COUNT(*)::int AS total
     FROM "AuditLog"
     WHERE "usuarioId" = $1
     GROUP BY EXTRACT(HOUR FROM "createdAt")
     ORDER BY total DESC`,
    usuarioId,
  );

  return {
    timeline: logs,
    resumo: {
      totalAcoes: logs.length,
      porAcao: stats.map((s) => ({ acao: s.acao, total: s._count._all })),
      porModulo: porModulo.map((m) => ({ modulo: m.modulo || 'N/A', total: m._count._all })),
      horariosAtividade: porHorario,
    },
  };
}

export async function getAuditExportFilters(filters: SecurityFilters = {}) {
  const where = filtroBase(filters.dataInicio, filters.dataFim, filters.usuarioId);

  const [usuarios, modulos, acoes, entidades] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['usuarioId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { usuarioId: 'desc' } },
      take: 50,
    }),
    prisma.auditLog.groupBy({
      by: ['modulo'],
      where,
      _count: { _all: true },
      orderBy: { _count: { modulo: 'desc' } },
      take: 30,
    }),
    prisma.auditLog.groupBy({
      by: ['acao'],
      where,
      _count: { _all: true },
      orderBy: { _count: { acao: 'desc' } },
      take: 50,
    }),
    prisma.auditLog.groupBy({
      by: ['entidade'],
      where,
      _count: { _all: true },
      orderBy: { _count: { entidade: 'desc' } },
      take: 30,
    }),
  ]);

  const usuarioIds = usuarios.map((u) => u.usuarioId).filter(Boolean) as string[];
  const usuariosDetalhe = usuarioIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, name: true } })
    : [];

  return {
    usuarios: usuarios.map((u) => ({
      id: u.usuarioId,
      nome: usuariosDetalhe.find((d) => d.id === u.usuarioId)?.name || 'Sistema',
      total: u._count._all,
    })),
    modulos: modulos.map((m) => ({ modulo: m.modulo || 'N/A', total: m._count._all })),
    acoes: acoes.map((a) => ({ acao: a.acao, total: a._count._all })),
    entidades: entidades.map((e) => ({ entidade: e.entidade, total: e._count._all })),
  };
}
