import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  auditarTicket,
  getAuditoriaByTicket,
  getAuditoriaById,
  listarAuditorias,
  revisarAuditoria,
  FiltroAuditoria,
  classificarNota,
  CATEGORIAS_14,
  CLASSIFICACOES_GERAIS,
  CLASSIFICACOES_RESOLUCAO,
  CLASSIFICACOES_ENCERRAMENTO,
  PADROES,
} from './auditoriaProfissional.service';
import {
  getPanoramaAuditoria,
  calcularEvolucaoAnalista,
} from './auditoriaAgregacao.service';
import {
  gerarTomadaDecisao,
  getFilaAuditoria,
  auditarAmostra,
  criarTarefaDeRecomendacao,
} from './auditoriaDecisao.service';
import {
  gerarRelatorioTicket,
  gerarRelatorioConsolidado,
  exportarAuditoriaCsv,
  exportarAuditoriaExcel,
} from './auditoriaRelatorio.service';

export function parseFiltroAuditoria(req: AuthRequest): FiltroAuditoria {
  const { dataInicio, dataFim, agenteId, clienteId, departamentoId, categoria, status, classificacao, classificacaoResolucao, revisaoStatus, limit, offset } = req.query;
  let inicio: Date | undefined;
  let fim: Date | undefined;
  if (dataInicio) {
    inicio = new Date(dataInicio as string);
    if (isNaN(inicio.getTime())) throw new Error('dataInicio inválida');
  }
  if (dataFim) {
    fim = new Date(dataFim as string);
    if (isNaN(fim.getTime())) throw new Error('dataFim inválida');
  }
  let limite: number | undefined;
  if (limit !== undefined) {
    limite = Number(limit);
    if (!Number.isFinite(limite) || limite < 1 || limite > 1000) throw new Error('limit deve ser entre 1 e 1000');
  }
  let skip: number | undefined;
  if (offset !== undefined) {
    skip = Number(offset);
    if (!Number.isFinite(skip) || skip < 0) throw new Error('offset inválido');
  }
  return {
    dataInicio: inicio,
    dataFim: fim,
    agenteId: agenteId as string | undefined,
    clienteId: clienteId as string | undefined,
    departamentoId: departamentoId as string | undefined,
    categoria: categoria as string | undefined,
    status: status as string | undefined,
    classificacao: classificacao as string | undefined,
    classificacaoResolucao: classificacaoResolucao as string | undefined,
    revisaoStatus: revisaoStatus as string | undefined,
    limit: limite,
    offset: skip,
  };
}

export async function postAuditarTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const usarIa = req.query.ia !== 'false';
    const resultado = await auditarTicket(id, usarIa);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao auditar ticket' });
  }
}

export async function getAuditoriaTicket(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const auditoria = await getAuditoriaByTicket(ticketId);
    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoria não encontrada para este ticket' });
    }
    res.json(auditoria);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar auditoria' });
  }
}

export async function getAuditoriaByIdHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const auditoria = await getAuditoriaById(id);
    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoria não encontrada' });
    }
    res.json(auditoria);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar auditoria' });
  }
}

export async function getListarAuditorias(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    const resultado = await listarAuditorias(filtro);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao listar auditorias' });
  }
}

export async function postRevisarAuditoria(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { revisaoStatus, justificativa } = req.body || {};
    if (!revisaoStatus || !['CONFIRMADO', 'DISCORDO', 'REVISAR', 'NAO_SE_APLICA'].includes(revisaoStatus)) {
      return res.status(400).json({ error: 'revisaoStatus inválido' });
    }
    const resultado = await revisarAuditoria(id, revisaoStatus, justificativa, req.user?.id || '');
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao revisar auditoria' });
  }
}

export async function getMetaAuditoria(req: AuthRequest, res: Response) {
  res.json({
    categorias: CATEGORIAS_14,
    classificacoes: CLASSIFICACOES_GERAIS,
    classificacoesResolucao: CLASSIFICACOES_RESOLUCAO,
    classificacoesEncerramento: CLASSIFICACOES_ENCERRAMENTO,
    padroes: PADROES,
    classificarNota: (n: number) => classificarNota(n),
  });
}

export async function getPanoramaHandler(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    const panorama = await getPanoramaAuditoria(filtro);
    res.json(panorama);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao gerar panorama' });
  }
}

export async function getEvolucaoHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const meses = parseInt(req.query.meses as string) || 3;
    const meta = parseInt(req.query.meta as string) || 80;
    const evolucao = await calcularEvolucaoAnalista(id, meses, meta);
    if (!evolucao) {
      return res.status(404).json({ error: 'Analista não encontrado' });
    }
    res.json(evolucao);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao calcular evolução' });
  }
}

export async function getTomadaDecisaoHandler(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    const resultado = await gerarTomadaDecisao(filtro);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao gerar tomada de decisão' });
  }
}

export async function getFilaAuditoriaHandler(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    const fila = await getFilaAuditoria(filtro);
    res.json(fila);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao listar fila de auditoria' });
  }
}

export async function postAuditarAmostraHandler(req: AuthRequest, res: Response) {
  try {
    const percentual = parseInt(req.body.percentual as string) || 20;
    const limit = parseInt(req.body.limit as string) || 50;
    const usarIa = req.body.ia !== false;
    const auditados = await auditarAmostra(percentual, limit, usarIa);
    res.json({ auditados });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao auditar amostra' });
  }
}

export async function postCriarTarefaDeRecomendacao(req: AuthRequest, res: Response) {
  try {
    const { recomendacaoId, boardId, responsavelId, prazoEntrega } = req.body || {};
    if (!recomendacaoId || !boardId) {
      return res.status(400).json({ error: 'recomendacaoId e boardId são obrigatórios' });
    }
    const task = await criarTarefaDeRecomendacao(recomendacaoId, boardId, {
      responsavelId,
      prazoEntrega: prazoEntrega ? new Date(prazoEntrega) : undefined,
    });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Erro ao criar tarefa da recomendação' });
  }
}

function parseTipoRelatorio(req: AuthRequest): 'INTERNO' | 'CLIENTE' {
  const t = (req.query.tipo as string) || 'INTERNO';
  return t === 'CLIENTE' ? 'CLIENTE' : 'INTERNO';
}

export async function getRelatorioTicketHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const relatorio = await gerarRelatorioTicket(id, parseTipoRelatorio(req));
    res.json(relatorio);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao gerar relatório' });
  }
}

export async function getRelatorioConsolidadoHandler(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    const relatorio = await gerarRelatorioConsolidado(filtro, parseTipoRelatorio(req));
    res.json(relatorio);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao gerar relatório consolidado' });
  }
}

export async function getExportarAuditoriaCsvHandler(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    if (!filtro.limit) filtro.limit = 500;
    const { listarAuditorias } = await import('./auditoriaProfissional.service');
    const { items } = await listarAuditorias(filtro);
    const csv = exportarAuditoriaCsv(items);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-ia.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao exportar CSV' });
  }
}

export async function getExportarAuditoriaExcelHandler(req: AuthRequest, res: Response) {
  try {
    const filtro = parseFiltroAuditoria(req);
    if (!filtro.limit) filtro.limit = 500;
    const { listarAuditorias } = await import('./auditoriaProfissional.service');
    const { calcularIndicadores } = await import('./auditoriaAgregacao.service');
    const { items } = await listarAuditorias(filtro);
    const indicadores = await calcularIndicadores(filtro);
    const buffer = await exportarAuditoriaExcel(items, indicadores);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-ia.xlsx"');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao exportar Excel' });
  }
}
