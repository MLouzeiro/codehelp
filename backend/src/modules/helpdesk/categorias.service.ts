import prisma from '../../config/database';
import { logAction } from '../audit/audit.service';
import { hasClaude, callClaude } from '../../shared/aiClient';

const CONFIG_SLUG = 'exigir_classificacao';

export interface CategoriaInput {
  nome: string;
  descricao?: string;
  cor?: string;
  icone?: string;
  ordem?: number;
  ativo?: boolean;
  departamentoId?: string | null;
}

export interface AssuntoInput {
  nome: string;
  descricao?: string;
  categoriaId: string;
  icone?: string;
  cor?: string;
  prioridadePadrao?: string;
  slaPadraoMin?: number | null;
  departamentoId?: string | null;
  idFila?: string | null;
  ordem?: number;
  ativo?: boolean;
}

export interface SugestaoClassificacao {
  categoriaId?: string;
  categoria?: string;
  assuntoId?: string;
  assunto?: string;
  confianca: number;
  metodo: 'regex' | 'llm' | 'hibrido' | 'nenhum';
  motivo?: string;
}

export function slugify(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'outros'
  );
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// ── Categorias ────────────────────────────────────────────────────────

export async function listarCategorias(opts?: { incluirInativos?: boolean }) {
  return prisma.categoria.findMany({
    where: opts?.incluirInativos ? {} : { ativo: true },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: {
      departamento: { select: { id: true, nome: true, slug: true } },
      _count: { select: { tickets: true, assuntos: true } },
    },
  });
}

export async function listarAssuntos(opts?: { categoriaId?: string; incluirInativos?: boolean }) {
  return prisma.assunto.findMany({
    where: {
      ...(opts?.categoriaId ? { categoriaId: opts.categoriaId } : {}),
      ...(opts?.incluirInativos ? {} : { ativo: true }),
    },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: {
      categoria: { select: { id: true, nome: true, slug: true } },
      departamento: { select: { id: true, nome: true } },
      fila: { select: { id: true, nome: true } },
      _count: { select: { tickets: true } },
    },
  });
}

export async function criarCategoria(data: CategoriaInput) {
  const slug = slugify(data.nome);
  const existente = await prisma.categoria.findUnique({ where: { slug } });
  if (existente) throw new Error('Ja existe categoria com esse nome');
  return prisma.categoria.create({
    data: {
      slug,
      nome: data.nome,
      descricao: data.descricao || null,
      cor: data.cor || '#3b82f6',
      icone: data.icone || 'tag',
      ordem: data.ordem ?? 0,
      ativo: data.ativo ?? true,
      departamentoId: data.departamentoId || null,
    },
  });
}

export async function atualizarCategoria(id: string, data: Partial<CategoriaInput>) {
  const atual = await prisma.categoria.findUnique({ where: { id } });
  if (!atual) throw new Error('Categoria nao encontrada');
  const update: any = {};
  if (data.nome !== undefined) {
    update.nome = data.nome;
    update.slug = slugify(data.nome);
  }
  if (data.descricao !== undefined) update.descricao = data.descricao;
  if (data.cor !== undefined) update.cor = data.cor;
  if (data.icone !== undefined) update.icone = data.icone;
  if (data.ordem !== undefined) update.ordem = data.ordem;
  if (data.ativo !== undefined) update.ativo = data.ativo;
  if (data.departamentoId !== undefined) update.departamentoId = data.departamentoId;
  return prisma.categoria.update({ where: { id }, data: update });
}

export async function inativarCategoria(id: string, ativo: boolean) {
  const atual = await prisma.categoria.findUnique({ where: { id } });
  if (!atual) throw new Error('Categoria nao encontrada');
  return prisma.categoria.update({ where: { id }, data: { ativo } });
}

export async function excluirCategoria(id: string) {
  const atual = await prisma.categoria.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true, assuntos: true, articles: true } } },
  });
  if (!atual) throw new Error('Categoria nao encontrada');
  if (atual._count.tickets > 0 || atual._count.assuntos > 0 || atual._count.articles > 0) {
    throw new Error('Categoria possui historico — inative em vez de excluir');
  }
  return prisma.categoria.delete({ where: { id } });
}

// ── Assuntos ──────────────────────────────────────────────────────────

