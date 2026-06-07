import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../shared/middleware/auth';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import {
  listStages,
  getStageById,
  createStage,
  updateStage,
  reorderStages,
  deleteStage,
  restoreStage,
  etapaInicialSlug,
} from './stages.service';

function handleError(res: Response, err: any, fallback: string) {
  if (err?.code === 'VALIDATION') {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  if (err?.code === 'P2002') {
    return res.status(400).json({ error: 'Slug já em uso.' });
  }
  console.error(`[stages] ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

export async function getStages(req: AuthRequest, res: Response) {
  try {
    const includeInativas = req.query.includeInativas === 'true' || req.query.includeInativas === '1';
    const lista = await listStages({ includeInativas });
    return res.json(lista);
  } catch (err) {
    return handleError(res, err, 'Erro ao listar etapas');
  }
}

export async function getEtapaInicialSlug(_req: AuthRequest, res: Response) {
  try {
    const slug = await etapaInicialSlug();
    return res.json({ slug });
  } catch (err) {
    return handleError(res, err, 'Erro ao buscar etapa inicial');
  }
}

export async function postStage(req: AuthRequest, res: Response) {
  try {
    const stage = await createStage(req.body);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar_etapa_helpdesk',
      entidade: 'HelpdeskConfig',
      entidadeId: stage.id,
      detalhes: { slug: stage.slug, nome: stage.nome },
      ip: getIpFromRequest(req),
    });
    return res.status(201).json(stage);
  } catch (err) {
    return handleError(res, err, 'Erro ao criar etapa');
  }
}

export async function putStage(req: AuthRequest, res: Response) {
  try {
    const stage = await updateStage(req.params.id, req.body);
    if (!stage) return res.status(404).json({ error: 'Etapa nao encontrada' });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'editar_etapa_helpdesk',
      entidade: 'HelpdeskConfig',
      entidadeId: stage.id,
      detalhes: { campos: Object.keys(req.body) },
      ip: getIpFromRequest(req),
    });
    return res.json(stage);
  } catch (err) {
    return handleError(res, err, 'Erro ao atualizar etapa');
  }
}

export async function patchReorder(req: AuthRequest, res: Response) {
  try {
    const { stageIds } = req.body;
    await reorderStages(stageIds);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'reordenar_etapas_helpdesk',
      entidade: 'HelpdeskConfig',
      detalhes: { total: stageIds?.length },
      ip: getIpFromRequest(req),
    });
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err, 'Erro ao reordenar etapas');
  }
}

export async function deleteStageHandler(req: AuthRequest, res: Response) {
  try {
    const result = await deleteStage(req.params.id);
    if (!result) return res.status(404).json({ error: 'Etapa nao encontrada' });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'desativar_etapa_helpdesk',
      entidade: 'HelpdeskConfig',
      entidadeId: req.params.id,
      ip: getIpFromRequest(req),
    });
    return res.json(result);
  } catch (err) {
    return handleError(res, err, 'Erro ao desativar etapa');
  }
}

export async function restoreStageHandler(req: AuthRequest, res: Response) {
  try {
    const stage = await restoreStage(req.params.id);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'reativar_etapa_helpdesk',
      entidade: 'HelpdeskConfig',
      entidadeId: req.params.id,
      ip: getIpFromRequest(req),
    });
    return res.json(stage);
  } catch (err) {
    return handleError(res, err, 'Erro ao reativar etapa');
  }
}
