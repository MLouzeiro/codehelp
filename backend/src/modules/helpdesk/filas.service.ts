import prisma from '../../config/database';

export interface FilaInput {
  nome: string;
  slug?: string;
  departamentoId: string;
  nivelSuporteId: string;
  descricao?: string;
  ordem?: number;
}

function badRequest(message: string, field?: string) {
  const err: any = new Error(message);
  err.code = 'VALIDATION';
  err.field = field;
  return err;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listFilas(departamentoId?: string) {
  const where: any = {};
  if (departamentoId) where.departamentoId = departamentoId;

  return prisma.fila.findMany({
    where,
    include: {
      departamento: { select: { id: true, slug: true, nome: true, cor: true } },
      nivelSuporte: { select: { id: true, slug: true, nome: true, cor: true, slaMinutos: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: [{ departamento: { ordem: 'asc' } }, { ordem: 'asc' }, { nome: 'asc' }],
  });
}

export async function getFilaById(id: string) {
  return prisma.fila.findUnique({
    where: { id },
    include: {
      departamento: { select: { id: true, slug: true, nome: true, cor: true } },
      nivelSuporte: { select: { id: true, slug: true, nome: true, cor: true, slaMinutos: true } },
      _count: { select: { tickets: true } },
    },
  });
}

export async function createFila(input: FilaInput) {
  if (!input.nome?.trim()) throw badRequest('Nome é obrigatório', 'nome');
  if (!input.departamentoId) throw badRequest('Departamento é obrigatório', 'departamentoId');
  if (!input.nivelSuporteId) throw badRequest('Nível de suporte é obrigatório', 'nivelSuporteId');

  const dept = await prisma.departamento.findUnique({ where: { id: input.departamentoId } });
  if (!dept) throw badRequest('Departamento não encontrado', 'departamentoId');

  const nivel = await prisma.nivelSuporte.findUnique({ where: { id: input.nivelSuporteId } });
  if (!nivel) throw badRequest('Nível de suporte não encontrado', 'nivelSuporteId');

  const slug = input.slug?.trim() || toKebabCase(input.nome);

  const existingSlug = await prisma.fila.findUnique({ where: { slug } });
  if (existingSlug) throw badRequest('Já existe uma fila com este slug', 'slug');

  const existing = await prisma.fila.findFirst({
    where: { nome: input.nome.trim(), departamentoId: input.departamentoId },
  });
  if (existing) throw badRequest('Já existe uma fila com este nome neste departamento', 'nome');

  const maxOrdem = await prisma.fila.aggregate({
    where: { departamentoId: input.departamentoId },
    _max: { ordem: true },
  });

  return prisma.fila.create({
    data: {
      nome: input.nome.trim(),
      slug,
      departamentoId: input.departamentoId,
      nivelSuporteId: input.nivelSuporteId,
      descricao: input.descricao?.trim() || null,
      ordem: input.ordem ?? (maxOrdem._max.ordem ?? 0) + 1,
    },
    include: {
      departamento: { select: { id: true, slug: true, nome: true, cor: true } },
      nivelSuporte: { select: { id: true, slug: true, nome: true, cor: true, slaMinutos: true } },
    },
  });
}

export async function updateFila(id: string, input: Partial<FilaInput>) {
  const fila = await prisma.fila.findUnique({ where: { id } });
  if (!fila) return null;

  const data: any = {};
  if (input.nome !== undefined) {
    if (!input.nome?.trim()) throw badRequest('Nome é obrigatório', 'nome');
    data.nome = input.nome.trim();
  }
  if (input.departamentoId !== undefined) data.departamentoId = input.departamentoId;
  if (input.nivelSuporteId !== undefined) data.nivelSuporteId = input.nivelSuporteId;
  if (input.descricao !== undefined) data.descricao = input.descricao?.trim() || null;
  if (input.ordem !== undefined) data.ordem = input.ordem;

  return prisma.fila.update({
    where: { id },
    data,
    include: {
      departamento: { select: { id: true, slug: true, nome: true, cor: true } },
      nivelSuporte: { select: { id: true, slug: true, nome: true, cor: true, slaMinutos: true } },
    },
  });
}

export async function toggleFila(id: string) {
  const fila = await prisma.fila.findUnique({ where: { id } });
  if (!fila) return null;

  return prisma.fila.update({
    where: { id },
    data: { ativo: !fila.ativo },
    include: {
      departamento: { select: { id: true, slug: true, nome: true, cor: true } },
      nivelSuporte: { select: { id: true, slug: true, nome: true, cor: true, slaMinutos: true } },
    },
  });
}
