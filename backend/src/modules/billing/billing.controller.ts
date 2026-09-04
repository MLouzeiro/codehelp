import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getBillingsByClient,
  upsertBilling,
  getBillingHistory,
  getClientBillingHistory,
  calcularFaturamentoMensal,
  gerarPendencias,
  listarPendencias,
  resolverPendencia,
  getBillingDashboard,
} from './billing.service';
import { logAction, getIpFromRequest } from '../audit/audit.service';

const TIPOS_VALIDOS = ['terminais', 'hostlinks', 'interfaces', 'exames'];

// ── CRUD ──────────────────────────────────────────────────────────

export async function listBillings(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const billings = await getBillingsByClient(clientId);
    return res.json(billings);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar faturamentos' });
  }
}

export async function upsertBillingHandler(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const { tipo, quantidade, valorUnitario, motivo } = req.body;

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: `Tipo invalido. Use: ${TIPOS_VALIDOS.join(', ')}` });
    }
    if (quantidade === undefined || quantidade < 0) {
      return res.status(400).json({ error: 'Quantidade invalida' });
    }
    if (valorUnitario === undefined || valorUnitario < 0) {
      return res.status(400).json({ error: 'Valor unitario invalido' });
    }

    const billing = await upsertBilling({
      clientId,
      tipo,
      quantidade: parseInt(quantidade, 10),
      valorUnitario: parseFloat(valorUnitario),
      motivo: motivo ?? null,
      usuarioId: req.user?.id ?? null,
    });

    return res.json(billing);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao salvar faturamento' });
  }
}

// ── Historico ─────────────────────────────────────────────────────

export async function getBillingHistoryHandler(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const history = await getClientBillingHistory(clientId);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar historico' });
  }
}

// ── Calculo Mensal ────────────────────────────────────────────────

export async function calcularHandler(req: AuthRequest, res: Response) {
  try {
    const { periodo } = req.query;
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo as string)) {
      return res.status(400).json({ error: 'Periodo invalido. Use YYYY-MM.' });
    }
    const resultados = await calcularFaturamentoMensal(periodo as string);
    return res.json(resultados);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao calcular faturamento' });
  }
}

export async function gerarPendenciasHandler(req: AuthRequest, res: Response) {
  try {
    const { periodo } = req.query;
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo as string)) {
      return res.status(400).json({ error: 'Periodo invalido. Use YYYY-MM.' });
    }
    const criadas = await gerarPendencias(periodo as string);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'billing_gerar_pendencias',
      entidade: 'BillingPendency',
      detalhes: { periodo, criadas },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });
    return res.json({ message: `${criadas} pendencia(s) criada(s)`, criadas });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao gerar pendencias' });
  }
}

// ── Pendencias ─────────────────────────────────────────────────────

export async function listPendenciasHandler(req: AuthRequest, res: Response) {
  try {
    const { status, periodo, clienteId } = req.query;
    const pendencias = await listarPendencias({
      status: status as string | undefined,
      periodo: periodo as string | undefined,
      clienteId: clienteId as string | undefined,
    });
    return res.json(pendencias);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar pendencias' });
  }
}

export async function resolverPendenciaHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, observacao } = req.body;

    if (!status || !['cobrado', 'erro_ajuste'].includes(status)) {
      return res.status(400).json({ error: 'Status invalido. Use: cobrado ou erro_ajuste' });
    }

    const pendencia = await resolverPendencia(id, status, observacao ?? null, req.user?.id ?? '');
    return res.json(pendencia);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao resolver pendencia' });
  }
}

// ── Dashboard ──────────────────────────────────────────────────────

export async function dashboardHandler(req: AuthRequest, res: Response) {
  try {
    const dashboard = await getBillingDashboard();
    return res.json(dashboard);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar dashboard' });
  }
}