export async function criarAssunto(data: AssuntoInput) {
  const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
  if (!categoria) throw new Error('Categoria nao encontrada');
  const slug = slugify(`${categoria.slug}__${data.nome}`);
  const existente = await prisma.assunto.findUnique({ where: { slug } });
  if (existente) throw new Error('Ja existe assunto com esse nome nessa categoria');
  return prisma.assunto.create({
    data: {
      slug,
      nome: data.nome,
      descricao: data.descricao || null,
      categoriaId: data.categoriaId,
      icone: data.icone || 'tag',
      cor: data.cor || '#3b82f6',
      prioridadePadrao: data.prioridadePadrao || 'media',
      slaPadraoMin: data.slaPadraoMin ?? null,
      departamentoId: data.departamentoId || null,
      idFila: data.idFila || null,
      ordem: data.ordem ?? 0,
      ativo: data.ativo ?? true,
    },
  });
}

export async function atualizarAssunto(id: string, data: Partial<AssuntoInput>) {
  const atual = await prisma.assunto.findUnique({ where: { id } });
  if (!atual) throw new Error('Assunto nao encontrado');
  const update: any = {};
  if (data.nome !== undefined) {
    update.nome = data.nome;
    const categoria = atual.categoriaId;
    update.slug = slugify(`${categoria}__${data.nome}`);
  }
  if (data.descricao !== undefined) update.descricao = data.descricao;
  if (data.categoriaId !== undefined) {
    const cat = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
    if (!cat) throw new Error('Categoria nao encontrada');
    update.categoriaId = data.categoriaId;
    update.slug = slugify(`${data.categoriaId}__${data.nome || atual.nome}`);
  }
  if (data.icone !== undefined) update.icone = data.icone;
  if (data.cor !== undefined) update.cor = data.cor;
  if (data.prioridadePadrao !== undefined) update.prioridadePadrao = data.prioridadePadrao;
  if (data.slaPadraoMin !== undefined) update.slaPadraoMin = data.slaPadraoMin;
  if (data.departamentoId !== undefined) update.departamentoId = data.departamentoId;
  if (data.idFila !== undefined) update.idFila = data.idFila;
  if (data.ordem !== undefined) update.ordem = data.ordem;
  if (data.ativo !== undefined) update.ativo = data.ativo;
  return prisma.assunto.update({ where: { id }, data: update });
}

export async function inativarAssunto(id: string, ativo: boolean) {
  const atual = await prisma.assunto.findUnique({ where: { id } });
  if (!atual) throw new Error('Assunto nao encontrado');
  return prisma.assunto.update({ where: { id }, data: { ativo } });
}

// ── Configuracao: exigir classificacao ────────────────────────────────

export async function getExigirClassificacao(): Promise<boolean> {
  const cfg = await prisma.helpdeskConfig.findUnique({ where: { slug: CONFIG_SLUG } });
  if (!cfg || !cfg.descricao) return false;
  try {
    return JSON.parse(cfg.descricao).ativo === true;
  } catch {
    return false;
  }
}

export async function setExigirClassificacao(ativo: boolean) {
  const json = JSON.stringify({ ativo });
  const existing = await prisma.helpdeskConfig.findUnique({ where: { slug: CONFIG_SLUG } });
  if (existing) {
    return prisma.helpdeskConfig.update({
      where: { id: existing.id },
      data: { descricao: json, nome: 'Exigir classificacao do chamado' },
    });
  }
  return prisma.helpdeskConfig.create({
    data: {
      slug: CONFIG_SLUG,
      nome: 'Exigir classificacao do chamado',
      descricao: json,
      icone: 'tags',
      ordem: 999,
    },
  });
}

// ── Classificacao de ticket ───────────────────────────────────────────

export async function validarClassificacaoObrigatoria(ticket: {
  categoriaId?: string | null;
  assuntoId?: string | null;
}) {
  const exigir = await getExigirClassificacao();
  if (!exigir) return;
  if (!ticket.categoriaId || !ticket.assuntoId) {
    throw new Error('CLASSIFICACAO_OBRIGATORIA: Classifique o chamado (categoria e assunto) antes de encerrar');
  }
}

