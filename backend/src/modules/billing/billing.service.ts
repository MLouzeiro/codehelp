import prisma from '../../config/database';
import { logAction } from '../audit/audit.service';

// ── CRUD de Billing por Cliente ─────────────────────────────────────

export interface BillingInput {
  clientId: string;
  tipo: string; // terminais, hostlinks, interfaces, exames
  quantidade: number;
  valorUnitario: number;
  motivo?: string | null;
  usuarioId?: string | null;
}

export async function getBillingsByClient(clientId: string) {
  return prisma.clientBilling.findMany({
    where: { clientId, ativo: true },
    orderBy: { tipo: 'asc' },
  });
}

export async function getBillingById(id: string) {
  return prisma.clientBilling.findUnique({ where: { id } });
}

export async function upsertBilling(input: BillingInput) {
  const existing = await prisma.clientBilling.findUnique({
    where: { clientId_tipo: { clientId: input.clientId, tipo: input.tipo } },
  });

  if (existing) {
    // Only update if quantity actually changed
    if (existing.quantidade !== input.quantidade) {
      const anterior = existing.quantidade;
      await prisma.clientBilling.update({
        where: { id: existing.id },
        data: { quantidade: input.quantidade, valorUnitario: input.valorUnitario },
      });
      // Record history
      await prisma.billingHistory.create({
        data: {
          billingId: existing.id,
          clienteId: input.clientId,
          tipo: input.tipo,
          quantidadeAnterior: anterior,
          quantidadeNova: input.quantidade,
          valorUnitario: input.valorUnitario,
          usuarioId: input.usuarioId ?? null,
          motivo: input.motivo ?? null,
        },
      });
      // Audit log
      await logAction({
        usuarioId: input.usuarioId,
        acao: 'billing_atualizar',
        entidade: 'ClientBilling',
        entidadeId: existing.id,
        detalhes: { tipo: input.tipo, anterior, novo: input.quantidade, motivo: input.motivo },
      });
    }
    return existing;
  }

  // Create new
  const created = await prisma.clientBilling.create({
    data: {
      clientId: input.clientId,
      tipo: input.tipo,
      quantidade: input.quantidade,
      valorUnitario: input.valorUnitario,
    },
  });

  // Record history (first entry: 0 -> quantidade)
  await prisma.billingHistory.create({
    data: {
      billingId: created.id,
      clienteId: input.clientId,
      tipo: input.tipo,
      quantidadeAnterior: 0,
      quantidadeNova: input.quantidade,
      valorUnitario: input.valorUnitario,
      usuarioId: input.usuarioId ?? null,
      motivo: input.motivo ?? 'Criacao inicial',
    },
  });

  await logAction({
    usuarioId: input.usuarioId,
    acao: 'billing_criar',
    entidade: 'ClientBilling',
    entidadeId: created.id,
    detalhes: { tipo: input.tipo, quantidade: input.quantidade },
  });

  return created;
}

// ── Historico ──────────────────────────────────────────────────────

