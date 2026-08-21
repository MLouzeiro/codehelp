import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getIndicadoresAtendimento,
  getMetasIndicadores,
  setMetasIndicadores,
  getSlaTicketIndicador,
  getAlertasIndicadores,
  exportarIndicadoresCsv,
  FiltrosIndicadores,
  MetasIndicadores,
} from './indicadores.service';

function parseFiltros(query: Record<string, any>): FiltrosIndicadores {
  const filtros: FiltrosIndicadores = {};

  if (query.inicio) {
    const d = new Date(query.inicio as string);
    if (!isNaN(d.getTime())) filtros.inicio = d;
  }
  if (query.fim) {
    const d = new Date(query.fim as string);
    if (!isNaN(d.getTime())) filtros.fim = d;
  }
  if (query.filaId) filtros.filaId = query.filaId as string;
  if (query.canal) filtros.canal = query.canal as string;
  if (query.prioridade) filtros.prioridade = query.prioridade as string;
  if (query.status) filtros.status = query.status as string;
  if (query.etapa) filtros.etapa = query.etapa as string;
  if (query.departamentoId) filtros.departamentoId = query.departamentoId as string;
  if (query.analistaId) filtros.analistaId = query.analistaId as string;
  if (query.clienteId) filtros.clienteId = query.clienteId as string;
  if (query.categoria) filtros.categoria = query.categoria as string;
  if (query.assunto) filtros.assunto = query.assunto as string;

  return filtros;
}

export async function getIndicadoresHandler(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const dados = await getIndicadoresAtendimento(filtros);
    res.json(dados);
  } catch (err: any) {
    console.error('[Indicadores] Erro ao calcular indicadores:', err?.message || err);
    res.status(500).json({ error: 'Erro ao calcular indicadores' });
  }
}

export async function getMetasHandler(_req: AuthRequest, res: Response) {
  try {
    const metas = await getMetasIndicadores();
    res.json(metas);
  } catch (err: any) {
    console.error('[Indicadores] Erro ao buscar metas:', err?.message || err);
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
}

export async function putMetasHandler(req: AuthRequest, res: Response) {
  try {
    const body = (req.body || {}) as Partial<MetasIndicadores>;
    const metas = await setMetasIndicadores({
      tmrMetaMin: typeof body.tmrMetaMin === 'number' ? body.tmrMetaMin : undefined,
      tmeMetaMin: typeof body.tmeMetaMin === 'number' ? body.tmeMetaMin : undefined,
      primeiraRespostaMetaMin: typeof body.primeiraRespostaMetaMin === 'number' ? body.primeiraRespostaMetaMin : undefined,
      slaMetaPct: typeof body.slaMetaPct === 'number' ? body.slaMetaPct : undefined,
      slaRiscoPct: typeof body.slaRiscoPct === 'number' ? body.slaRiscoPct : undefined,
    });
    res.json(metas);
  } catch (err: any) {
    console.error('[Indicadores] Erro ao salvar metas:', err?.message || err);
    res.status(500).json({ error: 'Erro ao salvar metas' });
  }
}

export async function getSlaTicketHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const dados = await getSlaTicketIndicador(id);
    if (!dados) {
      res.status(404).json({ error: 'Ticket não encontrado' });
      return;
    }
    res.json(dados);
  } catch (err: any) {
    console.error('[Indicadores] Erro ao calcular SLA do ticket:', err?.message || err);
    res.status(500).json({ error: 'Erro ao calcular SLA do ticket' });
  }
}

export async function getAlertasHandler(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const dados = await getAlertasIndicadores(filtros);
    res.json(dados);
  } catch (err: any) {
    console.error('[Indicadores] Erro ao calcular alertas:', err?.message || err);
    res.status(500).json({ error: 'Erro ao calcular alertas' });
  }
}

export async function getIndicadoresCsvHandler(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const csv = await exportarIndicadoresCsv(filtros);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="indicadores-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (err: any) {
    console.error('[Indicadores] Erro ao exportar CSV:', err?.message || err);
    res.status(500).json({ error: 'Erro ao exportar CSV' });
  }
}
