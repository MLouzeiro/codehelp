import prisma from '../../config/database';

export interface CustoDiario {
  data: string;
  chamadas: number;
  inputTokens: number;
  outputTokens: number;
  custoInput: number;
  custoOutput: number;
  custoTotal: number;
}

export interface CustoPorModulo {
  modulo: string;
  chamadas: number;
  inputTokens: number;
  outputTokens: number;
  custoTotal: number;
  percentual: number;
}

export interface CustoResumo {
  periodo: { inicio: string; fim: string; dias: number };
  total: {
    chamadas: number;
    inputTokens: number;
    outputTokens: number;
    custoInput: number;
    custoOutput: number;
    custoTotal: number;
    custoMedioPorChamada: number;
  };
  porDia: CustoDiario[];
  porModulo: CustoPorModulo[];
  projecaoMes: number;
}

export async function getCustoResumo(dias: number = 30): Promise<CustoResumo> {
  const diasFinal = Math.min(Math.max(Number.isFinite(dias) ? dias : 30, 1), 90);
  const dataInicio = new Date(Date.now() - diasFinal * 24 * 60 * 60 * 1000);
  const dataFim = new Date();

  const logs = await prisma.aICostLog.findMany({
    where: { createdAt: { gte: dataInicio, lte: dataFim } },
    orderBy: { createdAt: 'asc' },
    select: {
      inputTokens: true,
      outputTokens: true,
      custoInput: true,
      custoOutput: true,
      custoTotal: true,
      modulo: true,
      createdAt: true,
    },
  });

  const totalChamadas = logs.length;
  const totalInputTokens = logs.reduce((s, l) => s + l.inputTokens, 0);
  const totalOutputTokens = logs.reduce((s, l) => s + l.outputTokens, 0);
  const totalCustoInput = logs.reduce((s, l) => s + l.custoInput, 0);
  const totalCustoOutput = logs.reduce((s, l) => s + l.custoOutput, 0);
  const totalCusto = logs.reduce((s, l) => s + l.custoTotal, 0);
  const custoMedio = totalChamadas > 0 ? totalCusto / totalChamadas : 0;

  const diasMap = new Map<string, {
    chamadas: number; inputTokens: number; outputTokens: number;
    custoInput: number; custoOutput: number; custoTotal: number;
  }>();

  for (const log of logs) {
    const dia = log.createdAt.toISOString().slice(0, 10);
    const cur = diasMap.get(dia) || { chamadas: 0, inputTokens: 0, outputTokens: 0, custoInput: 0, custoOutput: 0, custoTotal: 0 };
    cur.chamadas++;
    cur.inputTokens += log.inputTokens;
    cur.outputTokens += log.outputTokens;
    cur.custoInput += log.custoInput;
    cur.custoOutput += log.custoOutput;
    cur.custoTotal += log.custoTotal;
    diasMap.set(dia, cur);
  }

  const porDia: CustoDiario[] = Array.from(diasMap.entries())
    .map(([data, d]) => ({
      data,
      chamadas: d.chamadas,
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      custoInput: Math.round(d.custoInput * 1_000_000) / 1_000_000,
      custoOutput: Math.round(d.custoOutput * 1_000_000) / 1_000_000,
      custoTotal: Math.round(d.custoTotal * 1_000_000) / 1_000_000,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const modulosMap = new Map<string, {
    chamadas: number; inputTokens: number; outputTokens: number; custoTotal: number;
  }>();

  for (const log of logs) {
    const mod = log.modulo || 'sem_modulo';
    const cur = modulosMap.get(mod) || { chamadas: 0, inputTokens: 0, outputTokens: 0, custoTotal: 0 };
    cur.chamadas++;
    cur.inputTokens += log.inputTokens;
    cur.outputTokens += log.outputTokens;
    cur.custoTotal += log.custoTotal;
    modulosMap.set(mod, cur);
  }

  const porModulo: CustoPorModulo[] = Array.from(modulosMap.entries())
    .map(([modulo, d]) => ({
      modulo,
      chamadas: d.chamadas,
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      custoTotal: Math.round(d.custoTotal * 1_000_000) / 1_000_000,
      percentual: totalCusto > 0 ? Math.round((d.custoTotal / totalCusto) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.custoTotal - a.custoTotal);

  const custoPorDia = totalChamadas > 0 ? totalCusto / diasFinal : 0;
  const projecaoMes = custoPorDia * 30;

  return {
    periodo: {
      inicio: dataInicio.toISOString(),
      fim: dataFim.toISOString(),
      dias: diasFinal,
    },
    total: {
      chamadas: totalChamadas,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      custoInput: Math.round(totalCustoInput * 1_000_000) / 1_000_000,
      custoOutput: Math.round(totalCustoOutput * 1_000_000) / 1_000_000,
      custoTotal: Math.round(totalCusto * 1_000_000) / 1_000_000,
      custoMedioPorChamada: Math.round(custoMedio * 1_000_000) / 1_000_000,
    },
    porDia,
    porModulo,
    projecaoMes: Math.round(projecaoMes * 1_000_000) / 1_000_000,
  };
}

export async function getCustoHoje(): Promise<CustoDiario> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const logs = await prisma.aICostLog.findMany({
    where: { createdAt: { gte: inicio } },
    select: {
      inputTokens: true, outputTokens: true,
      custoInput: true, custoOutput: true, custoTotal: true,
    },
  });

  return {
    data: inicio.toISOString().slice(0, 10),
    chamadas: logs.length,
    inputTokens: logs.reduce((s, l) => s + l.inputTokens, 0),
    outputTokens: logs.reduce((s, l) => s + l.outputTokens, 0),
    custoInput: Math.round(logs.reduce((s, l) => s + l.custoInput, 0) * 1_000_000) / 1_000_000,
    custoOutput: Math.round(logs.reduce((s, l) => s + l.custoOutput, 0) * 1_000_000) / 1_000_000,
    custoTotal: Math.round(logs.reduce((s, l) => s + l.custoTotal, 0) * 1_000_000) / 1_000_000,
  };
}