export async function aplicarClassificacao(params: {
  ticketId: string;
  categoriaId?: string | null;
  assuntoId?: string | null;
  usuarioId?: string | null;
  motivo?: string;
  origem?: string;
  ip?: string | null;
}) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    include: { categoriaRef: true, assuntoRef: true },
  });
  if (!ticket) throw new Error('Ticket nao encontrado');

  let categoria = ticket.categoriaRef;
  let assunto = null as any;
  if (params.categoriaId) {
    categoria = await prisma.categoria.findUnique({
      where: { id: params.categoriaId },
      include: { departamento: { select: { id: true, nome: true } } },
    });
    if (!categoria) throw new Error('Categoria nao encontrada');
    if (!categoria.ativo) throw new Error('Categoria inativa');
  }
  if (params.assuntoId) {
    assunto = await prisma.assunto.findUnique({
      where: { id: params.assuntoId },
      include: { categoria: { select: { id: true, nome: true } } },
    });
    if (!assunto) throw new Error('Assunto nao encontrado');
    if (!assunto.ativo) throw new Error('Assunto inativo');
    if (params.categoriaId && assunto.categoriaId !== params.categoriaId) {
      throw new Error('Assunto nao pertence a categoria informada');
    }
    if (!params.categoriaId && !categoria) {
      categoria = assunto.categoria;
    }
  }

  const novaCategoriaId =
    params.categoriaId !== undefined ? (params.categoriaId || null) : categoria ? categoria.id : ticket.categoriaId;
  const novoAssuntoId = params.assuntoId !== undefined ? (params.assuntoId || null) : ticket.assuntoId;

  const data: any = {};
  if (novaCategoriaId !== ticket.categoriaId) {
    data.categoriaId = novaCategoriaId;
    data.categoria = categoria?.nome || null;
  }
  if (novoAssuntoId !== ticket.assuntoId) {
    data.assuntoId = novoAssuntoId;
    data.assunto = assunto?.nome || null;
  }
  if (Object.keys(data).length === 0) {
    return { ticket: await prisma.ticket.findUnique({ where: { id: params.ticketId } }), semAlteracao: true };
  }

  // Aplicar defaults do assunto (departamento/fila/prioridade/SLA) apenas se informado o assunto novo
  if (novoAssuntoId && novoAssuntoId !== ticket.assuntoId && assunto) {
    if (assunto.departamentoId) data.departamentoId = assunto.departamentoId;
    if (assunto.idFila) data.idFila = assunto.idFila;
    if (assunto.prioridadePadrao) data.prioridade = assunto.prioridadePadrao;
    if (assunto.slaPadraoMin) data.slaTotalMinutos = assunto.slaPadraoMin;
  }

  const ticketAtualizado = await prisma.ticket.update({ where: { id: params.ticketId }, data });

  await prisma.ticketEvent.create({
    data: {
      ticketId: params.ticketId,
      tipo: 'classificacao_alterada',
      descricao: [
        ticket.categoria !== ticketAtualizado.categoria ? `Categoria: ${ticket.categoria || 'sem'} -> ${ticketAtualizado.categoria || 'sem'}` : null,
        ticket.assunto !== ticketAtualizado.assunto ? `Assunto: ${ticket.assunto || 'sem'} -> ${ticketAtualizado.assunto || 'sem'}` : null,
        params.motivo ? `Motivo: ${params.motivo}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
      dados: JSON.stringify({
        categoriaAnterior: ticket.categoria,
        categoriaNova: ticketAtualizado.categoria,
        assuntoAnterior: ticket.assunto,
        assuntoNova: ticketAtualizado.assunto,
      }),
      usuarioId: params.usuarioId,
      isSystem: params.origem === 'sistema',
      isAi: params.origem === 'ia',
    },
  });

  await logAction({
    usuarioId: params.usuarioId,
    entidade: 'Ticket',
    entidadeId: params.ticketId,
    acao: 'classificar_ticket',
    detalhes: {
      categoriaAnterior: ticket.categoria,
      categoriaNova: ticketAtualizado.categoria,
      assuntoAnterior: ticket.assunto,
      assuntoNova: ticketAtualizado.assunto,
      motivo: params.motivo || null,
      origem: params.origem || 'manual',
    },
    ip: params.ip || null,
  });

  return { ticket: ticketAtualizado, semAlteracao: false };
}

// ── Sugestao IA de classificacao ──────────────────────────────────────

async function buscarMensagensTicket(ticketId: string, limite = 8) {
  return prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    take: limite,
    select: { content: true, fromMe: true },
  });
}

export async function sugerirClassificacao(ticketId: string): Promise<SugestaoClassificacao> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, assunto: true, observacoes: true, categoria: true },
  });
  if (!ticket) throw new Error('Ticket nao encontrado');

  const [categorias, assuntos] = await Promise.all([
    prisma.categoria.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' } }),
    prisma.assunto.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' } }),
  ]);
  if (categorias.length === 0) {
    return { confianca: 0, metodo: 'nenhum', motivo: 'Nenhuma categoria cadastrada' };
  }

  const mensagens = await buscarMensagensTicket(ticketId);
  const texto = normalizarTexto(
    [ticket.assunto, ticket.observacoes, ...mensagens.map((m) => m.content || '')].filter(Boolean).join(' ')
  ).slice(0, 3000);

  const categoriaMatch = casarPorPalavras(texto, categorias.map((c) => ({ id: c.id, nome: c.nome })));
  const assuntosDaCategoria = categoriaMatch
    ? assuntos.filter((a) => a.categoriaId === categoriaMatch.id)
    : assuntos;
  const assuntoMatch = casarPorPalavras(texto, assuntosDaCategoria.map((a) => ({ id: a.id, nome: a.nome })));

  const confiancaBase = categoriaMatch ? (assuntoMatch ? 80 : 60) : assuntoMatch ? 50 : 20;
  const sugestaoLocal: SugestaoClassificacao = {
    categoriaId: categoriaMatch?.id,
    categoria: categoriaMatch?.nome,
    assuntoId: assuntoMatch?.id,
    assunto: assuntoMatch?.nome,
    confianca: confiancaBase,
    metodo: 'regex',
    motivo: categoriaMatch
      ? `Palavras do problema casaram com "${categoriaMatch.nome}"`
      : 'Nenhuma categoria clara no texto',
  };

  if (!hasClaude()) return sugestaoLocal;

  try {
    const listaCategorias = categorias.map((c) => `${c.slug}: ${c.nome}`).join(' | ');
    const listaAssuntos = assuntos
      .slice(0, 40)
      .map((a) => `${a.slug}: ${a.nome} (categoria ${a.categoriaId})`)
      .join(' | ');
    const prompt = `Classifique este chamado de suporte.
MENSAGENS/ASSUNTO:
${texto.slice(0, 1500)}

CATEGORIAS disponiveis:
${listaCategorias}

ASSUNTOS disponiveis (slug: nome (categoriaId)):
${listaAssuntos}

Responda APENAS com JSON (sem markdown):
{
  "categoriaSlug": "slug da melhor categoria ou vazio",
  "assuntoSlug": "slug do melhor assunto ou vazio",
  "confianca": 0-100,
  "motivo": "breve justificativa"
}`;
    const resposta = await callClaude(prompt, 300);
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const cat = categorias.find((c) => c.slug === parsed.categoriaSlug);
      const asst = assuntos.find(
        (a) => a.slug === parsed.assuntoSlug && (!cat || a.categoriaId === cat.id)
      );
      if (cat || asst) {
        return {
          categoriaId: cat?.id,
          categoria: cat?.nome,
          assuntoId: asst?.id,
          assunto: asst?.nome,
          confianca: Math.min(100, Math.max(0, parsed.confianca || 70)),
          metodo: 'hibrido',
          motivo: parsed.motivo || sugestaoLocal.motivo,
        };
      }
    }
  } catch (e) {
    console.warn('[Categorias] Falha LLM na sugestao, usando regex:', (e as Error).message);
  }

  return sugestaoLocal;
}

function casarPorPalavras(
  texto: string,
  opcoes: Array<{ id: string; nome: string }>
): { id: string; nome: string } | null {
  let melhor: { id: string; nome: string } | null = null;
  let melhorScore = 0;
  for (const opcao of opcoes) {
    const palavras = normalizarTexto(opcao.nome)
      .split(/\s+/)
      .filter((p) => p.length >= 3);
    if (palavras.length === 0) continue;
    const score = palavras.filter((p) => texto.includes(p)).length / palavras.length;
    if (score > melhorScore) {
      melhorScore = score;
      melhor = opcao;
    }
  }
  if (melhorScore >= 0.5) return melhor;
  return null;
}