import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  criarKb,
  atualizarKb,
  deletarKb,
  publicarKb,
  marcarUtil,
  registrarVisualizacao,
  listarKb,
  getKb,
  getKbPorSlug,
  sugerirKbParaTicket,
} from './kb.service';
import { logAction, getIpFromRequest } from '../audit/audit.service';
import { canEditKB, canPublishKB, canManageUsers } from '../auth/rbac';

export async function postKb(req: AuthRequest, res: Response) {
  try {
    if (!canEditKB(req.user?.role)) {
      return res.status(403).json({ error: 'Acesso nao autorizado' });
    }
    const { titulo, conteudo, resumo, categoriaId, tags, publicado, ordem } = req.body;
    if (!titulo || !conteudo) {
      return res.status(400).json({ error: 'titulo e conteudo sao obrigatorios' });
    }
    const kb = await criarKb({
      titulo,
      conteudo,
      resumo: resumo ?? null,
      categoriaId: categoriaId ?? null,
      tags: tags ?? '',
      autorId: req.user?.id ?? null,
      publicado: publicado ?? false,
      ordem: ordem ?? 0,
    });
    await logAction({
      usuarioId: req.user?.id,
      acao: 'kb_criar',
      entidade: 'KBArticle',
      entidadeId: kb.id,
      detalhes: { titulo, publicado: kb.publicado },
      ip: getIpFromRequest(req),
    });
    return res.status(201).json(kb);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Slug ja existe' });
    }
    console.error('Erro ao criar KB:', error);
    return res.status(500).json({ error: 'Erro ao criar artigo' });
  }
}

export async function getKbList(req: AuthRequest, res: Response) {
  try {
    const { categoriaId, tag, busca, limit, offset, publicado } = req.query;
    const result = await listarKb({
      categoriaId: categoriaId as string | undefined,
      tag: tag as string | undefined,
      busca: busca as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
      publicado: publicado === undefined ? undefined : publicado === 'true',
    });
    return res.json(result);
  } catch (error) {
    console.error('Erro ao listar KB:', error);
    return res.status(500).json({ error: 'Erro ao listar artigos' });
  }
}

export async function getKbById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const kb = await getKb(id);
    if (!kb) return res.status(404).json({ error: 'Artigo nao encontrado' });
    if (!kb.publicado && req.user?.role === 'solicitante') {
      return res.status(404).json({ error: 'Artigo nao encontrado' });
    }
    await registrarVisualizacao(id);
    return res.json(kb);
  } catch (error) {
    console.error('Erro ao buscar KB:', error);
    return res.status(500).json({ error: 'Erro ao buscar artigo' });
  }
}

export async function getKbBySlugRoute(req: AuthRequest, res: Response) {
  try {
    const { slug } = req.params;
    const kb = await getKbPorSlug(slug);
    if (!kb) return res.status(404).json({ error: 'Artigo nao encontrado' });
    if (!kb.publicado && req.user?.role === 'solicitante') {
      return res.status(404).json({ error: 'Artigo nao encontrado' });
    }
    await registrarVisualizacao(kb.id);
    return res.json(kb);
  } catch (error) {
    console.error('Erro ao buscar KB por slug:', error);
    return res.status(500).json({ error: 'Erro ao buscar artigo' });
  }
}

export async function patchKb(req: AuthRequest, res: Response) {
  try {
    if (!canEditKB(req.user?.role)) {
      return res.status(403).json({ error: 'Acesso nao autorizado' });
    }
    const { id } = req.params;
    const kb = await atualizarKb(id, req.body);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'kb_atualizar',
      entidade: 'KBArticle',
      entidadeId: id,
      detalhes: { campos: Object.keys(req.body) },
      ip: getIpFromRequest(req),
    });
    return res.json(kb);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Artigo nao encontrado' });
    }
    console.error('Erro ao atualizar KB:', error);
    return res.status(500).json({ error: 'Erro ao atualizar artigo' });
  }
}

export async function deleteKb(req: AuthRequest, res: Response) {
  try {
    if (!canManageUsers(req.user?.role)) {
      return res.status(403).json({ error: 'Apenas admin pode deletar artigos' });
    }
    const { id } = req.params;
    await deletarKb(id);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'kb_deletar',
      entidade: 'KBArticle',
      entidadeId: id,
      ip: getIpFromRequest(req),
    });
    return res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Artigo nao encontrado' });
    }
    console.error('Erro ao deletar KB:', error);
    return res.status(500).json({ error: 'Erro ao deletar artigo' });
  }
}

export async function postPublicarKb(req: AuthRequest, res: Response) {
  try {
    if (!canPublishKB(req.user?.role)) {
      return res.status(403).json({ error: 'Apenas supervisor ou acima pode publicar' });
    }
    const { id } = req.params;
    const { publicado } = req.body;
    const kb = await publicarKb(id, !!publicado);
    await logAction({
      usuarioId: req.user?.id,
      acao: 'kb_publicar',
      entidade: 'KBArticle',
      entidadeId: id,
      detalhes: { publicado: !!publicado },
      ip: getIpFromRequest(req),
    });
    return res.json(kb);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Artigo nao encontrado' });
    }
    console.error('Erro ao publicar KB:', error);
    return res.status(500).json({ error: 'Erro ao publicar artigo' });
  }
}

export async function postFeedbackKb(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { util } = req.body;
    const kb = await marcarUtil(id, !!util);
    return res.json(kb);
  } catch (error) {
    console.error('Erro ao registrar feedback KB:', error);
    return res.status(500).json({ error: 'Erro ao registrar feedback' });
  }
}

export async function getSugerirKb(req: AuthRequest, res: Response) {
  try {
    const { ticketId } = req.params;
    const sugestoes = await sugerirKbParaTicket(ticketId);
    return res.json({ sugestoes });
  } catch (error) {
    console.error('Erro ao sugerir KB:', error);
    return res.status(500).json({ error: 'Erro ao sugerir artigos' });
  }
}