export async function getBillingHistory(billingId: string) {
  return prisma.billingHistory.findMany({
    where: { billingId },
    include: { usuario: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClientBillingHistory(clientId: string) {
  return prisma.billingHistory.findMany({
    where: { clienteId: clientId },
    include: { usuario: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

// ── Calculo Mensal + Alertas ───────────────────────────────────────

export interface PeriodoResult {
  clienteId: string;
  clienteNome: string;
  tipo: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export async function calcularFaturamentoMensal(periodo: string): Promise<PeriodoResult[]> {
  const results: PeriodoResult[] = [];

  // Get all active billings
  const billings = await prisma.clientBilling.findMany({
    where: { ativo: true },
    include: { client: { select: { id: true, razaoSocial: true, nomeFantasia: true, ativo: true } } },
  });

  for (const billing of billings) {
    if (!billing.client.ativo) continue;

    let quantidade = billing.quantidade;

    // For exames type, count from ticket table if available
    if (billing.tipo === 'exames') {
      const [ano, mes] = periodo.split('-').map(Number);
      const inicio = new Date(ano, mes - 1, 1);
      const fim = new Date(ano, mes, 0, 23, 59, 59);
      const count = await prisma.ticket.count({
        where: {
          clientId: billing.clientId,
          createdAt: { gte: inicio, lte: fim },
        },
      });
      quantidade = count;
    }

    if (quantidade > 0) {
      results.push({
        clienteId: billing.clientId,
        clienteNome: billing.client.nomeFantasia || billing.client.razaoSocial,
        tipo: billing.tipo,
        quantidade,
        valorUnitario: billing.valorUnitario,
        valorTotal: quantidade * billing.valorUnitario,
      });
    }
  }

  return results;
}

export async function gerarPendencias(periodo: string): Promise<number> {
  const resultados = await calcularFaturamentoMensal(periodo);
  let criadas = 0;

  for (const r of resultados) {
    // Check if pendency already exists for this period
    const existing = await prisma.billingPendency.findUnique({
      where: { clienteId_tipo_periodo: { clienteId: r.clienteId, tipo: r.tipo, periodo } },
    });

    if (!existing) {
      await prisma.billingPendency.create({
        data: {
          clienteId: r.clienteId,
          tipo: r.tipo,
          periodo,
          quantidade: r.quantidade,
          valorTotal: r.valorTotal,
          status: 'pendente',
        },
      });
      criadas++;
    }
  }

  return criadas;
}

// ── Pendencias ─────────────────────────────────────────────────────

export interface PendenciaFiltros {
  status?: string;
  periodo?: string;
  clienteId?: string;
}

export async function listarPendencias(filtros: PendenciaFiltros = {}) {
  const where: any = {};
  if (filtros.status) where.status = filtros.status;
  if (filtros.periodo) where.periodo = filtros.periodo;
  if (filtros.clienteId) where.clienteId = filtros.clienteId;

  return prisma.billingPendency.findMany({
    where,
    include: {
      client: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
    },
    orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function resolverPendencia(
  id: string,
  status: 'cobrado' | 'erro_ajuste',
  observacao: string | null,
  usuarioId: string,
) {
  const pendencia = await prisma.billingPendency.update({
    where: { id },
    data: {
      status,
      resolvidoEm: new Date(),
      resolvidoPor: usuarioId,
      observacao,
    },
    include: {
      client: { select: { id: true, razaoSocial: true } },
    },
  });

  await logAction({
    usuarioId,
    acao: `billing_${status}`,
    entidade: 'BillingPendency',
    entidadeId: id,
    detalhes: {
      clienteId: pendencia.clienteId,
      cliente: pendencia.client.razaoSocial,
      tipo: pendencia.tipo,
      periodo: pendencia.periodo,
      valor: pendencia.valorTotal,
      observacao,
    },
  });

  return pendencia;
}

// ── Dashboard / BI ─────────────────────────────────────────────────

export async function getBillingDashboard() {
  const [pendentes, cobrados, comErro, totalPeriodo] = await Promise.all([
    prisma.billingPendency.count({ where: { status: 'pendente' } }),
    prisma.billingPendency.count({ where: { status: 'cobrado' } }),
    prisma.billingPendency.count({ where: { status: 'erro_ajuste' } }),
    prisma.billingPendency.groupBy({
      by: ['tipo'],
      _sum: { valorTotal: true },
      _count: true,
      where: { status: 'pendente' },
    }),
  ]);

  const valorPendente = await prisma.billingPendency.aggregate({
    where: { status: 'pendente' },
    _sum: { valorTotal: true },
  });

  const clientesCobradosMes = await prisma.billingPendency.findMany({
    where: { status: 'cobrado' },
    select: { clienteId: true },
    distinct: ['clienteId'],
  });

  const historicoErros = await prisma.billingPendency.findMany({
    where: { status: 'erro_ajuste' },
    include: { client: { select: { razaoSocial: true, nomeFantasia: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    pendentes,
    cobrados,
    comErro,
    valorPendente: valorPendente._sum.valorTotal || 0,
    porTipo: totalPeriodo,
    clientesCobradosMes: clientesCobradosMes.length,
    historicoErros,
  };
}
