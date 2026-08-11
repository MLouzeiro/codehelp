import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  classificarTicket,
  analiseContexto,
  sugerirResposta,
  gerarNotaEncerramento,
  gerarRelatorioCompleto,
  processarAutoAtendimento,
  resolverTicketPorIa,
  avaliarQualidade,
  corrigirResposta,
  processarNovoTicket,
  getMetricasIa,
  getHistoricoClassificacoes,
  getAvaliacoesTicket,
  getCorrecoesTicket,
} from './aiTicket.service';

// ── POST /ai/ticket/:id/classificar ────────────────────────────
export async function postClassificarTicket(req: AuthRequest, res: Response) {
  try {
    const resultado = await classificarTicket(req.params.id);
    return res.json(resultado);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao classificar ticket' });
  }
}

// ── POST /ai/ticket/:id/analise-contexto ───────────────────────
export async function postAnaliseContexto(req: AuthRequest, res: Response) {
  try {
    const resultado = await analiseContexto(req.params.id);
    return res.json(resultado);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao analisar contexto' });
  }
}

// ── POST /ai/ticket/:id/sugerir-resposta ───────────────────────
export async function postSugerirResposta(req: AuthRequest, res: Response) {
  try {
    const sugestao = await sugerirResposta(req.params.id);
    return res.json({ sugestao });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao sugerir resposta' });
  }
}

// ── POST /ai/ticket/:id/nota-encerramento ──────────────────────
export async function postNotaEncerramento(req: AuthRequest, res: Response) {
  try {
    const nota = await gerarNotaEncerramento(req.params.id);
    return res.json({ nota });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao gerar nota' });
  }
}

// ── POST /ai/ticket/:id/avaliar-qualidade ──────────────────────
export async function postAvaliarQualidade(req: AuthRequest, res: Response) {
  try {
    const avaliacao = await avaliarQualidade(req.params.id);
    return res.json(avaliacao);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao avaliar qualidade' });
  }
}

// ── POST /ai/ticket/:id/corrigir ──────────────────────────────
export async function postCorrigirResposta(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const { mensagemId, mensagemOriginal, tipoErro, correcao } = req.body;
    if (!mensagemOriginal || !tipoErro || !correcao) {
      return res.status(400).json({ error: 'mensagemOriginal, tipoErro e correcao são obrigatórios' });
    }
    const resultado = await corrigirResposta(
      req.params.id,
      { mensagemId, mensagemOriginal, tipoErro, correcao },
      req.user.id
    );
    return res.json(resultado);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao registrar correção' });
  }
}

// ── POST /ai/ticket/:id/processar ─────────────────────────────
export async function postProcessarTicket(req: AuthRequest, res: Response) {
  try {
    const resultado = await processarNovoTicket(req.params.id);
    return res.json(resultado);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao processar ticket' });
  }
}

// ── GET /ai/metricas ──────────────────────────────────────────
export async function getMetricasIaRoute(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.query;
    const metricas = await getMetricasIa(
      dataInicio as string | undefined,
      dataFim as string | undefined
    );
    return res.json(metricas);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao buscar métricas IA' });
  }
}

// ── GET /ai/ticket/:id/classificacoes ──────────────────────────
export async function getTicketClassificacoes(req: AuthRequest, res: Response) {
  try {
    const historico = await getHistoricoClassificacoes(req.params.id);
    return res.json(historico);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar classificações' });
  }
}

// ── GET /ai/ticket/:id/avaliacoes ──────────────────────────────
export async function getTicketAvaliacoes(req: AuthRequest, res: Response) {
  try {
    const avaliacoes = await getAvaliacoesTicket(req.params.id);
    return res.json(avaliacoes);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
}

// ── GET /ai/ticket/:id/correcoes ───────────────────────────────
export async function getTicketCorrecoes(req: AuthRequest, res: Response) {
  try {
    const correcoes = await getCorrecoesTicket(req.params.id);
    return res.json(correcoes);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar correções' });
  }
}

// ── POST /ai/ticket/:id/auto-atender ─────────────────────────────
export async function postAutoAtendimento(req: AuthRequest, res: Response) {
  try {
    const { mensagem } = req.body;
    if (!mensagem) {
      return res.status(400).json({ error: 'mensagem é obrigatória' });
    }
    const resultado = await processarAutoAtendimento(req.params.id, mensagem);
    return res.json(resultado);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro no auto-atendimento' });
  }
}

// ── POST /ai/ticket/:id/relatorio-completo ─────────────────────────
export async function postRelatorioCompleto(req: AuthRequest, res: Response) {
  try {
    const relatorio = await gerarRelatorioCompleto(req.params.id);
    return res.json(relatorio);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao gerar relatório completo' });
  }
}

// ── POST /ai/ticket/:id/resolver-por-ia ────────────────────────────
export async function postResolverPorIa(req: AuthRequest, res: Response) {
  try {
    await resolverTicketPorIa(req.params.id);
    return res.json({ sucesso: true, mensagem: 'Ticket resolvido pela IA' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao resolver ticket pela IA' });
  }
}
