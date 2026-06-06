import prisma from '../../config/database';

export interface ColaboradorCreateInput {
  nome: string;
  cargo?: string | null;
  setor?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  principal?: boolean;
  observacoes?: string | null;
}

export interface ColaboradorUpdateInput {
  nome?: string;
  cargo?: string | null;
  setor?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  principal?: boolean;
  observacoes?: string | null;
  ativo?: boolean;
}

export async function criarColaborador(clientId: string, input: ColaboradorCreateInput) {
  if (!input.nome || !input.nome.trim()) {
    throw new Error('Nome do colaborador e obrigatorio');
  }
  const cliente = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!cliente) {
    throw new Error('Cliente nao encontrado');
  }

  if (input.principal) {
    await prisma.colaborador.updateMany({
      where: { clientId, principal: true },
      data: { principal: false },
    });
  }

  return prisma.colaborador.create({
    data: {
      clientId,
      nome: input.nome.trim(),
      cargo: input.cargo ?? null,
      setor: input.setor ?? null,
      email: input.email ?? null,
      telefone: input.telefone ?? null,
      whatsapp: input.whatsapp ?? null,
      principal: input.principal ?? false,
      observacoes: input.observacoes ?? null,
    },
  });
}

export async function listarColaboradoresPorCliente(clientId: string) {
  return prisma.colaborador.findMany({
    where: { clientId, ativo: true },
    orderBy: [{ principal: 'desc' }, { nome: 'asc' }],
  });
}

export async function getColaborador(id: string) {
  return prisma.colaborador.findUnique({ where: { id } });
}

export async function atualizarColaborador(id: string, input: ColaboradorUpdateInput) {
  const existe = await prisma.colaborador.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;

  const data: any = {};
  if (input.nome !== undefined) data.nome = input.nome.trim();
  if (input.cargo !== undefined) data.cargo = input.cargo;
  if (input.setor !== undefined) data.setor = input.setor;
  if (input.email !== undefined) data.email = input.email;
  if (input.telefone !== undefined) data.telefone = input.telefone;
  if (input.whatsapp !== undefined) data.whatsapp = input.whatsapp;
  if (input.observacoes !== undefined) data.observacoes = input.observacoes;
  if (input.ativo !== undefined) data.ativo = input.ativo;
  if (input.principal !== undefined) data.principal = input.principal;

  if (input.principal === true) {
    const colab = await prisma.colaborador.findUnique({ where: { id }, select: { clientId: true } });
    if (colab) {
      await prisma.colaborador.updateMany({
        where: { clientId: colab.clientId, principal: true, NOT: { id } },
        data: { principal: false },
      });
    }
  }

  return prisma.colaborador.update({ where: { id }, data });
}

export async function deletarColaborador(id: string) {
  const existe = await prisma.colaborador.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return false;
  await prisma.colaborador.delete({ where: { id } });
  return true;
}

export async function marcarPrincipal(id: string, clientId: string, valor: boolean = true) {
  if (valor) {
    await prisma.colaborador.updateMany({
      where: { clientId, principal: true, NOT: { id } },
      data: { principal: false },
    });
  }
  return prisma.colaborador.update({
    where: { id },
    data: { principal: valor },
  });
}
