import { Request, Response } from 'express';
import {
  solicitarAprovacao,
  decidirAprovacao,
  decidirAprovacaoPorToken,
  enviarAprovacaoWhatsApp,
  listarAprovacoes,
  obterAprovacao,
  contarApendentes,
} from './aprovacao.service';

interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export async function solicitarAprovacaoHandler(req: AuthRequest, res: Response) {
  try {
    const { ticketId, tipo, motivo, observacao, valorAprovado, canal, telefoneAprovador } = req.body;
    if (!ticketId || !motivo) {
      return res.status(400).json({ error: 'ticketId e motivo são obrigatórios' });
    }
    const aprovacao = await solicitarAprovacao(
      ticketId,
      req.user!.id,
      tipo || 'geral',
      motivo,
      observacao,
      valorAprovado,
      { canal: canal || 'interno', telefoneAprovador }
    );
    res.status(201).json(aprovacao);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao solicitar aprovação' });
  }
}

export async function enviarAprovacaoWhatsAppHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await enviarAprovacaoWhatsApp(id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao enviar aprovação via WhatsApp' });
  }
}

export async function decidirAprovacaoPorTokenHandler(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const { decidido, observacao } = req.body;
    if (decidido === undefined) {
      return res.status(400).json({ error: 'decidido é obrigatório (true/false)' });
    }
    const aprovacao = await decidirAprovacaoPorToken(token, decidido, observacao);
    res.json(aprovacao);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao decidir aprovação' });
  }
}

export async function decidirAprovacaoHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { decidido, observacao } = req.body;
    if (decidido === undefined) {
      return res.status(400).json({ error: 'decidido é obrigatório (true/false)' });
    }
    const aprovacao = await decidirAprovacao(id, req.user!.id, decidido, observacao);
    res.json(aprovacao);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao decidir aprovação' });
  }
}

export async function listarAprovacoesHandler(req: AuthRequest, res: Response) {
  try {
    const { status, tipo, ticketId, page, limit } = req.query;
    const result = await listarAprovacoes({
      status: status as string,
      tipo: tipo as string,
      ticketId: ticketId as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao listar aprovações' });
  }
}

export async function obterAprovacaoHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const aprovacao = await obterAprovacao(id);
    res.json(aprovacao);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Aprovação não encontrada' });
  }
}

export async function contarPendentesHandler(req: AuthRequest, res: Response) {
  try {
    const count = await contarApendentes();
    res.json({ pendentes: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao contar aprovações pendentes' });
  }
}
