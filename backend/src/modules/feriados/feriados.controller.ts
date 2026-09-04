import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import {
  listarFeriados,
  obterFeriadoPorId,
  criarFeriado,
  atualizarFeriado,
  deletarFeriado,
  seedFeriadosNacionais,
} from './feriados.service';

function handleError(res: Response, err: any, fallback: string) {
  if (err?.code === 'VALIDATION') {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  if (err?.message && /obrigatório|inválid/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message && /não encontrado/i.test(err.message)) {
    return res.status(404).json({ error: err.message });
  }
  console.error(`[feriados] ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

export async function getList(req: AuthRequest, res: Response) {
  try {
    const apenasAtivos = req.query.incluirInativos !== 'true';
    const result = await listarFeriados(apenasAtivos);
    return res.json(result);
  } catch (err) {
    return handleError(res, err, 'Erro ao listar feriados');
  }
}

export async function getOne(req: AuthRequest, res: Response) {
  try {
    const result = await obterFeriadoPorId(req.params.id);
    if (!result) return res.status(404).json({ error: 'Feriado nao encontrado' });
    return res.json(result);
  } catch (err) {
    return handleError(res, err, 'Erro ao buscar feriado');
  }
}

export async function postCreate(req: AuthRequest, res: Response) {
  try {
    const { data, nome, tipo, recorrente, ativo } = req.body;
    if (!data || !nome) return res.status(400).json({ error: 'data e nome sao obrigatorios' });
    const result = await criarFeriado({
      data: new Date(data),
      nome,
      tipo,
      recorrente,
      ativo,
    });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar_feriado',
      entidade: 'Feriado',
      entidadeId: result.id,
      detalhes: { nome: result.nome, data: result.data },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });
    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err, 'Erro ao criar feriado');
  }
}

export async function putUpdate(req: AuthRequest, res: Response) {
  try {
    const { data, nome, tipo, recorrente, ativo } = req.body;
    const patch: any = { nome, tipo, recorrente, ativo };
    if (data !== undefined) patch.data = new Date(data);
    const result = await atualizarFeriado(req.params.id, patch);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'atualizar_feriado',
      entidade: 'Feriado',
      entidadeId: result.id,
      detalhes: { nome: result.nome },
      ip: getIpFromRequest(req),
      severity: 'baixa',
    });
    return res.json(result);
  } catch (err) {
    return handleError(res, err, 'Erro ao atualizar feriado');
  }
}

export async function delRemove(req: AuthRequest, res: Response) {
  try {
    await deletarFeriado(req.params.id);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'deletar_feriado',
      entidade: 'Feriado',
      entidadeId: req.params.id,
      ip: getIpFromRequest(req),
      severity: 'media',
    });
    return res.json({ ok: true });
  } catch (err) {
    if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'Feriado nao encontrado' });
    return handleError(res, err, 'Erro ao deletar feriado');
  }
}

export async function postSeed(_req: AuthRequest, res: Response) {
  try {
    const inseridos = await seedFeriadosNacionais();
    return res.json({ ok: true, inseridos });
  } catch (err) {
    return handleError(res, err, 'Erro ao semear feriados');
  }
}
