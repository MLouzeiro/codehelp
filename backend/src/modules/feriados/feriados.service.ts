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
  }).then(result => { invalidateFeriadosCache(); return result; });
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
  }).then(result => { invalidateFeriadosCache(); return result; }).catch((err: any) => {
    if (err?.code === 'P2025') throw new Error('feriado não encontrado');
    throw err;
  });
}

export async function deletarFeriado(id: string): Promise<void> {
  await prisma.feriado.delete({ where: { id } });
  invalidateFeriadosCache();
}

// ── Cache de feriados (TTL 1h) ────────────────────────────────────────
// ehFeriado é chamado a cada mensagem inbound — cache evita query ao DB.
let feriadosCache: { data: Date; ativos: Array<{ dia: number; mes: number; ano: number | null; recorrente: boolean }> } | null = null;
const FERIADOS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export async function ehFeriado(data: Date): Promise<boolean> {
  const dia = data.getDate();
  const mes = data.getMonth() + 1;
  const ano = data.getFullYear();

  const now = Date.now();
  if (!feriadosCache || now - feriadosCache.data.getTime() > FERIADOS_CACHE_TTL_MS) {
    const candidatos = await prisma.feriado.findMany({
      where: { ativo: true },
    });
    feriadosCache = {
      data: new Date(),
      ativos: candidatos.map(f => ({
        dia: f.data.getDate(),
        mes: f.data.getMonth() + 1,
        ano: f.recorrente ? null : f.data.getFullYear(),
        recorrente: f.recorrente,
      })),
    };
  }

  return feriadosCache.ativos.some((f) => {
    if (f.recorrente) {
      return f.dia === dia && f.mes === mes;
    }
    return f.dia === dia && f.mes === mes && f.ano === ano;
  });
}

export function invalidateFeriadosCache(): void {
  feriadosCache = null;
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
