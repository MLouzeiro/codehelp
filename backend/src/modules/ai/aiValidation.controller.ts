import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getConfigAutoAtendimento,
  updateConfigAutoAtendimento,
  propostaRespostaIA,
  validarResposta,
  rejeitarResposta,
  listarRespostasPendentes,
  listarPropostas,
  getMetricasValidacao,
} from './aiValidation.service';

// ── Config ─────────────────────────────────────────────────────

export async function getConfig(_req: AuthRequest, res: Response) {
  try {
    const config = await getConfigAutoAtendimento();
    res.json(config);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao buscar configuração' });
  }
}

export async function updateConfig(req: AuthRequest, res: Response) {
  try {
    const { autoAtendimentoAtivo, thresholdValidacoes, maxInteracoesIa } = req.body;
    const config = await updateConfigAutoAtendimento({
      autoAtendimentoAtivo,
      thresholdValidacoes,
      maxInteracoesIa,
    });
    res.json(config);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao atualizar configuração' });
  }
}

// ── Propostas ──────────────────────────────────────────────────

export async function criarProposta(req: AuthRequest, res: Response) {
  try {
    const { ticketId, mensagemCliente } = req.body;
    if (!ticketId || !mensagemCliente) {
      return res.status(400).json({ error: 'ticketId e mensagemCliente são obrigatórios' });
    }
    const proposta = await propostaRespostaIA(ticketId, mensagemCliente);
    res.status(201).json(proposta);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao criar proposta' });
  }
}

export async function listarPendentes(_req: AuthRequest, res: Response) {
  try {
    const propostas = await listarRespostasPendentes();
    res.json(propostas);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar propostas pendentes' });
  }
}

export async function listarTodas(req: AuthRequest, res: Response) {
  try {
    const { status, ticketId, limite } = req.query;
    const propostas = await listarPropostas({
      status: status as string,
      ticketId: ticketId as string,
      limite: limite ? parseInt(limite as string, 10) : undefined,
    });
    res.json(propostas);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar propostas' });
  }
}

// ── Validação ──────────────────────────────────────────────────

export async function validar(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { respostaFinal } = req.body;
    const atendenteId = req.user?.id;
    if (!atendenteId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const resultado = await validarResposta(id, atendenteId, respostaFinal);
    res.json(resultado);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao validar resposta' });
  }
}

export async function rejeitar(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const proposta = await rejeitarResposta(id);
    res.json(proposta);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao rejeitar resposta' });
  }
}

// ── Métricas ───────────────────────────────────────────────────

export async function getMetricas(_req: AuthRequest, res: Response) {
  try {
    const metricas = await getMetricasValidacao();
    res.json(metricas);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao buscar métricas' });
  }
}
