import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────────────

export interface LayoutConfig {
  cores?: {
    primaria?: string;
    primariaClara?: string;
    texto?: string;
    textoClaro?: string;
    borda?: string;
  };
  cabecalho?: {
    mostrarLogo?: boolean;
    logoLargura?: number;
    logoAltura?: number;
    logoPosicao?: 'esquerda' | 'centro' | 'direita';
    mostrarEmpresa?: boolean;
    mostrarCnpj?: boolean;
    mostrarTelefone?: boolean;
    mostrarEmail?: boolean;
    mostrarWebsite?: boolean;
    mostrarEndereco?: boolean;
    tituloOs?: string;
  };
  rodape?: {
    mostrarEmpresa?: boolean;
    mostrarContato?: boolean;
    textoPersonalizado?: string;
    mostrarPagina?: boolean;
    mostrarDisclaimer?: boolean;
  };
  secoes?: {
    cliente?: { visivel?: boolean; campos?: string[] };
    servico?: { visivel?: boolean };
    itens?: { visivel?: boolean };
    tecnicoValor?: { visivel?: boolean };
    observacoes?: { visivel?: boolean };
    assinatura?: { visivel?: boolean; posicao?: string; tamanho?: number };
  };
  margens?: { topo?: number; baixo?: number; esquerda?: number; direita?: number };
  espacamento?: { entreSecoes?: number; tituloSecao?: number };
  logo?: { base64?: string; mimeType?: string; nome?: string };
}

export interface CreateLayoutInput {
  nome: string;
  descricao?: string;
  tipo?: string;
  configuracao?: LayoutConfig;
  padrao?: boolean;
  margemTopo?: number;
  margemBaixo?: number;
  margemEsquerda?: number;
  margemDireita?: number;
  timbradoApply?: string;
}

export interface UpdateLayoutInput extends Partial<CreateLayoutInput> {
  ativo?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

function safeJsonParse(str: string): any {
  try { return JSON.parse(str); } catch { return {}; }
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listLayouts(organizationId?: string) {
  const where: any = { ativo: true };
  if (organizationId) where.organizationId = organizationId;

  const layouts = await prisma.oSLayout.findMany({
    where,
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
    select: {
      id: true, organizationId: true, nome: true, descricao: true, tipo: true,
      ativo: true, padrao: true, configuracao: true,
      timbradoPath: true, timbradoApply: true,
      margemTopo: true, margemBaixo: true, margemEsquerda: true, margemDireita: true,
      createdAt: true, updatedAt: true,
      timbradoBlob: true,
      _count: { select: { orders: true } },
    },
  });

  // Excluir timbradoBlob do response mas adicionar flag hasTimbrado
  return layouts.map(({ timbradoBlob, ...rest }) => ({
    ...rest,
    hasTimbrado: !!(timbradoBlob && timbradoBlob.length > 0) || !!rest.timbradoPath,
  }));
}

export async function getLayout(id: string) {
  const layout = await prisma.oSLayout.findUnique({
    where: { id },
    select: {
      id: true, organizationId: true, nome: true, descricao: true, tipo: true,
      ativo: true, padrao: true, configuracao: true,
      timbradoPath: true, timbradoApply: true,
      margemTopo: true, margemBaixo: true, margemEsquerda: true, margemDireita: true,
      createdAt: true, updatedAt: true,
      timbradoBlob: true,
      _count: { select: { orders: true } },
    },
  });
  if (!layout) throw new Error('Layout não encontrado');
  const { timbradoBlob, ...rest } = layout;
  return {
    ...rest,
    hasTimbrado: !!(timbradoBlob && timbradoBlob.length > 0) || !!rest.timbradoPath,
  };
}

export async function createLayout(data: CreateLayoutInput, organizationId?: string) {
  if (data.padrao) {
    await prisma.oSLayout.updateMany({
      where: { organizationId: organizationId || null, padrao: true },
      data: { padrao: false },
    });
  }

  return prisma.oSLayout.create({
    data: {
      nome: data.nome,
      descricao: data.descricao || null,
      tipo: data.tipo || 'personalizado',
      configuracao: JSON.stringify(data.configuracao || {}),
      padrao: data.padrao || false,
      organizationId: organizationId || null,
      margemTopo: data.margemTopo ?? 0,
      margemBaixo: data.margemBaixo ?? 0,
      margemEsquerda: data.margemEsquerda ?? 0,
      margemDireita: data.margemDireita ?? 0,
      timbradoApply: data.timbradoApply || 'primeira_pagina',
    },
  });
}

export async function updateLayout(id: string, data: UpdateLayoutInput) {
  const existing = await prisma.oSLayout.findUnique({ where: { id } });
  if (!existing) throw new Error('Layout não encontrado');

  if (data.padrao) {
    await prisma.oSLayout.updateMany({
      where: { organizationId: existing.organizationId, padrao: true, id: { not: id } },
      data: { padrao: false },
    });
  }

  const updateData: any = {};
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.configuracao !== undefined) updateData.configuracao = JSON.stringify(data.configuracao);
  if (data.padrao !== undefined) updateData.padrao = data.padrao;
  if (data.ativo !== undefined) updateData.ativo = data.ativo;
  if (data.margemTopo !== undefined) updateData.margemTopo = data.margemTopo;
  if (data.margemBaixo !== undefined) updateData.margemBaixo = data.margemBaixo;
  if (data.margemEsquerda !== undefined) updateData.margemEsquerda = data.margemEsquerda;
  if (data.margemDireita !== undefined) updateData.margemDireita = data.margemDireita;
  if (data.timbradoApply !== undefined) updateData.timbradoApply = data.timbradoApply;

  return prisma.oSLayout.update({ where: { id }, data: updateData });
}

export async function deleteLayout(id: string) {
  const existing = await prisma.oSLayout.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) throw new Error('Layout não encontrado');
  if (existing._count.orders > 0) {
    throw new Error('Este layout está sendo utilizado por Ordens de Serviço e não pode ser excluído. Desative-o ao invés de excluir.');
  }

