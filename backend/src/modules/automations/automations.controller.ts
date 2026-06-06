import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  criarRegra,
  atualizarRegra,
  deletarRegra,
  listarRegras,
  getRegra,
  avaliarRegras,
  RegraInput,
} from './automations.service';
import { canEditKB } from '../auth/rbac';
import { logAction, getIpFromRequest } from '../audit/audit.service';

export async function postRegra(req: AuthRequest, res: Response) {
  try {
    if (!canEditKB(req.user?.role)) {
      return res.status(403).json({ error: 'Acesso nao autorizado' });
    }
    const r = await criarRegra({ ...(req.body as RegraInput), autorId: req.user?.id });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'regra_executar',
      entidade: 'AutomationRule',
      entidadeId: r.id,
      detalhes: { trigger: r.trigger, nome: r.nome },
      ip: getIpFromRequest(req),
    });
    return res.status(201).json(r);
  } catch (error) {
    console.error('Erro ao criar regra:', error);
    return res.status(500).json({ error: 'Erro ao criar regra' });
  }
}

export async function getRegrasList(req: AuthRequest, res: Response) {
  try {
    const { trigger, ativo } = req.query;
    const r = await listarRegras({
      trigger: trigger as string | undefined,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
    return res.json(r);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar regras' });
  }
}

export async function getRegraById(req: AuthRequest, res: Response) {
  try {
    const r = await getRegra(req.params.id);
    if (!r) return res.status(404).json({ error: 'Regra nao encontrada' });
    return res.json(r);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar regra' });
  }
}

export async function patchRegra(req: AuthRequest, res: Response) {
  try {
    if (!canEditKB(req.user?.role)) {
      return res.status(403).json({ error: 'Acesso nao autorizado' });
    }
    const r = await atualizarRegra(req.params.id, req.body);
    return res.json(r);
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Regra nao encontrada' });
    return res.status(500).json({ error: 'Erro ao atualizar regra' });
  }
}

export async function deleteRegraRoute(req: AuthRequest, res: Response) {
  try {
    if (!canEditKB(req.user?.role)) {
      return res.status(403).json({ error: 'Acesso nao autorizado' });
    }
    await deletarRegra(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Regra nao encontrada' });
    return res.status(500).json({ error: 'Erro ao deletar regra' });
  }
}

export async function postTestarRegra(req: AuthRequest, res: Response) {
  try {
    const { trigger, contexto } = req.body;
    if (!trigger) return res.status(400).json({ error: 'trigger obrigatorio' });
    const r = await avaliarRegras(trigger, contexto || {});
    return res.json({ regrasExecutadas: r });
  } catch (error) {
    console.error('Erro ao testar regra:', error);
    return res.status(500).json({ error: 'Erro ao testar regra' });
  }
}
