import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getQualidadeOperacional,
  getReaberturaDetalhe,
  getRecorrenciaDetalhe,
  getRetrabalhoDetalhe,
  getDiagnosticoIa,
  getQualidadeCliente,
} from './qualidadeOperacional.service';

export async function getQualidadeHandler(req: AuthRequest, res: Response) {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 90);
    const filtros = {
      dataInicio: req.query.dataInicio as string,
      dataFim: req.query.dataFim as string,
      departamentoId: req.query.departamentoId as string,
      filaId: req.query.filaId as string,
      analistaId: req.query.analistaId as string,
      categoria: req.query.categoria as string,
      prioridade: req.query.prioridade as string,
      canal: req.query.canal as string,
    };
    const result = await getQualidadeOperacional(dias, filtros);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
}

export async function getReaberturaDetalheHandler(req: AuthRequest, res: Response) {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 90);
    const result = await getReaberturaDetalhe(dias);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
}

export async function getRecorrenciaDetalheHandler(req: AuthRequest, res: Response) {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 90);
    const problema = req.query.problema as string;
    if (!problema) {
      return res.status(400).json({ error: 'Parâmetro "problema" obrigatório' });
    }
    const result = await getRecorrenciaDetalhe(dias, problema);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
}

export async function getRetrabalhoDetalheHandler(req: AuthRequest, res: Response) {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 90);
    const result = await getRetrabalhoDetalhe(dias);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
}

export async function getDiagnosticoIaHandler(req: AuthRequest, res: Response) {
  try {
    const { tipo } = req.params;
    const itemId = req.query.itemId as string | undefined;
    const dias = Number(req.query.dias) || 30;
    if (!['reabertura', 'recorrencia', 'retrabalho', 'fcr'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: reabertura, recorrencia, retrabalho, fcr' });
    }
    const result = await getDiagnosticoIa(tipo as any, itemId, dias);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
}

export async function getQualidadeClienteHandler(req: AuthRequest, res: Response) {
  try {
    const { clientId } = req.params;
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 90);
    const result = await getQualidadeCliente(clientId, dias);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro interno' });
  }
}
