import prisma from '../../../config/database';

// ── Contatos e grupos excluídos do Helpdesk ──────────────────────────────
// Contatos/grupos nesta lista não iniciam o fluxo automático do Helpdesk:
// não criam ticket, não entram na fila, não recebem saudação/menu e não
// acionam a IA. A mensagem continua chegando no WhatsApp normalmente.
//
// A verificação centralizada (isOrigemIgnorada) é chamada pelo handler
// compartilhado ANTES de qualquer processamento automático.

// ── Cache em memória (positivo apenas) ───────────────────────────────
// Apenas resultados POSITIVOS são cacheados (evita falso negativo). A cada
// mutação o cache é invalidado, então a troca de status é aplicada na próxima
// mensagem sem reiniciar o servidor.
const cacheIgnorados = new Set<string>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

function cacheGet(key: string): boolean | undefined {
  const ts = cacheTimestamps.get(key);
  if (ts === undefined) return undefined;
  if (Date.now() - ts > CACHE_TTL_MS) {
    cacheIgnorados.delete(key);
    cacheTimestamps.delete(key);
    return undefined;
  }
  return cacheIgnorados.has(key);
}

function cacheSet(key: string) {
  cacheIgnorados.add(key);
  cacheTimestamps.set(key, Date.now());
}

/** Invalida o cache (chamado após criar/editar/reativar/alternar). */
export function invalidarCacheContatosIgnorados() {
  cacheIgnorados.clear();
  cacheTimestamps.clear();
}

// ── Utilitários de normalização ──────────────────────────────────────

/** Remove tudo que não é dígito. */
export function normalizarTelefone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Gera variações de chave para casar telefone digitado de formas diferentes
 * (com/sem DDI 55, com/sem DDD, com/sem 9 dígito). A ordem é indiferente —
 * a query usa `in`.
 */
export function gerarChavesTelefone(digits: string): string[] {
  const d = digits.replace(/\D/g, '');
  if (!d) return [];
  const chaves = new Set<string>([d]);
  if (d.startsWith('55') && d.length > 11) chaves.add(d.slice(2));
  if (d.length > 11) chaves.add(d.slice(-11));
  if (d.length > 10) chaves.add(d.slice(-10));
  if (d.length > 9) chaves.add(d.slice(-9));
  return [...chaves];
}

// ── Verificação central (guard do handler) ────────────────────────────

export interface OrigemIgnoradaResult {
  ignorado: boolean;
  registro: { id: string; nome: string; motivo: string | null; tipo: string; regra: string } | null;
}

/**
 * Verifica se a origem da mensagem (telefone ou jid de grupo) está na lista
 * de contatos/grupos ignorados. É a única função chamada pelo handler — NÃO
 * chamar outras funções desta service fora do fluxo administrativo.
 */
export async function isOrigemIgnorada(opts: {
  phoneDigits?: string;
  jid?: string | null;
}): Promise<OrigemIgnoradaResult> {
  const { phoneDigits, jid } = opts;

  // Grupo: jid termina com @g.us
  if (jid && jid.includes('@g.us')) {
    const key = `grupo:${jid}`;
    const cached = cacheGet(key);
    if (cached) return { ignorado: true, registro: null };
    const rec = await prisma.contatoIgnorado.findFirst({
      where: { tipo: 'grupo', chave: jid, ignorado: true },
      select: { id: true, nome: true, motivo: true, tipo: true, regra: true },
    });
    if (rec) cacheSet(key);
    return rec
      ? { ignorado: true, registro: rec }
      : { ignorado: false, registro: null };
  }

  // Contato individual
  const chaves = gerarChavesTelefone(phoneDigits || '');
  if (chaves.length === 0) return { ignorado: false, registro: null };

  for (const k of chaves) {
    if (cacheGet(`contato:${k}`)) {
      return { ignorado: true, registro: null };
    }
  }

  const rec = await prisma.contatoIgnorado.findFirst({
    where: { tipo: 'contato', ignorado: true, chave: { in: chaves } },
    select: { id: true, nome: true, motivo: true, tipo: true, regra: true, chave: true },
  });
  if (rec) cacheSet(`contato:${rec.chave}`);
  return rec
    ? { ignorado: true, registro: rec }
    : { ignorado: false, registro: null };
}