  return prisma.oSLayout.delete({ where: { id } });
}

export async function setDefaultLayout(id: string, organizationId?: string) {
  const existing = await prisma.oSLayout.findUnique({ where: { id } });
  if (!existing) throw new Error('Layout não encontrado');

  await prisma.oSLayout.updateMany({
    where: { organizationId: existing.organizationId, padrao: true },
    data: { padrao: false },
  });

  return prisma.oSLayout.update({
    where: { id },
    data: { padrao: true },
  });
}

export async function duplicateLayout(id: string) {
  const original = await prisma.oSLayout.findUnique({ where: { id } });
  if (!original) throw new Error('Layout não encontrado');

  return prisma.oSLayout.create({
    data: {
      nome: `${original.nome} - Cópia`,
      descricao: original.descricao,
      tipo: original.tipo,
      configuracao: original.configuracao,
      padrao: false,
      organizationId: original.organizationId,
      margemTopo: original.margemTopo,
      margemBaixo: original.margemBaixo,
      margemEsquerda: original.margemEsquerda,
      margemDireita: original.margemDireita,
      timbradoApply: original.timbradoApply,
    },
  });
}

// ── Upload de Timbrado ────────────────────────────────────────────────

export async function uploadTimbrado(id: string, file: Express.Multer.File) {
  const existing = await prisma.oSLayout.findUnique({ where: { id } });
  if (!existing) throw new Error('Layout não encontrado');

  if (file.mimetype !== 'application/pdf') {
    throw new Error('Arquivo inválido. Selecione um PDF.');
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('O arquivo excede o tamanho permitido (10MB).');
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('Arquivo não recebido. Tente novamente.');
  }

  // Validar que é um PDF válido (magic bytes: %PDF)
  const header = file.buffer.slice(0, 5).toString('ascii');
  if (!header.startsWith('%PDF')) {
    throw new Error('O arquivo não é um PDF válido.');
  }

  // Salvar como base64 no banco de dados (persiste em qualquer ambiente)
  const timbradoBase64 = file.buffer.toString('base64');

  console.log(`[TIMBRADO] Upload concluído: id=${id}, size=${file.size}, mimetype=${file.mimetype}`);

  return prisma.oSLayout.update({
    where: { id },
    data: {
      timbradoBlob: timbradoBase64,
      timbradoPath: null,
      tipo: 'pdf_importado',
    },
  });
}

