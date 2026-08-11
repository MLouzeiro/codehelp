import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import {
  listDepartamentos, getDepartamentoById, createDepartamento, updateDepartamento, toggleDepartamento,
  listNiveis, getNivelById, createNivel, updateNivel, toggleNivel,
} from './departamentos.service';

function handleError(res: Response, err: any, fallback: string) {
  if (err?.code === 'VALIDATION') {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  if (err?.code === 'P2002') {
    return res.status(400).json({ error: 'Slug já em uso.' });
  }
  console.error(`[departamentos] ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

// ── Departamentos ──────────────────────────────────────────────

export async function getDepartamentos(req: AuthRequest, res: Response) {
  try {
    const includeInativos = req.query.includeInativos === 'true' || req.query.includeInativos === '1';
    const mine = req.query.mine === 'true' || req.query.mine === '1';
    const onlyMine = mine && req.user?.role === 'tecnico';
    const lista = await listDepartamentos({
      includeInativos,
      userId: onlyMine ? req.user?.id : undefined,
    });
    return res.json(lista);
  } catch (err) {
    return handleError(res, err, 'Erro ao listar departamentos');
  }
}

export async function postDepartamento(req: AuthRequest, res: Response) {
  try {
    const dept = await createDepartamento(req.body);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar_departamento',
      entidade: 'Departamento',
      entidadeId: dept.id,
      detalhes: { slug: dept.slug, nome: dept.nome },
      ip: getIpFromRequest(req),
    });
    return res.status(201).json(dept);
  } catch (err) {
    return handleError(res, err, 'Erro ao criar departamento');
  }
}

export async function putDepartamento(req: AuthRequest, res: Response) {
  try {
    const dept = await updateDepartamento(req.params.id, req.body);
    if (!dept) return res.status(404).json({ error: 'Departamento não encontrado' });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'editar_departamento',
      entidade: 'Departamento',
      entidadeId: dept.id,
      detalhes: { campos: Object.keys(req.body) },
      ip: getIpFromRequest(req),
    });
    return res.json(dept);
  } catch (err) {
    return handleError(res, err, 'Erro ao atualizar departamento');
  }
}

export async function toggleDepartamentoHandler(req: AuthRequest, res: Response) {
  try {
    const dept = await toggleDepartamento(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Departamento não encontrado' });
    await logAction({
      usuarioId: req.user?.id,
      acao: dept.ativo ? 'reativar_departamento' : 'desativar_departamento',
      entidade: 'Departamento',
      entidadeId: dept.id,
      ip: getIpFromRequest(req),
    });
    return res.json(dept);
  } catch (err) {
    return handleError(res, err, 'Erro ao alterar departamento');
  }
}

// ── Níveis de Suporte ──────────────────────────────────────────

export async function getNiveis(req: AuthRequest, res: Response) {
  try {
    const includeInativos = req.query.includeInativos === 'true' || req.query.includeInativos === '1';
    const lista = await listNiveis({ includeInativos });
    return res.json(lista);
  } catch (err) {
    return handleError(res, err, 'Erro ao listar níveis');
  }
}

export async function postNivel(req: AuthRequest, res: Response) {
  try {
    const nivel = await createNivel(req.body);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'criar_nivel_suporte',
      entidade: 'NivelSuporte',
      entidadeId: nivel.id,
      detalhes: { slug: nivel.slug, nome: nivel.nome },
      ip: getIpFromRequest(req),
    });
    return res.status(201).json(nivel);
  } catch (err) {
    return handleError(res, err, 'Erro ao criar nível');
  }
}

export async function putNivel(req: AuthRequest, res: Response) {
  try {
    const nivel = await updateNivel(req.params.id, req.body);
    if (!nivel) return res.status(404).json({ error: 'Nível não encontrado' });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'editar_nivel_suporte',
      entidade: 'NivelSuporte',
      entidadeId: nivel.id,
      detalhes: { campos: Object.keys(req.body) },
      ip: getIpFromRequest(req),
    });
    return res.json(nivel);
  } catch (err) {
    return handleError(res, err, 'Erro ao atualizar nível');
  }
}

export async function toggleNivelHandler(req: AuthRequest, res: Response) {
  try {
    const nivel = await toggleNivel(req.params.id);
    if (!nivel) return res.status(404).json({ error: 'Nível não encontrado' });
    await logAction({
      usuarioId: req.user?.id,
      acao: nivel.ativo ? 'reativar_nivel_suporte' : 'desativar_nivel_suporte',
      entidade: 'NivelSuporte',
      entidadeId: nivel.id,
      ip: getIpFromRequest(req),
    });
    return res.json(nivel);
  } catch (err) {
    return handleError(res, err, 'Erro ao alterar nível');
  }
}
