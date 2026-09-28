import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import prisma from '../../config/database';
import {
  gerarInteligenciaCompleta,
  gerarResumoExecutivo,
  analisePorAssunto,
  analiseRiscoClientes,
  analiseProgresso,
  analiseEscalonamento,
  detectarOportunidadesAutomacao,
  detectarPossiveisBugs,
  sugerirClassificacaoNivel,
  FiltrosInteligencia,
} from './inteligencia-operacional.service';

// ── Helpers ─────────────────────────────────────────────────────────────

function parseFiltros(req: AuthRequest): FiltrosInteligencia {
  const q = req.query;
  const filtros: FiltrosInteligencia = {};

  if (q.inicio) filtros.inicio = new Date(q.inicio as string);
  if (q.fim) filtros.fim = new Date(q.fim as string);
  if (q.clienteId) filtros.clienteId = q.clienteId as string;
  if (q.analistaId) filtros.analistaId = q.analistaId as string;
  if (q.categoria) filtros.categoria = q.categoria as string;
  if (q.assunto) filtros.assunto = q.assunto as string;
  if (q.canal) filtros.canal = q.canal as string;
  if (q.prioridade) filtros.prioridade = q.prioridade as string;
  if (q.status) filtros.status = q.status as string;
  if (q.etapa) filtros.etapa = q.etapa as string;
  if (q.departamentoId) filtros.departamentoId = q.departamentoId as string;
  if (q.filaId) filtros.filaId = q.filaId as string;
  if (q.nivelSuporte) filtros.nivelSuporte = q.nivelSuporte as string;

  return filtros;
}

// ── Handlers ────────────────────────────────────────────────────────────

export const getInteligenciaCompleta = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await gerarInteligenciaCompleta(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getResumoExecutivo = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await gerarResumoExecutivo(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getAnaliseAssuntos = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await analisePorAssunto(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getRiscoClientes = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await analiseRiscoClientes(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getChamadosParados = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await analiseProgresso(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getEscalonamento = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await analiseEscalonamento(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getOportunidadesAutomacao = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await detectarOportunidadesAutomacao(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const getPossiveisBugs = async (req: AuthRequest, res: Response) => {
  try {
    const filtros = parseFiltros(req);
    const resultado = await detectarPossiveisBugs(filtros);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const postSugerirClassificacao = async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId é obrigatório' });
      return;
    }
    const resultado = await sugerirClassificacaoNivel(ticketId);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};

export const postConfirmarClassificacao = async (req: AuthRequest, res: Response) => {
  try {
    const { ticketId, nivel, motivo } = req.body;
    if (!ticketId || !nivel) {
      res.status(400).json({ error: 'ticketId e nivel são obrigatórios' });
      return;
    }
    if (!['N1', 'N2', 'N3'].includes(nivel)) {
      res.status(400).json({ error: 'nivel deve ser N1, N2 ou N3' });
      return;
    }

    // Buscar nível de suporte correspondente
    const nivelSuporte = await prisma.nivelSuporte.findFirst({
      where: { slug: nivel, ativo: true },
    });

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        nivelSuporteId: nivelSuporte?.id || null,
        nivelConfirmado: true,
        nivelMotivo: motivo || `Confirmado por ${req.user?.name || 'operador'}`,
        classificadoPorId: req.user?.id,
        classificadoEm: new Date(),
      },
    });

    res.json({ success: true, nivel, confirmado: true });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
};
