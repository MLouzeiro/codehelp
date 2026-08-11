import prisma from '../../config/database';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function badRequest(msg: string, field?: string): never {
  const err: any = Object.assign(new Error(msg), { code: 'VALIDATION', field });
  throw err;
}

// ── Departamentos ──────────────────────────────────────────────

export interface DepartamentoInput {
  slug: string;
  nome: string;
  descricao?: string | null;
  cor?: string;
  icone?: string;
  ordem?: number;
}

export async function listDepartamentos(options: { includeInativos?: boolean; userId?: string } = {}) {
  const where: any = options.includeInativos ? {} : { ativo: true };

  if (options.userId) {
    where.usuarios = { some: { userId: options.userId } };
  }

  return prisma.departamento.findMany({
    where,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: { _count: { select: { tickets: true, usuarios: true, filas: true } } },
  });
}

export async function getDepartamentoById(id: string) {
  return prisma.departamento.findUnique({ where: { id }, include: { _count: { select: { tickets: true, usuarios: true } } } });
}

export async function createDepartamento(input: DepartamentoInput) {
  if (!input.slug || !SLUG_REGEX.test(input.slug)) {
    badRequest('Slug inválido. Use kebab-case (ex: suporte-tecnico).', 'slug');
  }
  if (!input.nome || !input.nome.trim()) {
    badRequest('Nome do departamento é obrigatório.', 'nome');
  }

  const existente = await prisma.departamento.findUnique({ where: { slug: input.slug } });
  if (existente) {
    badRequest('Já existe um departamento com este slug.', 'slug');
  }

  let ordem = input.ordem;
  if (ordem === undefined) {
    const max = await prisma.departamento.aggregate({ _max: { ordem: true } });
    ordem = (max._max.ordem ?? -1) + 1;
  }

  return prisma.departamento.create({
    data: {
      slug: input.slug,
      nome: input.nome.trim(),
      descricao: input.descricao ?? null,
      cor: input.cor ?? '#3b82f6',
      icone: input.icone ?? 'building',
      ordem,
    },
  });
}

export async function updateDepartamento(id: string, input: Partial<DepartamentoInput>) {
  const existe = await prisma.departamento.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: any = { updatedAt: new Date() };
  if (input.nome !== undefined) data.nome = input.nome;
  if (input.descricao !== undefined) data.descricao = input.descricao;
  if (input.cor !== undefined) data.cor = input.cor;
  if (input.icone !== undefined) data.icone = input.icone;
  if (input.ordem !== undefined) data.ordem = input.ordem;

  if (data.nome !== undefined && (!data.nome || !String(data.nome).trim())) {
    badRequest('Nome do departamento não pode ser vazio.', 'nome');
  }

  return prisma.departamento.update({ where: { id }, data });
}

export async function toggleDepartamento(id: string) {
  const dept = await prisma.departamento.findUnique({ where: { id }, select: { id: true, ativo: true } });
  if (!dept) return null;
  return prisma.departamento.update({ where: { id }, data: { ativo: !dept.ativo, updatedAt: new Date() } });
}

// ── Níveis de Suporte ──────────────────────────────────────────

export interface NivelInput {
  slug: string;
  nome: string;
  descricao?: string | null;
  cor?: string;
  icone?: string;
  ordem?: number;
  slaMinutos?: number | null;
}

export async function listNiveis(options: { includeInativos?: boolean } = {}) {
  return prisma.nivelSuporte.findMany({
    where: options.includeInativos ? {} : { ativo: true },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: { _count: { select: { tickets: true, filas: true } } },
  });
}

export async function getNivelById(id: string) {
  return prisma.nivelSuporte.findUnique({ where: { id } });
}

export async function createNivel(input: NivelInput) {
  if (!input.slug || !SLUG_REGEX.test(input.slug)) {
    badRequest('Slug inválido. Use kebab-case (ex: n1, n2, n3).', 'slug');
  }
  if (!input.nome || !input.nome.trim()) {
    badRequest('Nome do nível é obrigatório.', 'nome');
  }

  const existente = await prisma.nivelSuporte.findUnique({ where: { slug: input.slug } });
  if (existente) {
    badRequest('Já existe um nível com este slug.', 'slug');
  }

  let ordem = input.ordem;
  if (ordem === undefined) {
    const max = await prisma.nivelSuporte.aggregate({ _max: { ordem: true } });
    ordem = (max._max.ordem ?? -1) + 1;
  }

  return prisma.nivelSuporte.create({
    data: {
      slug: input.slug,
      nome: input.nome.trim(),
      descricao: input.descricao ?? null,
      cor: input.cor ?? '#3b82f6',
      icone: input.icone ?? 'layers',
      ordem,
      slaMinutos: input.slaMinutos ?? null,
    },
  });
}

export async function updateNivel(id: string, input: Partial<NivelInput>) {
  const existe = await prisma.nivelSuporte.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: any = { updatedAt: new Date() };
  if (input.nome !== undefined) data.nome = input.nome;
  if (input.descricao !== undefined) data.descricao = input.descricao;
  if (input.cor !== undefined) data.cor = input.cor;
  if (input.icone !== undefined) data.icone = input.icone;
  if (input.ordem !== undefined) data.ordem = input.ordem;
  if (input.slaMinutos !== undefined) data.slaMinutos = input.slaMinutos;

  if (data.nome !== undefined && (!data.nome || !String(data.nome).trim())) {
    badRequest('Nome do nível não pode ser vazio.', 'nome');
  }

  return prisma.nivelSuporte.update({ where: { id }, data });
}

export async function toggleNivel(id: string) {
  const nivel = await prisma.nivelSuporte.findUnique({ where: { id }, select: { id: true, ativo: true } });
  if (!nivel) return null;
  return prisma.nivelSuporte.update({ where: { id }, data: { ativo: !nivel.ativo, updatedAt: new Date() } });
}