/**
 * Para listagens (ex: tickets do WhatsApp): devolve um Map telefone→ignorado
 * em uma única query, evitando N consultas. Usa as variações de chave para
 * casar telefones salvos em formatos diferentes.
 */
export async function mapearTelefonesIgnorados(phones: string[]): Promise<Map<string, boolean>> {
  const mapa = new Map<string, boolean>();
  const todasChaves = new Set<string>();
  for (const p of phones) {
    const digits = normalizarTelefone(p || '');
    if (!digits) continue;
    for (const k of gerarChavesTelefone(digits)) todasChaves.add(k);
  }
  if (todasChaves.size === 0) return mapa;

  const recs = await prisma.contatoIgnorado.findMany({
    where: { tipo: 'contato', ignorado: true, chave: { in: [...todasChaves] } },
    select: { chave: true },
  });
  const ignoradas = new Set(recs.map((r) => r.chave));

  for (const p of phones) {
    const digits = normalizarTelefone(p || '');
    const chaves = digits ? gerarChavesTelefone(digits) : [];
    mapa.set(p, chaves.some((k) => ignoradas.has(k)));
  }
  return mapa;
}

// ── Histórico / auditoria ────────────────────────────────────────────

interface HistoricoEvento {
  data: string;
  usuario: string;
  acao: string;
  motivo?: string;
}

