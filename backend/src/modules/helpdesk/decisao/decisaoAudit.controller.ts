import { Response } from 'express';
import { AuthRequest } from '../../../shared/middleware/auth';
import * as service from './decisaoAudit.service';

export async function getResumoHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const resultado = await service.getResumoDecisoes(dias);
    return res.json(resultado);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao buscar resumo de decisões' });
  }
}

export async function listarDecisoesHandler(req: AuthRequest, res: Response) {
  try {
    const { tipo, severidade, confianca, status, revisaoStatus, dataInicio, dataFim, limit, offset } = req.query;
    const filtro: service.FiltroDecisao = {
      tipo: tipo as service.TipoDecisao | undefined,
      severidade: severidade as service.SeveridadeDecisao | undefined,
      confianca: confianca as service.ConfiancaDecisao | undefined,
      status: status as service.StatusDecisao | undefined,
      revisaoStatus: revisaoStatus as service.RevisaoStatus | undefined,
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    };
    const resultado = await service.listarDecisoes(filtro);
    return res.json(resultado);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao listar decisões' });
  }
}

export async function gerarDecisoesHandler(req: AuthRequest, res: Response) {
  try {
    const { dataInicio, dataFim } = req.body;
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
    }
    const resultado = await service.gerarDecisoesPeriodo(
      new Date(dataInicio),
      new Date(dataFim),
      req.user?.id,
      req.user?.organizationId ?? undefined,
    );
    return res.json({ decisoes: resultado, total: resultado.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar decisões' });
  }
}

export async function atualizarStatusHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, resultado } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status é obrigatório' });
    }
    const atualizada = await service.atualizarStatusDecisao(id, status, resultado);
    return res.json(atualizada);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao atualizar status' });
  }
}

export async function revisarDecisaoHandler(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { revisaoStatus, justificativa } = req.body;
    if (!revisaoStatus || !justificativa) {
      return res.status(400).json({ error: 'revisaoStatus e justificativa são obrigatórios' });
    }
    const revisada = await service.revisarDecisao(id, revisaoStatus, justificativa, req.user?.id || '');
    return res.json(revisada);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao revisar decisão' });
  }
}

export async function gerarReaberturaHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const decisao = await service.gerarDecisaoReabertura(dataInicio, dataFim);
    return res.json(decisao);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar decisão de reabertura' });
  }
}

export async function gerarSLAHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const decisao = await service.gerarDecisaoSLA(dataInicio, dataFim);
    return res.json(decisao);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar decisão de SLA' });
  }
}

export async function gerarCSATHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const decisao = await service.gerarDecisaoCSAT(dataInicio, dataFim);
    return res.json(decisao);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar decisão de CSAT' });
  }
}

export async function gerarOciosidadeHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 7;
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const decisao = await service.gerarDecisaoOciosidade(dataInicio, dataFim);
    return res.json(decisao);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar decisão de ociosidade' });
  }
}

export async function gerarRetrabalhoHandler(req: AuthRequest, res: Response) {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const decisao = await service.gerarDecisaoRetrabalho(dataInicio, dataFim);
    return res.json(decisao);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar decisão de retrabalho' });
  }
}
