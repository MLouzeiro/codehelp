import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  gerarRelatorioAnalitico,
  gerarCsvRelatorio,
  gerarPdfRelatorio,
  gerarExcelRelatorio,
  obterOpcoesFiltros,
  RelatorioFiltros,
} from './relatorios.service';

function parseFiltros(query: Record<string, any>): RelatorioFiltros {
  const filtros: RelatorioFiltros = {};

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

export async function getRelatorioAnalitico(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const dados = await gerarRelatorioAnalitico(filtros);
    res.json(dados);
  } catch (err: any) {
    console.error('[Relatorios] Erro ao gerar relatório analítico:', err?.message || err);
    res.status(500).json({ error: 'Erro ao gerar relatório analítico' });
  }
}

export async function getRelatorioCsv(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const dados = await gerarRelatorioAnalitico(filtros);
    const csv = gerarCsvRelatorio(dados);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${dados.periodo.dias}d.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (err: any) {
    console.error('[Relatorios] Erro ao exportar CSV:', err?.message || err);
    res.status(500).json({ error: 'Erro ao exportar CSV' });
  }
}

export async function getRelatorioPdf(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const dados = await gerarRelatorioAnalitico(filtros);
    const pdf = await gerarPdfRelatorio(dados);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${dados.periodo.dias}d.pdf"`);
    res.send(pdf);
  } catch (err: any) {
    console.error('[Relatorios] Erro ao exportar PDF:', err?.message || err);
    res.status(500).json({ error: 'Erro ao exportar PDF' });
  }
}

export async function getRelatorioExcel(req: AuthRequest, res: Response) {
  try {
    const filtros = parseFiltros(req.query);
    const dados = await gerarRelatorioAnalitico(filtros);
    const buffer = await gerarExcelRelatorio(dados);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${dados.periodo.dias}d.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('[Relatorios] Erro ao exportar Excel:', err?.message || err);
    res.status(500).json({ error: 'Erro ao exportar Excel' });
  }
}

export async function getOpcoesFiltros(_req: AuthRequest, res: Response) {
  try {
    const opcoes = await obterOpcoesFiltros();
    res.json(opcoes);
  } catch (err: any) {
    console.error('[Relatorios] Erro ao obter opções de filtro:', err?.message || err);
    res.status(500).json({ error: 'Erro ao obter opções de filtro' });
  }
}