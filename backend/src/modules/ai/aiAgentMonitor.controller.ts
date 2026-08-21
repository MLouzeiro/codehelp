import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  avaliarMensagemAgente,
  gerarSugestaoResposta,
  getMetricasAgente,
  getRelatorioAuditoria,
  getRankingAgentes,
  getEncerramentosAgente,
  auditarEncerramentoTicket,
} from './aiAgentMonitor.service';

export async function avaliarMensagemHandler(req: AuthRequest, res: Response) {
  try {
    const { ticketId, mensagemId, conteudoMensagem } = req.body;
    if (!ticketId || !conteudoMensagem) {
      return res.status(400).json({ error: 'ticketId e conteudoMensagem são obrigatórios' });
    }

    const resultado = await avaliarMensagemAgente(
      ticketId,
      req.user?.id || '',
      mensagemId || '',
      conteudoMensagem
    );

    return res.json(resultado);
  } catch (error: any) {
    console.error('Erro ao avaliar mensagem:', error?.message);
    return res.status(500).json({ error: 'Erro ao avaliar mensagem' });
  }
}

export async function sugestaoRespostaHandler(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const { ultimoProblema } = req.body || {};

    const sugestao = await gerarSugestaoResposta(ticketId, ultimoProblema);
    return res.json({ sugestao });
  } catch (error: any) {
    console.error('Erro ao gerar sugestão:', error?.message);
    return res.status(500).json({ error: 'Erro ao gerar sugestão' });
  }
}

export async function metricasAgenteHandler(req: AuthRequest, res: Response) {
  try {
    const { agentId } = req.params;
    const dias = parseInt(req.query.dias as string) || 30;

    const metricas = await getMetricasAgente(agentId, dias);
    if (!metricas) {
      return res.status(404).json({ error: 'Agente não encontrado ou sem dados' });
    }

    return res.json(metricas);
  } catch (error: any) {
    console.error('Erro ao buscar métricas:', error?.message);
    return res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
}

export async function relatorioAuditoriaHandler(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;

    const relatorio = await getRelatorioAuditoria(ticketId);
    if (!relatorio) {
      return res.status(404).json({ error: 'Ticket não encontrado ou sem avaliações' });
    }

    return res.json(relatorio);
  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error?.message);
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
}

export async function rankingAgentesHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 30;

    const ranking = await getRankingAgentes(dias);
    return res.json(ranking);
  } catch (error: any) {
    console.error('Erro ao gerar ranking:', error?.message);
    return res.status(500).json({ error: 'Erro ao gerar ranking' });
  }
}

export async function encerramentosAgenteHandler(req: AuthRequest, res: Response) {
  try {
    const { agentId } = req.params;
    const dias = parseInt(req.query.dias as string) || 30;

    const resultado = await getEncerramentosAgente(agentId, dias);
    return res.json(resultado);
  } catch (error: any) {
    console.error('Erro ao buscar encerramentos do agente:', error?.message);
    return res.status(500).json({ error: 'Erro ao buscar encerramentos do agente' });
  }
}

export async function encerramentoTicketHandler(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;

    const resultado = await auditarEncerramentoTicket(ticketId);
    if (!resultado) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    return res.json(resultado);
  } catch (error: any) {
    console.error('Erro ao auditar encerramento do ticket:', error?.message);
    return res.status(500).json({ error: 'Erro ao auditar encerramento do ticket' });
  }
}