function parseHistorico(val: string | null): HistoricoEvento[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function nomeUsuario(usuarioId?: string | null): Promise<string> {
  if (!usuarioId) return 'Sistema';
  const u = await prisma.user.findUnique({ where: { id: usuarioId }, select: { name: true } });
  return u?.name || 'Sistema';
}

async function montarHistorico(
  atual: string | null,
  evento: HistoricoEvento,
): Promise<string> {
  return JSON.stringify([...parseHistorico(atual), evento].slice(-50));
}

// ── CRUD administrativo ───────────────────────────────────────────────

export interface ContatoIgnoradoDados {
  tipo: 'contato' | 'grupo';
  chave: string; // telefone (contato) ou jid (grupo)
  nome: string;
  motivo?: string | null;
  regra?: 'ignorar_helpdesk' | 'bloquear';
}

export interface ListarContatosIgnoradosFiltro {
  tipo?: 'contato' | 'grupo' | 'todos';
  status?: 'ignorado' | 'ativo' | 'todos';
  search?: string;
  page?: number;
  limit?: number;
}

export async function listarContatosIgnorados(filtro: ListarContatosIgnoradosFiltro = {}) {
  const where: any = {};
  const tipo = filtro.tipo && filtro.tipo !== 'todos' ? filtro.tipo : null;
  const status = filtro.status && filtro.status !== 'todos' ? filtro.status : null;

  if (tipo) where.tipo = tipo;
  if (status) where.ignorado = status === 'ignorado';
  if (filtro.search) {
    const term = filtro.search.trim();
    where.OR = [
      { nome: { contains: term, mode: 'insensitive' } },
      { chave: { contains: term } },
      { motivo: { contains: term, mode: 'insensitive' } },
    ];
  }

  const page = Math.max(1, filtro.page || 1);
  const limit = Math.min(100, Math.max(1, filtro.limit || 50));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.contatoIgnorado.findMany({
      where,
      orderBy: [{ ignorado: 'desc' }, { criadoEm: 'desc' }],
      skip,
      take: limit,
      include: {
        criadoPor: { select: { id: true, name: true } },
        reativadoPor: { select: { id: true, name: true } },
      },
    }),
    prisma.contatoIgnorado.count({ where }),
  ]);

  return {
    items: items.map((i) => ({
      ...i,
      historico: parseHistorico(i.historico),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function criarContatoIgnorado(
  dados: ContatoIgnoradoDados,
  usuarioId?: string | null,
) {
  const tipo = dados.tipo === 'grupo' ? 'grupo' : 'contato';
  const chave = tipo === 'grupo'
    ? dados.chave.trim()
    : normalizarTelefone(dados.chave);

  if (!chave) throw new Error('Informe o número ou identificador do contato.');
  if (!dados.nome || !dados.nome.trim()) throw new Error('Informe o nome/identificação.');
  if (tipo === 'contato' && chave.length < 8) {
    throw new Error('Número de WhatsApp inválido (mínimo 8 dígitos).');
  }
  if (tipo === 'grupo' && !chave.includes('@')) {
    throw new Error('Identificador de grupo inválido (ex: 1234...@g.us).');
  }

  const usuario = await nomeUsuario(usuarioId);
  const existente = await prisma.contatoIgnorado.findFirst({
    where: { tipo, chave },
  });

  const evento: HistoricoEvento = {
    data: new Date().toISOString(),
    usuario,
    acao: 'adicionado',
    motivo: dados.motivo || undefined,
  };

  if (existente) {
    // Re-ignorar um contato que havia sido reativado, preservando histórico
    if (existente.ignorado) {
      throw new Error('Este contato/grupo já está na lista de ignorados.');
    }
    return prisma.contatoIgnorado.update({
      where: { id: existente.id },
      data: {
        nome: dados.nome.trim(),
        motivo: dados.motivo || null,
        regra: dados.regra || 'ignorar_helpdesk',
        ignorado: true,
        reativadoPorId: null,
        reativadoEm: null,
        criadoPorId: usuarioId || null,
        historico: await montarHistorico(existente.historico, evento),
      },
      include: { criadoPor: { select: { id: true, name: true } }, reativadoPor: { select: { id: true, name: true } } },
    }).then(async (r) => {
      invalidarCacheContatosIgnorados();
      return { ...r, historico: parseHistorico(r.historico) };
    });
  }

  invalidarCacheContatosIgnorados();
  const criado = await prisma.contatoIgnorado.create({
    data: {
      tipo,
      chave,
      nome: dados.nome.trim(),
      motivo: dados.motivo || null,
      regra: dados.regra || 'ignorar_helpdesk',
      ignorado: true,
      criadoPorId: usuarioId || null,
      historico: JSON.stringify([evento]),
    },
    include: { criadoPor: { select: { id: true, name: true } }, reativadoPor: { select: { id: true, name: true } } },
  });
  return { ...criado, historico: parseHistorico(criado.historico) };
}

export async function atualizarContatoIgnorado(
  id: string,
  dados: { nome?: string; motivo?: string | null; regra?: string },
  usuarioId?: string | null,
) {
  const existente = await prisma.contatoIgnorado.findUnique({ where: { id } });
  if (!existente) throw new Error('Registro não encontrado.');

  const usuario = await nomeUsuario(usuarioId);
  const evento: HistoricoEvento = {
    data: new Date().toISOString(),
    usuario,
    acao: 'editado',
    motivo: dados.motivo !== undefined ? dados.motivo || undefined : existente.motivo || undefined,
  };

  invalidarCacheContatosIgnorados();
  const atualizado = await prisma.contatoIgnorado.update({
    where: { id },
    data: {
      nome: dados.nome !== undefined ? dados.nome.trim() : existente.nome,
      motivo: dados.motivo !== undefined ? dados.motivo || null : existente.motivo,
      regra: dados.regra || existente.regra,
      historico: await montarHistorico(existente.historico, evento),
    },
    include: { criadoPor: { select: { id: true, name: true } }, reativadoPor: { select: { id: true, name: true } } },
  });
  return { ...atualizado, historico: parseHistorico(atualizado.historico) };
}

export async function reativarContatoIgnorado(id: string, usuarioId?: string | null) {
  const existente = await prisma.contatoIgnorado.findUnique({ where: { id } });
  if (!existente) throw new Error('Registro não encontrado.');
  if (!existente.ignorado) throw new Error('Este contato/grupo já está ativo.');

  const usuario = await nomeUsuario(usuarioId);
  const evento: HistoricoEvento = {
    data: new Date().toISOString(),
    usuario,
    acao: 'reativado',
    motivo: existente.motivo || undefined,
  };

  invalidarCacheContatosIgnorados();
  const atualizado = await prisma.contatoIgnorado.update({
    where: { id },
    data: {
      ignorado: false,
      reativadoPorId: usuarioId || null,
      reativadoEm: new Date(),
      historico: await montarHistorico(existente.historico, evento),
    },
    include: { criadoPor: { select: { id: true, name: true } }, reativadoPor: { select: { id: true, name: true } } },
  });
  return { ...atualizado, historico: parseHistorico(atualizado.historico) };
}

export async function alternarStatusContatoIgnorado(id: string, usuarioId?: string | null) {
  const existente = await prisma.contatoIgnorado.findUnique({ where: { id } });
  if (!existente) throw new Error('Registro não encontrado.');

  const usuario = await nomeUsuario(usuarioId);
  const novoStatus = !existente.ignorado;
  const evento: HistoricoEvento = {
    data: new Date().toISOString(),
    usuario,
    acao: novoStatus ? 'adicionado' : 'reativado',
    motivo: existente.motivo || undefined,
  };

  invalidarCacheContatosIgnorados();
  const atualizado = await prisma.contatoIgnorado.update({
    where: { id },
    data: {
      ignorado: novoStatus,
      reativadoPorId: novoStatus ? null : usuarioId || null,
      reativadoEm: novoStatus ? null : new Date(),
      criadoPorId: novoStatus ? existente.criadoPorId || usuarioId || null : existente.criadoPorId,
      historico: await montarHistorico(existente.historico, evento),
    },
    include: { criadoPor: { select: { id: true, name: true } }, reativadoPor: { select: { id: true, name: true } } },
  });
  return { ...atualizado, historico: parseHistorico(atualizado.historico) };
}

export async function excluirContatoIgnorado(id: string) {
  const existente = await prisma.contatoIgnorado.findUnique({ where: { id } });
  if (!existente) throw new Error('Registro não encontrado.');
  invalidarCacheContatosIgnorados();
  await prisma.contatoIgnorado.delete({ where: { id } });
  return { ok: true };
}

// ── Resumo / indicadores ──────────────────────────────────────────────

export async function getResumoContatosIgnorados() {
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [contatosIgnorados, gruposIgnorados, ativos, ignoradosMes, reativadosMes, motivos] = await Promise.all([
    prisma.contatoIgnorado.count({ where: { tipo: 'contato', ignorado: true } }),
    prisma.contatoIgnorado.count({ where: { tipo: 'grupo', ignorado: true } }),
    prisma.contatoIgnorado.count({ where: { ignorado: false } }),
    prisma.contatoIgnorado.count({ where: { ignorado: true, criadoEm: { gte: inicioMes } } }),
    prisma.contatoIgnorado.count({ where: { reativadoEm: { gte: inicioMes } } }),
    prisma.contatoIgnorado.groupBy({
      by: ['motivo'],
      where: { motivo: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { motivo: 'desc' } },
      take: 6,
    }),
  ]);

  return {
    contatosIgnorados,
    gruposIgnorados,
    ativos,
    ignoradosMes,
    reativadosMes,
    principaisMotivos: motivos.map((m) => ({
      motivo: m.motivo || 'Sem motivo',
      quantidade: m._count._all,
    })),
  };
}