export async function deleteTimbrado(id: string) {
  const existing = await prisma.oSLayout.findUnique({ where: { id } });
  if (!existing) throw new Error('Layout não encontrado');

  return prisma.oSLayout.update({
    where: { id },
    data: {
      timbradoBlob: null,
      timbradoPath: null,
    },
  });
}

/**
 * Retorna os bytes do timbrado PDF a partir do banco de dados.
 * Prioriza timbradoBlob (novo), fallback para timbradoPath (legado).
 * Retorna null se nenhum timbrado estiver disponível.
 */
export async function getTimbradoBytes(layoutId: string): Promise<Buffer | null> {
  const layout = await prisma.oSLayout.findUnique({ where: { id: layoutId } });
  if (!layout) {
    console.warn(`[TIMBRADO] Layout não encontrado: ${layoutId}`);
    return null;
  }

  // Prioridade 1: blob no banco (novo método, persistente)
  if (layout.timbradoBlob) {
    try {
      const buffer = Buffer.from(layout.timbradoBlob, 'base64');
      if (buffer.length > 0) {
        return buffer;
      }
    } catch (err: any) {
      console.error(`[TIMBRADO] Erro ao decodificar blob: ${err.message}`);
    }
  }

  // Prioridade 2: arquivo no disco (legado, pode não existir em produção)
  if (layout.timbradoPath) {
    const fullPath = path.resolve(__dirname, '../../../', layout.timbradoPath);
    if (fs.existsSync(fullPath)) {
      try {
        return fs.readFileSync(fullPath);
      } catch (err: any) {
        console.warn(`[TIMBRADO] Erro ao ler arquivo legado: ${fullPath} — ${err.message}`);
      }
    } else {
      console.warn(`[TIMBRADO] Arquivo legado não encontrado: ${fullPath}`);
    }
  }

  return null;
}

// ── Default Layout ────────────────────────────────────────────────────

export async function getDefaultLayout(organizationId?: string) {
  const where: any = { ativo: true, padrao: true };
  if (organizationId) where.organizationId = organizationId;

  let layout = await prisma.oSLayout.findFirst({ where });
  if (!layout) {
    layout = await prisma.oSLayout.findFirst({ where: { ativo: true } });
  }
  return layout;
}

export function getConfig(layout: any): LayoutConfig {
  return safeJsonParse(layout.configuracao || '{}');
}

// ── Upload de Logo ────────────────────────────────────────────────────

export async function uploadLogo(id: string, file: Express.Multer.File) {
  const existing = await prisma.oSLayout.findUnique({ where: { id } });
  if (!existing) throw new Error('Layout não encontrado');

  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    throw new Error('Formato inválido. Use PNG, JPEG ou WebP.');
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('O arquivo excede o tamanho permitido (5MB).');
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('Arquivo não recebido. Tente novamente.');
  }

  const logoBase64 = file.buffer.toString('base64');
  const config = getConfig(existing);
  config.logo = {
    base64: logoBase64,
    mimeType: file.mimetype,
    nome: file.originalname,
  };

  console.log(`[LOGO] Upload concluído: id=${id}, size=${file.size}, mimetype=${file.mimetype}`);

  return prisma.oSLayout.update({
    where: { id },
    data: { configuracao: JSON.stringify(config) },
  });
}

export async function deleteLogo(id: string) {
  const existing = await prisma.oSLayout.findUnique({ where: { id } });
  if (!existing) throw new Error('Layout não encontrado');

  const config = getConfig(existing);
  delete (config as any).logo;

  return prisma.oSLayout.update({
    where: { id },
    data: { configuracao: JSON.stringify(config) },
  });
}

export function getLogoBuffer(layout: any): Buffer | null {
  const config = getConfig(layout);
  const logo = (config as any).logo;
  if (!logo?.base64) return null;

  try {
    const buffer = Buffer.from(logo.base64, 'base64');
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}
