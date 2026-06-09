import prisma from '../../config/database';

export interface KbCreateInput {
  slug?: string;
  titulo: string;
  conteudo: string;
  resumo?: string | null;
  categoriaId?: string | null;
  tags?: string;
  autorId?: string | null;
  publicado?: boolean;
  ordem?: number;
}

export interface KbUpdateInput {
  titulo?: string;
  conteudo?: string;
  resumo?: string | null;
  categoriaId?: string | null;
  tags?: string;
  publicado?: boolean;
  ordem?: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function slugUnico(base: string, ignoreId?: string): Promise<string> {
  let slug = slugify(base) || `kb-${Date.now()}`;
  let tentativas = 0;
  while (tentativas < 100) {
    const existente = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!existente || existente.id === ignoreId) return slug;
    tentativas++;
    slug = `${slugify(base)}-${tentativas}`;
  }
  return `${slugify(base)}-${Date.now()}`;
}

export async function criarKb(input: KbCreateInput) {
  const slugFinal = input.slug ? await slugUnico(input.slug) : await slugUnico(input.titulo);
  return prisma.kBArticle.create({
    data: {
      slug: slugFinal,
      titulo: input.titulo,
      conteudo: input.conteudo,
      resumo: input.resumo ?? null,
      categoriaId: input.categoriaId ?? null,
      tags: input.tags ?? '',
      autorId: input.autorId ?? null,
      publicado: input.publicado ?? false,
      ordem: input.ordem ?? 0,
    },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function atualizarKb(id: string, input: KbUpdateInput) {
  const data: any = {};
  if (input.titulo !== undefined) data.titulo = input.titulo;
  if (input.conteudo !== undefined) data.conteudo = input.conteudo;
  if (input.resumo !== undefined) data.resumo = input.resumo;
  if (input.categoriaId !== undefined) data.categoriaId = input.categoriaId;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.publicado !== undefined) data.publicado = input.publicado;
  if (input.ordem !== undefined) data.ordem = input.ordem;
  return prisma.kBArticle.update({
    where: { id },
    data,
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function deletarKb(id: string) {
  return prisma.kBArticle.update({ where: { id }, data: { ativo: false } });
}

export async function publicarKb(id: string, publicado: boolean) {
  return prisma.kBArticle.update({
    where: { id },
    data: { publicado },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function marcarUtil(id: string, util: boolean) {
  return prisma.kBArticle.update({
    where: { id },
    data: util ? { util: { increment: 1 } } : { inutil: { increment: 1 } },
  });
}

export async function registrarVisualizacao(id: string) {
  return prisma.kBArticle.update({
    where: { id },
    data: { visualizacoes: { increment: 1 } },
  });
}

export interface KbListFilters {
  categoriaId?: string;
  publicado?: boolean;
  tag?: string;
  busca?: string;
  limit?: number;
  offset?: number;
}

export async function listarKb(filters: KbListFilters = {}) {
  const where: any = { ativo: true };
  if (filters.categoriaId) where.categoriaId = filters.categoriaId;
  if (filters.publicado !== undefined) where.publicado = filters.publicado;
  if (filters.tag) where.tags = { contains: filters.tag };
  if (filters.busca) {
    where.OR = [
      { titulo: { contains: filters.busca } },
      { conteudo: { contains: filters.busca } },
      { resumo: { contains: filters.busca } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.kBArticle.findMany({
      where,
      include: { categoria: true, autor: { select: { id: true, name: true } } },
      orderBy: [{ publicado: 'desc' }, { ordem: 'asc' }, { createdAt: 'desc' }],
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.kBArticle.count({ where }),
  ]);
  return { items, total };
}

export async function getKb(id: string) {
  return prisma.kBArticle.findUnique({
    where: { id },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function getKbPorSlug(slug: string) {
  return prisma.kBArticle.findUnique({
    where: { slug },
    include: { categoria: true, autor: { select: { id: true, name: true } } },
  });
}

export async function sugerirKbParaTicket(ticketId: string, limite: number = 5) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { categoriaRef: true, messages: { orderBy: { createdAt: 'desc' }, take: 3 } },
  });
  if (!ticket) return [];
  const termos: string[] = [];
  if (ticket.assunto) termos.push(ticket.assunto);
  if (ticket.categoriaRef) termos.push(ticket.categoriaRef.nome);
  for (const msg of ticket.messages) {
    if (msg.content) termos.push(msg.content);
  }
  const textoBusca = termos.join(' ').slice(0, 200);
  if (textoBusca.trim().length < 3) return [];
  const where: any = { publicado: true, ativo: true };
  where.OR = [
    { titulo: { contains: textoBusca.split(' ').slice(0, 5).join(' ') } },
    { tags: { contains: textoBusca.split(' ')[0] } },
  ];
  if (ticket.categoriaId) {
    where.OR.push({ categoriaId: ticket.categoriaId });
  }
  return prisma.kBArticle.findMany({
    where,
    include: { categoria: true },
    orderBy: { visualizacoes: 'desc' },
    take: limite,
  });
}
