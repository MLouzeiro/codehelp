import prisma from '../../config/database';

export interface FeriadoInput {
  data: Date;
  nome: string;
  tipo?: string;
  recorrente?: boolean;
  ativo?: boolean;
}

export interface Feriado {
  id: string;
  data: Date;
  nome: string;
  tipo: string;
  recorrente: boolean;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listarFeriados(apenasAtivos: boolean = true): Promise<Feriado[]> {
  return prisma.feriado.findMany({
    where: apenasAtivos ? { ativo: true } : undefined,
    orderBy: { data: 'asc' },
  });
}

export async function obterFeriadoPorId(id: string): Promise<Feriado | null> {
  return prisma.feriado.findUnique({ where: { id } });
}

export async function criarFeriado(input: FeriadoInput): Promise<Feriado> {
  if (!input.nome || input.nome.trim() === '') {
    throw new Error('nome do feriado é obrigatório');
  }
  if (!(input.data instanceof Date) || isNaN(input.data.getTime())) {
    throw new Error('data inválida');
  }

  return prisma.feriado.create({
    data: {
      data: input.data,
      nome: input.nome.trim(),
      tipo: input.tipo || 'nacional',
      recorrente: input.recorrente ?? false,
      ativo: input.ativo ?? true,
    },
  });
}

export async function atualizarFeriado(
  id: string,
  patch: Partial<FeriadoInput>,
): Promise<Feriado> {
  const existe = await prisma.feriado.findUnique({ where: { id } });
  if (!existe) throw new Error('feriado não encontrado');

  return prisma.feriado.update({
    where: { id },
    data: {
      ...(patch.nome !== undefined ? { nome: patch.nome.trim() } : {}),
      ...(patch.data !== undefined ? { data: patch.data } : {}),
      ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
      ...(patch.recorrente !== undefined ? { recorrente: patch.recorrente } : {}),
      ...(patch.ativo !== undefined ? { ativo: patch.ativo } : {}),
    },
  }).catch((err: any) => {
    if (err?.code === 'P2025') throw new Error('feriado não encontrado');
    throw err;
  });
}

export async function deletarFeriado(id: string): Promise<void> {
  await prisma.feriado.delete({ where: { id } });
}

export async function ehFeriado(data: Date): Promise<boolean> {
  const dia = data.getDate();
  const mes = data.getMonth() + 1;
  const ano = data.getFullYear();

  const candidatos = await prisma.feriado.findMany({
    where: { ativo: true },
  });

  return candidatos.some((f) => {
    const fDia = f.data.getDate();
    const fMes = f.data.getMonth() + 1;
    if (f.recorrente) {
      return fDia === dia && fMes === mes;
    }
    return fDia === dia && fMes === mes && f.data.getFullYear() === ano;
  });
}

interface FeriadoNacional {
  mes: number;
  dia: number;
  nome: string;
}

const FERIADOS_NACIONAIS: FeriadoNacional[] = [
  { mes: 1, dia: 1, nome: 'Confraternização Universal' },
  { mes: 4, dia: 21, nome: 'Tiradentes' },
  { mes: 5, dia: 1, nome: 'Dia do Trabalho' },
  { mes: 9, dia: 7, nome: 'Independência do Brasil' },
  { mes: 10, dia: 12, nome: 'Nossa Senhora Aparecida' },
  { mes: 11, dia: 2, nome: 'Finados' },
  { mes: 11, dia: 15, nome: 'Proclamação da República' },
  { mes: 12, dia: 25, nome: 'Natal' },
];

export async function seedFeriadosNacionais(): Promise<number> {
  let inseridos = 0;
  const anoAtual = new Date().getFullYear();
  for (const ano of [anoAtual, anoAtual + 1]) {
    for (const f of FERIADOS_NACIONAIS) {
      const data = new Date(Date.UTC(ano, f.mes - 1, f.dia, 12, 0, 0));
      const existe = await prisma.feriado.findFirst({
        where: { nome: f.nome, recorrente: true, data },
      });
      if (!existe) {
        await prisma.feriado.create({
          data: { data, nome: f.nome, tipo: 'nacional', recorrente: true, ativo: true },
        });
        inseridos++;
      }
    }
  }
  return inseridos;
}
