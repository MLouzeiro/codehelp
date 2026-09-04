import prisma from '../../../config/database';

export interface WhatsAppConnectionInput {
  nome: string;
  numero: string;
  slug?: string;
  provider?: string; // baileys | whatsapp-webjs
  departamentoId?: string;
  ativo?: boolean;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listConnections(includeInativos = false) {
  const where: any = {};
  if (!includeInativos) where.ativo = true;

  return prisma.whatsAppConnection.findMany({
    where,
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  });
}

export async function getConnectionById(id: string) {
  return prisma.whatsAppConnection.findUnique({
    where: { id },
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
      _count: { select: { tickets: true } },
    },
  });
}

export async function createConnection(input: WhatsAppConnectionInput) {
  if (!input.nome?.trim()) throw new Error('Nome e obrigatorio');
  if (!input.numero?.trim()) throw new Error('Numero e obrigatorio');

  const slug = input.slug?.trim() || toKebabCase(input.nome);
  const existingSlug = await prisma.whatsAppConnection.findFirst({ where: { slug } });
  if (existingSlug) throw new Error('Ja existe uma conexao com este slug');

  const existingNum = await prisma.whatsAppConnection.findFirst({
    where: { numero: input.numero.trim() },
  });
  if (existingNum) throw new Error('Ja existe uma conexao com este numero');

  // Validate provider
  const provider = input.provider || 'baileys';
  if (!['baileys', 'whatsapp-webjs'].includes(provider)) {
    throw new Error('Provider invalido. Use "baileys" ou "whatsapp-webjs"');
  }

  return prisma.whatsAppConnection.create({
    data: {
      nome: input.nome.trim(),
      numero: input.numero.trim(),
      slug,
      provider,
      departamentoId: input.departamentoId || null,
    },
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
    },
  });
}

export async function updateConnection(id: string, input: Partial<WhatsAppConnectionInput>) {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { id } });
  if (!conn) return null;

  const data: any = {};
  if (input.nome !== undefined) data.nome = input.nome.trim();
  if (input.numero !== undefined) data.numero = input.numero.trim();
  if (input.departamentoId !== undefined) data.departamentoId = input.departamentoId || null;
  if (input.ativo !== undefined) data.ativo = input.ativo;
  if (input.provider !== undefined) {
    if (!['baileys', 'whatsapp-webjs'].includes(input.provider)) {
      throw new Error('Provider invalido. Use "baileys" ou "whatsapp-webjs"');
    }
    data.provider = input.provider;
  }

  return prisma.whatsAppConnection.update({
    where: { id },
    data,
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
    },
  });
}

export async function toggleConnection(id: string) {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { id } });
  if (!conn) return null;

  return prisma.whatsAppConnection.update({
    where: { id },
    data: { ativo: !conn.ativo },
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
    },
  });
}

export async function deleteConnection(id: string) {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { id } });
  if (!conn) return null;

  // Check if there are tickets linked
  const ticketCount = await prisma.ticket.count({ where: { whatsappConnectionId: id } });
  if (ticketCount > 0) {
    throw new Error(`Esta conexao possui ${ticketCount} ticket(s) vinculado(s). Desvincule os tickets antes de excluir.`);
  }

  await prisma.whatsAppConnection.delete({ where: { id } });
  return true;
}

export async function findByNumero(numero: string) {
  const sanitized = numero.replace(/\D/g, '');
  return prisma.whatsAppConnection.findFirst({
    where: {
      OR: [
        { numero: { contains: sanitized } },
        { numero: { contains: sanitized.slice(-11) } },
      ],
      ativo: true,
    },
    include: {
      departamento: { select: { id: true, nome: true, slug: true, cor: true } },
    },
  });
}
