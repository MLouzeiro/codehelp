import prisma from '../../config/database';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface StageCreateInput {
  slug: string;
  nome: string;
  descricao?: string | null;
  cor?: string;
  icone?: string;
  ordem?: number;
  etapaInicial?: boolean;
  autoMessage?: string | null;
  enviarAuto?: boolean;
  notificarEquipe?: boolean;
}

export interface StageUpdateInput {
  nome?: string;
  descricao?: string | null;
  cor?: string;
  icone?: string;
  ordem?: number;
  etapaInicial?: boolean;
  autoMessage?: string | null;
  enviarAuto?: boolean;
  ativo?: boolean;
  notificarEquipe?: boolean;
  mensagemFollowup?: string | null;
  mensagemBoasVindas?: string | null;
  mensagemOpcaoInvalida?: string | null;
  mensagemForaHorario?: string | null;
  horarioInicio?: string | null;
  horarioFim?: string | null;
  diasAtendimento?: string | null;
  tempoInatividadeMin?: number | null;
  mensagemAckSuporte?: string | null;
  mensagemAckComercial?: string | null;
  ordenacaoFila?: string;
}

export interface ValidationError extends Error {
  code: string;
  field?: string;
}

function badRequest(msg: string, field?: string): never {
  const err: ValidationError = Object.assign(new Error(msg), { code: 'VALIDATION', field });
  throw err;
}

export async function listStages(options: { includeInativas?: boolean } = {}) {
  return prisma.helpdeskConfig.findMany({
    where: options.includeInativas ? {} : { ativo: true },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
}

export async function getStageById(id: string) {
  return prisma.helpdeskConfig.findUnique({ where: { id } });
}

export async function getStageBySlug(slug: string) {
  return prisma.helpdeskConfig.findUnique({ where: { slug } });
}

export async function etapaInicialSlug() {
  const inicial = await prisma.helpdeskConfig.findFirst({
    where: { etapaInicial: true, ativo: true },
    select: { slug: true },
  });
  if (inicial) return inicial.slug;
  const fila = await prisma.helpdeskConfig.findUnique({
    where: { slug: 'fila' },
    select: { slug: true },
  });
  return fila?.slug || 'fila';
}

export async function createStage(input: StageCreateInput) {
  if (!input.slug || !SLUG_REGEX.test(input.slug)) {
    badRequest('Slug invalido. Use kebab-case (ex: em-analise, aguardando-cliente).', 'slug');
  }
  if (!input.nome || !input.nome.trim()) {
    badRequest('Nome da etapa e obrigatorio.', 'nome');
  }

  const existente = await prisma.helpdeskConfig.findUnique({ where: { slug: input.slug } });
  if (existente) {
    badRequest('Ja existe uma etapa com este slug.', 'slug');
  }

  let ordem = input.ordem;
  if (ordem === undefined) {
    const max = await prisma.helpdeskConfig.aggregate({ _max: { ordem: true } });
    ordem = (max._max.ordem ?? -1) + 1;
  }

  if (input.etapaInicial) {
    await prisma.helpdeskConfig.updateMany({
      where: { etapaInicial: true },
      data: { etapaInicial: false },
    });
  }

  return prisma.helpdeskConfig.create({
    data: {
      slug: input.slug,
      nome: input.nome.trim(),
      descricao: input.descricao ?? null,
      cor: input.cor ?? '#3b82f6',
      icone: input.icone ?? 'inbox',
      ordem,
      etapaInicial: input.etapaInicial ?? false,
      autoMessage: input.autoMessage ?? null,
      enviarAuto: input.enviarAuto ?? false,
      notificarEquipe: input.notificarEquipe ?? false,
    },
  });
}

export async function updateStage(id: string, input: StageUpdateInput) {
  const existe = await prisma.helpdeskConfig.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existe) return null;

  if (input.etapaInicial === true) {
    await prisma.helpdeskConfig.updateMany({
      where: { etapaInicial: true, NOT: { id } },
      data: { etapaInicial: false },
    });
  }

  const data: any = { updatedAt: new Date() };
  const campos: Array<keyof StageUpdateInput> = [
    'nome', 'descricao', 'cor', 'icone', 'ordem', 'etapaInicial',
    'autoMessage', 'enviarAuto', 'ativo', 'notificarEquipe',
    'mensagemFollowup', 'mensagemBoasVindas', 'mensagemOpcaoInvalida',
    'mensagemForaHorario', 'horarioInicio', 'horarioFim', 'diasAtendimento',
    'tempoInatividadeMin', 'mensagemAckSuporte', 'mensagemAckComercial', 'ordenacaoFila',
  ];
  for (const k of campos) {
    if ((input as any)[k] !== undefined) data[k] = (input as any)[k];
  }

  if (data.nome !== undefined && (!data.nome || !String(data.nome).trim())) {
    badRequest('Nome da etapa nao pode ser vazio.', 'nome');
  }

  return prisma.helpdeskConfig.update({ where: { id }, data });
}

export async function reorderStages(stageIds: string[]) {
  if (!Array.isArray(stageIds)) {
    badRequest('stageIds deve ser um array.');
  }
  const updates = stageIds.map((id, index) =>
    prisma.helpdeskConfig.update({ where: { id }, data: { ordem: index, updatedAt: new Date() } })
  );
  return prisma.$transaction(updates);
}

export async function deleteStage(id: string) {
  const stage = await prisma.helpdeskConfig.findUnique({
    where: { id },
    select: { id: true, slug: true, ativo: true, etapaInicial: true },
  });
  if (!stage) return null;
  if (stage.etapaInicial) {
    badRequest('A etapa inicial nao pode ser desativada. Defina outra etapa como inicial primeiro.');
  }
  await prisma.helpdeskConfig.update({ where: { id }, data: { ativo: false, updatedAt: new Date() } });
  return { ativo: false, id };
}

export async function restoreStage(id: string) {
  return prisma.helpdeskConfig.update({ where: { id }, data: { ativo: true, updatedAt: new Date() } });
}
